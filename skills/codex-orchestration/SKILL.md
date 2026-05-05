# Codex 执行编排 Skill

**skill_id**: `codex-orchestration`
**版本**: 1.0.0
**output_dir**: `docs/codex/`

---

## 1. 概述

本技能用于在任意项目中统一 Codex CLI 非交互调用方式，解决以下跨项目共性问题：

- 长 Prompt 内联导致的 shell 引号/转义失败
- 流式日志存在但最终输出为空时的误判
- 网络不稳定导致的重复超时与不可追溯
- 外层调度器超时先触发，导致失败记录缺失

### 1.1 触发条件

| 触发方式 | 条件 |
|----------|------|
| 显式触发 | 用户明确要求 Codex CLI 非交互执行、`codex exec`、`resume`、超时恢复、`reconnect` 排查或执行归档 |
| 场景触发 | 不自动触发；必须有用户显式指令 |

### 1.2 前置依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| Codex CLI | 非交互执行与恢复会话 | 必需 |
| Shell 工具 | timeout/日志落盘/失败归档 | 必需 |
| docs 目录 | 产物可追溯归档 | 必需 |

### 1.3 关联规范

规范标准详见：[SPEC.md](./SPEC.md)

治理分层说明：本 Skill 是可选的 Codex CLI 执行提供器，不参与默认 code review 主链；参数与失败处置细则只在本 Skill 与 `SPEC.md` 维护，避免双写漂移。

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| Prompt 必须落盘并通过 stdin 传入 | 调用 `codex exec` 前 |
| 写入 raw、failure 或其他 Codex 产物前，必须先确认项目根为当前 `AGENTS.md` 所在目录；所有相对路径相对该目录解析 | 调用前 |
| 原始输出与失败记录必须分目录落盘 | 调用过程中 |
| 必须校验退出码与输出文件非空 | 调用后 |
| 至少自动重试一次 | 首次失败后 |
| 连续 2 次网络型失败必须降级为主 AI 助手或人工接管 | 重试失败后 |
| 记录 `session_id` 并给出 `resume` 建议 | 失败归档时 |

---

## 3. 快速参考

### 3.1 通用命令

```bash
bash skills/codex-orchestration/scripts/run_codex_exec.sh \
  --scope codex-task \
  --prompt-file docs/codex/_inputs/codex-task.prompt.md \
  --raw-dir docs/codex/_raw \
  --failure-dir docs/codex/_failures \
  --proxy-port 7899 \
  --timeout 1200 \
  --heartbeat 20 \
  --retries 1
```

### 3.2 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--scope` | 是 | 任务范围标识（用于文件命名） |
| `--prompt-file` | 是 | Prompt 文件路径（UTF-8） |
| `--raw-dir` | 否 | 原始输出目录，默认 `docs/codex/_raw` |
| `--failure-dir` | 否 | 失败记录目录，默认 `docs/codex/_failures` |
| `--proxy-url` | 否 | 显式代理地址，例如 `http://127.0.0.1:7899` |
| `--proxy-port` | 否 | 代理端口快捷参数，等价于 `--proxy-url http://127.0.0.1:<port>` |
| `--proxy-no` | 否 | no_proxy 值，默认沿用环境；若未设置且启用代理则补 `localhost,127.0.0.1` |
| `--timeout` | 否 | 单次超时秒数，默认 `1200` |
| `--heartbeat` | 否 | 心跳间隔秒数，默认 `20`，`0` 表示关闭；值越大，进程结束感知延迟越高 |
| `--retries` | 否 | 失败重试次数，默认 `1`，建议 `>=1`（才能覆盖“连续 2 次网络失败”判定） |
| `--sandbox` | 否 | `read-only/workspace-write/danger-full-access` |
| `--model` | 否 | 指定模型 |

说明：若通过 `launch-process` 等非交互 shell 调用，`.bashrc` 中定义的 `codex()` 函数不会自动生效，需显式传入 `--proxy-url/--proxy-port` 或提前导出 `HTTP_PROXY/HTTPS_PROXY`。
说明：`codex exec resume` 参数集合与 `codex exec` 不同，恢复时通常不要附加 `-o/-s`。

---

## 4. Skill 定义

### 4.1 prepare_prompt_input

**目的**: 规范 Prompt 输入，避免命令行内联风险。

**执行步骤**:
1. 生成 Prompt 文件并写入 `docs/codex/_inputs/`。
2. 检查文件存在且非空。
3. 通过 stdin 传给 Codex。

### 4.2 execute_with_retry

**目的**: 执行 Codex 并保留每次尝试日志。

**执行步骤**:
1. 每次尝试生成独立 `attemptN` 日志。
2. 执行 `codex exec ... - < <prompt_file>`。
3. 执行期间按 `--heartbeat` 周期输出进度，避免外层误判“卡住”。
4. 失败时按策略重试。

### 4.3 classify_failure

**目的**: 区分“无输出”和“部分输出失败”。

**执行步骤**:
1. 若 exit=124 且有流式日志，标记 `timeout_with_partial_stream_output`。
2. 若连续 2 次网络型失败或日志含 `reconnect`，标记 `network_unstable_after_retries`（作用域为单次脚本调用）。
3. 提取 `session_id` 并记录恢复命令。
4. 若 `--retries=0`，需在输出中提示该调用无法触发“连续 2 次网络失败”判定。

### 4.4 downgrade_on_network_instability

**目的**: 在网络持续异常时及时止损。

**执行步骤**:
1. 检查失败类型是否连续命中网络型失败。
2. 满足阈值后停止继续重试。
3. 降级为主 AI 助手或人工接管，并在最终报告标注原因。

---

## 5. 编排建议（多 Agent）

| 角色 | 职责 |
|------|------|
| 调度 Agent（Kiro） | 生成 Prompt、发起调用、轮询日志、决定降级 |
| 执行 Agent（Codex） | 读取仓库、完成分析、输出结论 |
| 归档 Agent（可选） | 汇总 raw/failure 到最终报告 |

建议串联：`调度 -> 执行 -> 归档`，避免把执行与归档耦合在同一个长任务中。
