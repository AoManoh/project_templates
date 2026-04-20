# Codex 执行编排规范

**版本**: 1.0.0
**适用范围**: 需要跨项目复用 Codex CLI 调用流程的团队

---

## 1. 目标

统一 Codex CLI 的输入、执行、失败分类、恢复与归档，确保：

1. 可复现：同一命令在不同项目行为一致。
2. 可追溯：原始输出与失败证据可回查。
3. 可恢复：失败后可继续（`resume`）或有明确降级路径。

文档治理约束：`AGENTS.md` 仅保留简要治理原则，命令参数和失败处置细则以本规范为准。

---

## 2. I/O 合约

### 2.1 输入合约

| 字段 | 类型 | 约束 |
|------|------|------|
| `scope` | string | 仅用于命名，建议 kebab-case |
| `prompt_file` | path | 必须存在且非空，建议 UTF-8 |
| `timeout` | int | 默认 1200，建议区间 600~1800 |
| `heartbeat` | int | 默认 20，建议 10~30，0 表示关闭心跳；值越大，结束感知延迟越高 |
| `retries` | int | 默认 1，建议 >=1（支持“连续 2 次网络失败”判定） |
| `raw_dir` | path | 默认 `docs/codex/_raw` |
| `failure_dir` | path | 默认 `docs/codex/_failures` |
| `proxy_url` | string | 可选，显式代理地址（如 `http://127.0.0.1:7899`） |
| `proxy_port` | int | 可选，代理端口快捷参数，内部转换为 `proxy_url` |
| `proxy_no` | string | 可选，`no_proxy` 覆盖值 |

### 2.2 输出合约

| 产物 | 说明 |
|------|------|
| `*.md`（raw） | 最终消息文件（`-o` 输出） |
| `*.attemptN.console.log` | 每次尝试 stdout |
| `*.attemptN.stderr.log` | 每次尝试 stderr |
| `*.md`（failure） | 失败归档，含 `failure_type` 和 `session_id` |

---

## 3. 失败分类标准

| failure_type | 判定条件 |
|--------------|----------|
| `timeout_no_stream_output` | exit=124 且无流式日志 |
| `timeout_with_partial_stream_output` | exit=124 且存在流式日志 |
| `network_unstable_after_retries` | 单次脚本调用内连续 2 次网络型失败或日志含 `reconnect` |
| `empty_output_file` | exit=0/非 0 但 raw 文件为空 |
| `execution_error` | 其他错误 |

---

## 4. 外层调度约束

若通过外层调度器（如 `launch-process`）调用：

1. 外层超时必须满足：`max_wait_seconds >= timeout + 30`。
2. 或改用 `wait=false` + 轮询模式，避免阻塞。
3. 不允许外层先终止导致 failure 记录缺失。
4. 非交互 shell 默认不会加载 `.bashrc` 函数，若依赖代理必须显式传 `proxy_url/proxy_port` 或预先导出 `HTTP_PROXY/HTTPS_PROXY`。

---

## 5. 降级策略

命中以下任一条件时，必须降级人工审查：

1. `failure_type=network_unstable_after_retries`
2. 连续 2 次出现 `timeout_with_partial_stream_output`
3. stderr 持续出现 reconnect/连接重置错误

说明：上述“连续 2 次”只在同一次脚本调用内统计。若 `--retries 0`，不会触发该类型判定。

降级时必须在最终报告注明：

- 降级触发条件
- 已保留的 failure 文件路径
- 人工审查接管范围

---

## 6. 恢复策略

失败记录中若存在 `session_id`，可执行：

```bash
codex exec resume <session_id> - < <prompt_file>
```

注意：`resume` 参数集合不同于 `exec`，恢复命令通常不附带 `-o/-s`。

恢复后仍需重新校验 raw 输出文件非空。

---

## 7. 验收清单

1. raw/failure 目录与文件均生成。
2. 失败记录包含 `failure_type`、`session_id`（可缺省但需标注）。
3. 网络失败触发降级时有明确说明。
4. 最终报告引用了 raw/failure 路径。
