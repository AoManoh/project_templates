# Chrome CDP Skill 规范

## 1. 目标

本规范约束本地 Chrome remote debugging 的连接模式、授权边界、实例绑定、失败恢复和稳定复用策略。

为什么：这类技能最容易在“连上了”和“连对了”之间混淆。真正稳定的前提不是会发 CDP 命令，而是不会串到错误实例、不会把授权语义说错、不会因为 daemon 生命周期失控而反复重连。

---

## 2. 两种连接模式

### 2.1 isolated-instance mode

仅在用户明确允许启动独立浏览器实例时使用。适用于：

- 多 AI 并发
- 无人值守
- 长时间自动化
- 不希望污染用户日常浏览器

硬要求：

- 用非默认 `--user-data-dir`
- 用 `--remote-debugging-port=0`
- 通过该 profile 目录下的 `DevToolsActivePort` 发现真实 WebSocket 端点

### 2.2 shared-session mode

仅在用户明确需要现有浏览器状态时使用，例如现有登录态、已有页面上下文、人工调试现场。

如果任务目标是“连接已经打开的本地 Chrome / 当前窗口 / 现有 profile”，本模式是唯一允许路径。不得在 shared-session 握手失败后启动 isolated instance、Playwright、Puppeteer 或新的 headless 窗口当作兜底。

硬要求：

- 先在 `chrome://inspect/#remote-debugging` 开启 remote debugging
- 显式用户许可优先于自动化便利
- 多 profile / 多浏览器并存时必须显式设置 `CDP_PORT_FILE`

---

## 3. 授权边界

### 3.1 可写入 Skill 的硬表述

- remote debugging 的启用边界是浏览器 / profile 级
- 复用的最小稳定单位是已附着的 `page target` / tab 会话
- 同一已附着 tab 内的普通 URL 导航通常可复用原会话，不需要重新 attach
- 新 tab 是新 target，默认按新的首次 attach 处理
- daemon 退出、浏览器重启、target 销毁、显式 `stop` 都会打断复用

### 3.2 禁止表述

- 禁止承诺“某个窗口里任意一个 tab 授权一次后，该窗口所有 tab 永远免授权”
- 禁止承诺“任意 AI / 任意 Chrome 版本都一定只弹一次授权”
- 禁止把窗口当成权限和复用的权威边界

### 3.3 官方事实与工程推断

- 官方 Chrome 资料明确支持 remote debugging session 许可和 target 级 CDP attach
- 官方资料没有给出“窗口级授权继承”的保证
- 因此工程最佳实践必须写成“保持已附着 target 存活”，而不是“Chrome 天然记住整个窗口的授权状态”

---

## 4. 实例绑定合同

### 4.0 端点验证

- 只有裸端口信息时，必须先请求 `/json/version`
- 当 `DevToolsActivePort` 或 `CDP_WS_URL` 已提供 WebSocket 路径时，必须直接发起 WebSocket CDP 探针
- 返回有效 JSON 且包含 `webSocketDebuggerUrl`，或 direct WebSocket 能返回 CDP 命令响应，才可视为可用 Chrome DevTools endpoint
- `127.0.0.1:9222` 不是特殊真理源；它必须通过 HTTP discovery 或 direct WebSocket CDP 探针
- 禁止把“Chrome PID 占用某端口”等同于“该端口提供 CDP”
- 自动发现只能作为候选收集，不能绕过端点验证
- `/json/version` 返回空 404 只能说明 HTTP discovery 失败，不得推断“Chrome 没有打开窗口”

为什么：用户机器上可能存在普通 Chrome、代理、本地服务或 stale `DevToolsActivePort` 占用同一端口。未验证就连接会把“监听中”误判成“可调试”。

### 4.1 `CDP_PORT_FILE`

- 优先级最高
- 一旦显式设置，必须严格使用该路径
- 若文件不存在，必须直接失败，不允许静默回退到别的候选端口文件
- 若文件存在但 HTTP discovery 失败，必须继续尝试该文件第二行给出的 direct WebSocket endpoint
- 若 direct WebSocket 也失败，才可判定该端口文件不可用

为什么：显式绑定的目的就是防止连错实例。静默回退会把“用户指定实例”退化成“随机猜一个实例”。

### 4.1.1 `CDP_WS_URL`

- 可用于直接绑定已知 browser WebSocket endpoint
- 必须是 `ws://` 或 `wss://`
- 适用于用户或探针已经明确拿到 `webSocketDebuggerUrl` 的场景
- 设置后不得再自动寻找其他实例

### 4.2 `CDP_INSTANCE_NAME`

- 多实例、多 AI、多窗口并行时必须显式设置
- 必须参与 runtime 目录、daemon socket / pipe 命名、页面缓存命名空间隔离

为什么：否则多个 agent 会共享同一份 `pages.json` 和同名 socket，导致串线。

### 4.3 `CDP_IDLE_TIMEOUT_MS`

- 交互式默认可有限时
- 无人值守默认推荐 `CDP_IDLE_TIMEOUT_MS=0`

为什么：稳定免重复授权依赖持续 attach；idle 退出会导致后续重新 attach。

### 4.4 `CDP_HOST`

- 默认只允许 `127.0.0.1`
- Skill 不应鼓励远程暴露 Chrome debugging 端口
- 当 `CDP_HOST` 为本地回环地址时，必须绕过 shell 里的 `http_proxy` / `https_proxy` / `all_proxy`

### 4.4.1 `CDP_ENDPOINT_TIMEOUT_MS`

- 控制 `/json/version` 与 direct WebSocket 探针超时
- 默认值必须允许本地 Chrome 有短暂响应延迟
- shared-session 模式若出现 Chrome 授权 UI 或慢响应，可临时调高
- 超时只能说明当前探针未完成，不能说明浏览器窗口不存在

### 4.4.2 `CDP_ENDPOINT_RETRIES`

- 控制 direct WebSocket 探针重试次数
- 默认必须至少重试 2 次，避免首次握手慢响应造成误判
- 多次失败后仍需输出每类候选的失败原因

### 4.4.3 `CDP_DAEMON_CONNECT_TIMEOUT_MS`

- 控制 CLI 等待 per-tab daemon 完成首次 attach 的时间
- 默认值必须不短于 WebSocket connect timeout 与 CDP 命令 timeout 的组合
- shared-session 模式下不得因为 6 秒级短等待就宣称 daemon 启动失败

### 4.4.4 用户授权等待与握手节流

- shared-session 模式下，browser-level 命令（`doctor`、`list`、`windows`、`open`、`openwindow`、`incognito`）和 target-level 命令（`attach <target>`、首个 page 命令）都可能发出 Chrome debugging 握手请求
- 这些命令必须串行执行，禁止并行发起 `doctor/list/windows` 等多个握手探针
- 任一握手请求发出后，必须等待用户在 Chrome UI 中同意或拒绝
- 等待期间不得对同一 browser endpoint 或同一 target 反复发送新的 CDP 命令来制造新的握手请求
- 等待超时后，必须停止当前测试任务并提示用户查看当前 Chrome 窗口里的授权请求；不得把超时描述成“没有打开窗口”
- 超时后必须设置冷却期，冷却期内除 `help` 和 `stop` 外，任何 CDP 命令都应直接提示“已有授权请求可能待处理”，不得继续使用旧 daemon 做测试，也不得重新连接 browser WebSocket
- `CDP_ATTACH_APPROVAL_TIMEOUT_MS` 控制 daemon 等待 `Target.attachToTarget` 授权完成的时间
- `CDP_APPROVAL_COOLDOWN_MS` 控制授权等待超时后的重复握手抑制时间

为什么：Chrome shared-session 授权是用户显式动作。AI 反复重发握手会制造多个提示、干扰用户判断，并让“未点击同意”误判成连接失败。

### 4.5 运行中浏览器发现

- Linux 环境可扫描 `/proc/*/cmdline`，仅收集带 `--remote-debugging-port` 的 Chromium 系进程
- WSL 环境可通过 PowerShell 查询 Windows Chrome / Edge / Brave / Chromium / Vivaldi 进程命令行
- 若进程使用 `--remote-debugging-port=0`，必须通过同一进程的 `--user-data-dir` 定位 `DevToolsActivePort`
- 发现多个有效 endpoint 时必须要求显式绑定，不得随机选择
- 发现无效候选时应报告拒绝原因，例如 `/json/version` 返回 404、缺少 `webSocketDebuggerUrl`、direct WebSocket 超时或非 CDP 响应
- 如果检测到 Chrome / Edge / Brave 主进程但没有有效 endpoint，必须明确报告“浏览器已打开但没有验证到可复用 CDP WebSocket”

---

## 5. Chrome 136+ 约束

- 从 Chrome 136 起，`--remote-debugging-port` 和 `--remote-debugging-pipe` 对默认用户数据目录无效
- 使用 remote debugging port / pipe 时，必须配合非默认 `--user-data-dir`
- Skill 文档必须把这条写成强约束，不得写成“建议”

---

## 6. 标准工作流

1. 先决定使用 `isolated-instance mode` 还是 `shared-session mode`
2. 显式绑定 `CDP_PORT_FILE` 与 `CDP_INSTANCE_NAME`
3. 端点不明确时先运行 `doctor`，确认 HTTP discovery 或 direct WebSocket 探针通过验证
4. 运行 `list` 建立当前绑定下的 `pages.json`
5. 选取唯一 target 前缀
6. 运行 `attach <target>` 显式建立 page target daemon
7. 若 Chrome 弹出 debugging 授权请求，等待用户处理；超时后提示用户查看 Chrome，不得重复发送握手
8. 若授权等待超时，停止任务并向用户汇报；不得继续复用旧 daemon 进行测试
9. 授权成功后，后续命令全部复用该 target 的 daemon
10. 仅在真正结束时运行 `stop`

---

## 7. 失败分类与恢复动作

| 错误信号 | 含义 | 恢复动作 |
|----------|------|----------|
| `CDP_PORT_FILE is set but file not found` | 显式绑定路径错误或目标浏览器未启动 | 检查实例是否启动，确认路径是否正确 |
| `No DevToolsActivePort found` | 未启 remote debugging，或未使用正确 profile | 对 shared-session 开启 `chrome://inspect/#remote-debugging`；对 isolated-instance 用独立 profile 重新启动 |
| `Multiple DevToolsActivePort files found` | 当前机器存在多个候选实例 | 显式设置 `CDP_PORT_FILE` |
| `Invalid DevToolsActivePort file` | 浏览器仍在启动或端口文件损坏 | 短暂等待后重试；必要时重启实例 |
| `/json/version` 返回空 404 或非 JSON | HTTP discovery 失败；Chrome 可能仍已打开，且 direct WebSocket 可能仍可用 | 不要推断“没有窗口”；运行 `doctor`，让脚本继续 direct WebSocket 探针 |
| `/json/version` 和 direct WebSocket 都失败 | 该候选不是可用 Chrome DevTools endpoint，或端口文件已 stale | 绑定真实 `CDP_PORT_FILE` / `CDP_WS_URL`，或启动 isolated instance |
| 多个有效 DevTools endpoint | 多个浏览器/profile 同时启用了 remote debugging | 显式设置 `CDP_PORT_FILE`、`CDP_WS_URL` 和 `CDP_INSTANCE_NAME` |
| `Cached page list belongs to a different browser instance/binding` | 当前缓存来自别的实例 | 重新执行 `list` |
| localhost 连接无响应，但 `netstat` 显示端口存在 | 本地 CDP 流量被 shell 代理截走 | 绕过或清除 `http_proxy` / `https_proxy` / `all_proxy` 后重试 |
| `Daemon failed to start` | target 不存在、授权未完成、绑定错误或 daemon 未能 attach | 检查 target 是否仍存在；shared-session 下确认 Chrome UI；必要时重新 `list` |
| `Chrome debugging approval may already be pending` | browser endpoint 或 target 已发出授权请求且仍在冷却期 | 聚焦 Chrome 并处理授权提示；冷却期内不得重复发送握手，除 `help` / `stop` 外不得继续测试 |

---

## 8. 对任何 AI 的最小硬约束

1. 不得省略连接模式判断。
2. 不得在多实例环境中猜测端口文件。
3. 不得把授权复用说成窗口级承诺。
4. 不得把 9222 或任何监听端口当作 CDP，必须验证 HTTP discovery 或 direct WebSocket CDP 响应。
5. 不得跳过 `list -> target -> attach -> reuse daemon` 的顺序。
6. 不得在无人值守模式下默认让 daemon 因 idle 退出。
7. 不得在 Chrome 136+ 下对默认 profile 使用 remote debugging port。
8. 不得在用户要求连接已有本地 Chrome 时启动 Playwright、Puppeteer 或新的 headless 窗口作为兜底。
9. 不得在授权等待超时后持续重发同一 target 的握手请求；必须提示用户查看 Chrome 授权 UI 并等待冷却。
10. 不得把 isolated-instance mode 当作 shared-session 连接失败后的自动恢复手段；只有用户明确允许独立实例时才可启动。
11. 不得并行执行 shared-session 的握手探针；`doctor/list/windows/open/attach` 必须串行。
12. 授权等待超时后不得继续通过旧 daemon 执行页面测试；必须停止并汇报。
