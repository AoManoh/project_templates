# Chrome CDP Skill 规范

## 1. 目标

本规范约束本地 Chrome remote debugging 的连接模式、授权边界、实例绑定、失败恢复和稳定复用策略。

为什么：这类技能最容易在“连上了”和“连对了”之间混淆。真正稳定的前提不是会发 CDP 命令，而是不会串到错误实例、不会把授权语义说错、不会因为 daemon 生命周期失控而反复重连。

---

## 2. 两种连接模式

### 2.1 isolated-instance mode

仅在用户明确要求或允许启动独立浏览器实例时使用。适用于：

- 多 AI 并发
- 无人值守
- 长时间自动化
- 不希望污染用户日常浏览器
- 用户明确要求“新建本地无痕浏览器 / 新开独立实例 / headless 测试”

硬要求：

- 用非默认 `--user-data-dir`
- 用 `--remote-debugging-port=0`
- 通过该 profile 目录下的 `DevToolsActivePort` 发现真实 WebSocket 端点
- 不得作为 shared-session 失败后的自动兜底
- 不得用于替代用户已有登录态、已有无痕窗口或当前调试现场

### 2.2 shared-session mode

仅在用户明确需要现有浏览器状态时使用，例如现有登录态、已有页面上下文、人工调试现场。

如果任务目标是“CDP 握手本地浏览器 / 连接已经打开的本地 Chrome / 当前窗口 / 现有 profile / 复用登录态 / 查看用户打开的文章”，本模式是唯一默认路径。不得在 shared-session 握手失败后启动 isolated instance、Playwright、Puppeteer 或新的 headless 窗口当作兜底。

硬要求：

- 先在 `chrome://inspect/#remote-debugging` 开启 remote debugging
- 显式用户许可优先于自动化便利
- 多 profile / 多浏览器并存时必须显式设置 `CDP_PORT_FILE`
- 没有验证到可复用 CDP endpoint 时，只能报告“现有浏览器未暴露可复用 endpoint”并要求绑定 `CDP_PORT_FILE` / `CDP_WS_URL`，不能新开浏览器替代

### 2.3 默认主线 Do / Not Do

| 用户表达 | Do | Not Do |
|----------|----|--------|
| “用 CDP 连接本地浏览器 / 握手本地浏览器 / 看我打开的页面” | 发现并绑定已有有头浏览器的 shared-session endpoint | 新开 isolated、headless、Playwright、Puppeteer |
| “复用登录态 / 当前窗口 / 已打开文章” | 绑定现有 profile，列出 target 后选择准确 tab | 用空 profile 打开同一 URL 假装完成 |
| “新建一个本地无痕浏览器并执行操作” | 启动独立实例或创建新的 incognito context，并显式标注它是新实例 | 混用用户现有 profile 或伪装为已有窗口 |
| “无人值守/多 agent/隔离测试” | isolated-instance mode | 连接用户日常浏览器造成污染 |

为什么：连接本地浏览器的价值通常在于用户状态、登录态和现场上下文。未经用户要求就新开浏览器，会把“连上了”误当成“连对了”。

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
- `DevToolsActivePort` 和 `CDP_WS_URL` 分支禁止先请求 `/json/version`；HTTP discovery 只能作为裸 `CDP_PORT` 或无 WebSocket 路径候选的验证方式
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
- 若文件存在，必须直接使用第二行给出的 direct WebSocket endpoint
- 不得先请求该端口的 `/json/version`
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
- 已 attach 的 target daemon 是后续 page 操作和必要 browser-level 操作的首选通道；`list/windows/open/openwindow/incognito` 在当前 binding 下发现可用 daemon socket 时，必须复用 daemon，不得重新连接 browser WebSocket

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
- browser WebSocket `open` 不等于握手完成；只有收到第一条 CDP 命令响应后，才允许清除该 browser endpoint 的 pending 状态
- 等待期间不得对同一 browser endpoint 或同一 target 反复发送新的 CDP 命令来制造新的握手请求
- 等待超时后，必须停止当前测试任务并提示用户查看当前 Chrome 窗口里的授权请求；不得把超时描述成“没有打开窗口”
- 超时后必须设置冷却期，冷却期内不得对同一 browser endpoint 或同一 target 重新发送握手；其他 scope 不得被全局阻断
- 冷却期间允许 `help`、`status`、`stop` 和 `clear-pending`；`clear-pending` 只能在用户已处理授权提示或确认 pending 已过时时使用
- `CDP_ATTACH_APPROVAL_TIMEOUT_MS` 控制 daemon 等待 `Target.attachToTarget` 授权完成的时间
- `CDP_APPROVAL_COOLDOWN_MS` 控制授权等待超时后的重复握手抑制时间

为什么：Chrome shared-session 授权是用户显式动作。AI 反复重发同一 scope 的握手会制造多个提示、干扰用户判断，并让“未点击同意”误判成连接失败；把冷却做成全局阻断又会污染无关 endpoint / target 的正常操作。

### 4.5 运行中浏览器发现

- Linux 环境可扫描 `/proc/*/cmdline`，仅收集带 `--remote-debugging-port` 的 Chromium 系进程
- WSL 环境可通过 PowerShell 查询 Windows Chrome / Edge / Brave / Chromium / Vivaldi 进程命令行
- 若进程使用 `--remote-debugging-port=0`，必须通过同一进程的 `--user-data-dir` 定位 `DevToolsActivePort`
- 发现多个有效 endpoint 时必须要求显式绑定，不得随机选择
- 发现多个候选 endpoint 时，不得逐个发起 browser WebSocket 探针；WebSocket 探针就是握手，必须先让用户或环境变量确认唯一候选
- 发现无效候选时应报告拒绝原因，例如 `/json/version` 返回 404、缺少 `webSocketDebuggerUrl`、direct WebSocket 超时或非 CDP 响应
- 如果检测到 Chrome / Edge / Brave 主进程但没有有效 endpoint，必须明确报告“浏览器已打开但没有验证到可复用 CDP WebSocket”

### 4.6 精准窗口与 target 选择

CDP 的选择必须分层，不能把 browser endpoint、window 和 tab 混成一个概念：

| 层级 | 含义 | 能证明什么 | 不能证明什么 |
|------|------|------------|--------------|
| browser endpoint / browser WebSocket | 一个启用 remote debugging 的浏览器实例或 profile | 连到了哪个调试端点 | 不能证明连到了用户想要的窗口或 tab |
| windowId | Chrome 返回的浏览器窗口编号 | 页面 target 所在窗口 | 不能作为跨浏览器实例的唯一标识 |
| targetId | 具体 page/tab target | 后续 attach 和 daemon 复用的最小稳定单位 | 不能代表整个窗口或 profile |
| browserContextId / `ctx` | 浏览器上下文 | 区分 default context 与非默认 context | 不能仅凭它判断用户意图，仍需 URL/title/windowId 辅助确认 |

精准握手规则：

1. 多个 browser endpoint 同时存在时，必须要求显式绑定 `CDP_PORT_FILE` / `CDP_WS_URL` / `CDP_INSTANCE_NAME`，不得按端口、进程顺序或缓存猜测。
2. 绑定唯一 endpoint 后，必须通过 `list` 或 `windows` 输出 target 表，展示 `targetId`、`windowId`、`ctx`、title、URL 和 bounds。
3. 用户要求“本地无痕那个窗口”时，先筛选非默认 `ctx`，再用 URL、title、windowId、bounds 或用户可见信息确认唯一 target；候选不唯一时必须暂停让用户选择。
4. 用户要求“有头本地窗口”时，headless 或无窗口 bounds 的候选默认不得作为匹配目标；除非用户明确点名 headless。
5. 用户要求“登录态/已打开页面”时，不得打开同 URL 的新 tab/new profile 代替；必须 attach 用户已打开的目标 target。
6. attach 成功后，后续 page 操作必须沿同一 target daemon 继续，直到用户要求切换 target 或 target 销毁。

为什么：实际机器上可能同时存在有痕、有无痕、headless、测试 profile、MCP 自带浏览器和多个 AI 实例。只有分层绑定并在 target 层确认唯一目标，才能避免“握手成功但握错对象”。

---

## 5. Chrome 136+ 约束

- 从 Chrome 136 起，`--remote-debugging-port` 和 `--remote-debugging-pipe` 对默认用户数据目录无效
- 使用 remote debugging port / pipe 时，必须配合非默认 `--user-data-dir`
- Skill 文档必须把这条写成强约束，不得写成“建议”

---

## 6. 标准工作流

1. 先判定用户意图：默认 shared-session；只有用户明确要求新建独立实例时才进入 isolated-instance mode
2. 先运行 `status` 查看本 runtime 是否存在缓存或 pending；`status` 不得发起握手
3. 端点不明确时运行 `doctor`，确认裸端口 HTTP discovery 或 direct WebSocket 探针通过验证；显式绑定存在时，`doctor` 不得扫描其他自动发现候选
4. 若存在多个有效 endpoint，停止并要求显式绑定 `CDP_PORT_FILE` / `CDP_WS_URL` / `CDP_INSTANCE_NAME`
5. 运行 `list` 或 `windows` 建立当前绑定下的 `pages.json`
6. 根据 `targetId`、`windowId`、`ctx`、title、URL、bounds 选取唯一 target；候选不唯一必须让用户选择
7. 运行 `attach <target>` 显式建立 page target daemon
8. 若 Chrome 弹出 debugging 授权请求，等待用户处理；超时后提示用户查看 Chrome，不得重复发送同一 scope 的握手
9. 若授权等待超时，停止任务并向用户汇报；不得继续复用旧 daemon 进行测试
10. 授权成功后，后续命令全部复用该 target 的 daemon
11. 仅在真正结束时运行 `stop`
12. `attach` 成功后，禁止把 `doctor/list/windows` 当作循环状态检查；需要页面信息时使用同一 target 前缀执行 page command

---

## 7. 失败分类与恢复动作

| 错误信号 | 含义 | 恢复动作 |
|----------|------|----------|
| `CDP_PORT_FILE is set but file not found` | 显式绑定路径错误或目标浏览器未启动 | 检查实例是否启动，确认路径是否正确 |
| `No DevToolsActivePort found` | 未启 remote debugging，或未使用正确 profile | 对 shared-session 开启 `chrome://inspect/#remote-debugging`；对 isolated-instance 用独立 profile 重新启动 |
| `Multiple DevToolsActivePort files found` | 当前机器存在多个候选实例 | 显式设置 `CDP_PORT_FILE` |
| `Invalid DevToolsActivePort file` | 浏览器仍在启动或端口文件损坏 | 短暂等待后重试；必要时重启实例 |
| `/json/version` 返回空 404 或非 JSON | 裸端口 HTTP discovery 失败；Chrome 可能仍已打开，且 direct WebSocket 可能仍可用 | 不要推断“没有窗口”；若已有 `DevToolsActivePort` / `CDP_WS_URL`，必须改走 direct WebSocket |
| direct WebSocket 失败 | 该候选不是可用 Chrome DevTools endpoint，或端口文件已 stale | shared-session 下绑定真实 `CDP_PORT_FILE` / `CDP_WS_URL`；只有用户明确要求新建实例时才启动 isolated instance |
| 多个有效 DevTools endpoint | 多个浏览器/profile 同时启用了 remote debugging | 显式设置 `CDP_PORT_FILE`、`CDP_WS_URL` 和 `CDP_INSTANCE_NAME` |
| `Cached page list belongs to a different browser instance/binding` | 当前缓存来自别的实例 | 重新执行 `list` |
| localhost 连接无响应，但 `netstat` 显示端口存在 | 本地 CDP 流量被 shell 代理截走 | 绕过或清除 `http_proxy` / `https_proxy` / `all_proxy` 后重试 |
| `Daemon failed to start` | target 不存在、授权未完成、绑定错误或 daemon 未能 attach | 检查 target 是否仍存在；shared-session 下确认 Chrome UI；必要时重新 `list` |
| `Chrome debugging approval may already be pending` | browser endpoint 或 target 已发出授权请求且仍在该 scope 冷却期 | 聚焦 Chrome 并处理授权提示；冷却期内不得对同一 scope 重复发送握手；用 `status` 查看，用 `clear-pending` 清理已确认过时的记录 |

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
13. 不得在 `DevToolsActivePort` / `CDP_WS_URL` 已知时先访问 `/json/version`。
14. 不得在 target daemon 已存在时为 `list/windows/open/openwindow/incognito` 重新建立 browser WebSocket；必须先复用 daemon。
15. 不得把 browser WebSocket `open` 当作握手完成；必须等到第一条 CDP 响应。
16. 不得把“本地浏览器握手”理解成“新开一个浏览器”；默认必须先找用户已打开的本地有头浏览器。
17. 不得在多个 browser endpoint、多个 window 或多个 target 候选中自动猜测；必须显式绑定或让用户选择。
18. 不得用新打开的 URL、新 profile、headless 或 isolated 实例代替用户要求的已有登录态、已有无痕窗口或当前页面。
