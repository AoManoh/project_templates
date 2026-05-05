#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
用法:
  bash skills/codex-orchestration/scripts/run_codex_exec.sh \
    --scope <scope> \
    --prompt-file <path> \
    [--raw-dir <path>] \
    [--failure-dir <path>] \
    [--timeout <seconds>] \
    [--retries <count>] \
    [--heartbeat <seconds>] \
    [--proxy-url <http://127.0.0.1:7899>] \
    [--proxy-port <7899>] \
    [--proxy-no <localhost,127.0.0.1>] \
    [--sandbox <read-only|workspace-write|danger-full-access>] \
    [--model <model>]
USAGE
}

scope=""
prompt_file=""
raw_dir="docs/codex/_raw"
failure_dir="docs/codex/_failures"
timeout_secs=1200
retries=1
heartbeat_secs=20
sandbox_mode="read-only"
model=""
proxy_url=""
proxy_port=""
proxy_no_override=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      scope="${2:-}"
      shift 2
      ;;
    --prompt-file)
      prompt_file="${2:-}"
      shift 2
      ;;
    --raw-dir)
      raw_dir="${2:-}"
      shift 2
      ;;
    --failure-dir)
      failure_dir="${2:-}"
      shift 2
      ;;
    --timeout)
      timeout_secs="${2:-}"
      shift 2
      ;;
    --retries)
      retries="${2:-}"
      shift 2
      ;;
    --heartbeat)
      heartbeat_secs="${2:-}"
      shift 2
      ;;
    --proxy-url)
      proxy_url="${2:-}"
      shift 2
      ;;
    --proxy-port)
      proxy_port="${2:-}"
      shift 2
      ;;
    --proxy-no)
      proxy_no_override="${2:-}"
      shift 2
      ;;
    --sandbox)
      sandbox_mode="${2:-}"
      shift 2
      ;;
    --model)
      model="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$scope" || -z "$prompt_file" ]]; then
  echo "缺少必需参数: --scope 或 --prompt-file" >&2
  usage >&2
  exit 2
fi
if [[ ! -f "$prompt_file" || ! -s "$prompt_file" ]]; then
  echo "Prompt 文件不存在或为空: $prompt_file" >&2
  exit 2
fi
if ! [[ "$timeout_secs" =~ ^[0-9]+$ ]] || ! [[ "$retries" =~ ^[0-9]+$ ]] || ! [[ "$heartbeat_secs" =~ ^[0-9]+$ ]]; then
  echo "--timeout / --retries / --heartbeat 必须是非负整数" >&2
  exit 2
fi
if [[ -n "$proxy_port" ]] && ! [[ "$proxy_port" =~ ^[0-9]+$ ]]; then
  echo "--proxy-port 必须是非负整数端口号" >&2
  exit 2
fi
if [[ -n "$proxy_url" && -n "$proxy_port" ]]; then
  echo "--proxy-url 与 --proxy-port 不能同时指定" >&2
  exit 2
fi
if [[ "$retries" -eq 0 ]]; then
  echo "[codex-orchestration] 提示: --retries=0 仅单次尝试，不会触发“连续 2 次网络型失败”判定"
fi
if [[ "$heartbeat_secs" -gt 30 ]]; then
  echo "[codex-orchestration] 提示: heartbeat 较大，进程结束感知可能最多延迟 ${heartbeat_secs}s"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../../" && pwd)"
cd "$repo_root"

mkdir -p "$raw_dir" "$failure_dir"

if [[ -n "$proxy_port" ]]; then
  proxy_url="http://127.0.0.1:${proxy_port}"
fi
if [[ -n "$proxy_url" ]]; then
  export HTTP_PROXY="$proxy_url"
  export HTTPS_PROXY="$proxy_url"
  if [[ -n "$proxy_no_override" ]]; then
    export NO_PROXY="$proxy_no_override"
    export no_proxy="$proxy_no_override"
  elif [[ -z "${NO_PROXY:-${no_proxy:-}}" ]]; then
    export NO_PROXY="localhost,127.0.0.1"
    export no_proxy="$NO_PROXY"
  fi
fi

effective_proxy_http="${HTTP_PROXY:-${http_proxy:-}}"
effective_proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"
effective_proxy_no="${NO_PROXY:-${no_proxy:-}}"
if [[ -n "$effective_proxy_http" || -n "$effective_proxy_https" ]]; then
  echo "[codex-orchestration] proxy 已启用: http=${effective_proxy_http:-<empty>} https=${effective_proxy_https:-<empty>} no_proxy=${effective_proxy_no:-<empty>}"
else
  echo "[codex-orchestration] proxy 未显式设置（沿用当前环境）"
fi

timestamp="$(date +%Y-%m-%dT%H-%M-%S)"
safe_scope="$(printf '%s' "$scope" | tr ' /' '__' | tr -cd 'A-Za-z0-9._-')"
if [[ -z "$safe_scope" ]]; then
  safe_scope="task"
fi

raw_output="${raw_dir}/${timestamp}-${safe_scope}.md"
failure_report="${failure_dir}/${timestamp}-${safe_scope}.md"

attempt_logs=()
network_like_failures=0
last_console_log=""
last_stderr_log=""
max_attempts=$((retries + 1))
attempt=1
last_exit_code=1

while [[ "$attempt" -le "$max_attempts" ]]; do
  console_log="${raw_dir}/${timestamp}-${safe_scope}.attempt${attempt}.console.log"
  stderr_log="${raw_dir}/${timestamp}-${safe_scope}.attempt${attempt}.stderr.log"
  attempt_logs+=("$console_log" "$stderr_log")
  last_console_log="$console_log"
  last_stderr_log="$stderr_log"

  rm -f "$raw_output" "$console_log" "$stderr_log"
  echo "[codex-orchestration] 尝试 ${attempt}/${max_attempts}..."

  cmd=(codex exec --skip-git-repo-check -s "$sandbox_mode" -o "$raw_output")
  if [[ -n "$model" ]]; then
    cmd+=(-m "$model")
  fi

  if [[ "$heartbeat_secs" -gt 0 ]]; then
    echo "[codex-orchestration] heartbeat=${heartbeat_secs}s（0 表示关闭心跳）"
  fi

  set +e
  timeout "$timeout_secs" "${cmd[@]}" - <"$prompt_file" >"$console_log" 2>"$stderr_log" &
  cmd_pid=$!

  start_epoch="$(date +%s)"
  if [[ "$heartbeat_secs" -gt 0 ]]; then
    while kill -0 "$cmd_pid" 2>/dev/null; do
      sleep "$heartbeat_secs"
      if ! kill -0 "$cmd_pid" 2>/dev/null; then
        break
      fi
      now_epoch="$(date +%s)"
      elapsed="$((now_epoch - start_epoch))"
      out_bytes="$(wc -c <"$console_log" 2>/dev/null || echo 0)"
      err_bytes="$(wc -c <"$stderr_log" 2>/dev/null || echo 0)"
      reconnect_count="$(grep -Eci 'Reconnecting\.\.\.|reconnect' "$stderr_log" 2>/dev/null || true)"
      echo "[codex-orchestration] 尝试${attempt}进行中: ${elapsed}s, stdout=${out_bytes}B, stderr=${err_bytes}B, reconnect=${reconnect_count}"
    done
  fi

  wait "$cmd_pid"
  last_exit_code="$?"
  set -e

  attempt_has_stream=0
  if [[ -s "$console_log" || -s "$stderr_log" ]]; then
    attempt_has_stream=1
  fi

  attempt_has_reconnect=0
  if grep -Eiq 'reconnect|connection reset|network|timed out|timeout waiting' "$console_log" "$stderr_log" 2>/dev/null; then
    attempt_has_reconnect=1
  fi

  is_network_like=0
  if [[ "$attempt_has_reconnect" -eq 1 ]]; then
    is_network_like=1
  fi
  if [[ "$last_exit_code" -eq 124 && "$attempt_has_stream" -eq 1 ]]; then
    is_network_like=1
  fi
  if [[ "$is_network_like" -eq 1 ]]; then
    network_like_failures=$((network_like_failures + 1))
  fi

  if [[ "$last_exit_code" -eq 0 && -s "$raw_output" ]]; then
    echo "[codex-orchestration] 成功: $raw_output"
    printf '%s\n' "$raw_output"
    exit 0
  fi

  if [[ "$attempt" -lt "$max_attempts" ]]; then
    echo "[codex-orchestration] 失败（exit=${last_exit_code}），准备重试..."
    sleep 2
  fi
  attempt=$((attempt + 1))
done

failure_type="execution_error"
if [[ "$network_like_failures" -ge 2 ]]; then
  failure_type="network_unstable_after_retries"
elif [[ "$last_exit_code" -eq 124 ]]; then
  if [[ -s "$last_console_log" || -s "$last_stderr_log" ]]; then
    failure_type="timeout_with_partial_stream_output"
  else
    failure_type="timeout_no_stream_output"
  fi
elif [[ ! -s "$raw_output" ]]; then
  failure_type="empty_output_file"
fi

session_id="$(
  grep -Eho 'session id: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "${attempt_logs[@]}" 2>/dev/null \
    | head -n 1 \
    | awk '{print $3}' \
    || true
)"
if [[ -z "$session_id" ]]; then
  session_id="$(
    grep -Eho 'codex( exec)? resume [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "${attempt_logs[@]}" 2>/dev/null \
      | head -n 1 \
      | awk '{print $NF}' \
      || true
  )"
fi

proxy_http="${HTTP_PROXY:-${http_proxy:-}}"
proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"
proxy_all="${ALL_PROXY:-${all_proxy:-}}"
proxy_no="${NO_PROXY:-${no_proxy:-}}"

{
  echo "# Codex 执行失败记录"
  echo
  echo "- 时间：$(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "- scope：$scope"
  echo "- prompt_file：$prompt_file"
  echo "- timeout_secs：$timeout_secs"
  echo "- retries：$retries"
  echo "- heartbeat_secs：$heartbeat_secs"
  echo "- proxy_url_arg：${proxy_url:-<empty>}"
  echo "- proxy_port_arg：${proxy_port:-<empty>}"
  echo "- proxy_no_arg：${proxy_no_override:-<empty>}"
  echo "- sandbox：$sandbox_mode"
  echo "- proxy_http：${proxy_http:-<empty>}"
  echo "- proxy_https：${proxy_https:-<empty>}"
  echo "- proxy_all：${proxy_all:-<empty>}"
  echo "- proxy_no：${proxy_no:-<empty>}"
  if [[ -n "$model" ]]; then
    echo "- model：$model"
  else
    echo "- model：(default)"
  fi
  echo "- raw_output：$raw_output"
  echo "- last_console_log：$last_console_log"
  echo "- last_stderr_log：$last_stderr_log"
  echo "- network_like_failures：$network_like_failures"
  echo "- attempt_logs："
  for f in "${attempt_logs[@]}"; do
    echo "  - $f"
  done
  echo "- last_exit_code：$last_exit_code"
  echo "- failure_type：$failure_type"
  if [[ -n "$session_id" ]]; then
    echo "- session_id：$session_id"
  else
    echo "- session_id：(not_found)"
  fi
  echo
  echo "## 建议动作"
  echo "1. 检查 Prompt 文件编码与内容（建议 UTF-8）"
  echo "2. 若为超时，将 --timeout 提升到 1200 或 1800"
  echo "3. 若存在 session_id，可尝试：codex exec resume \"$session_id\" - < \"$prompt_file\""
  echo "4. 注意：resume 子命令参数集与 exec 不同，通常不要附加 -o / -s；可按需添加 --skip-git-repo-check"
  echo "5. 若连续网络失败（含 reconnect），按规范降级为主 AI 助手或人工接管并保留本失败记录"
} >"$failure_report"

echo "[codex-orchestration] 失败记录已写入: $failure_report" >&2
exit 1
