# Chrome CDP Skill 规范

## 1. 目标

本规范约束本地 Chrome remote debugging 的连接模式、授权边界、实例绑定、失败恢复和稳定复用策略。

为什么：这类技能最容易在“连上了”和“连对了”之间混淆。真正稳定的前提不是会发 CDP 命令，而是不会串到错误实例、不会把授权语义说错、不会因为 daemon 生命周期失控而反复重连。

---

## 2. 两种连接模式

### 2.1 isolated-instance mode

默认模式。适用于：

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

### 4.1 `CDP_PORT_FILE`

- 优先级最高
- 一旦显式设置，必须严格使用该路径
- 若文件不存在，必须直接失败，不允许静默回退到别的候选端口文件

为什么：显式绑定的目的就是防止连错实例。静默回退会把“用户指定实例”退化成“随机猜一个实例”。

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

---

## 5. Chrome 136+ 约束

- 从 Chrome 136 起，`--remote-debugging-port` 和 `--remote-debugging-pipe` 对默认用户数据目录无效
- 使用 remote debugging port / pipe 时，必须配合非默认 `--user-data-dir`
- Skill 文档必须把这条写成强约束，不得写成“建议”

---

## 6. 标准工作流

1. 先决定使用 `isolated-instance mode` 还是 `shared-session mode`
2. 显式绑定 `CDP_PORT_FILE` 与 `CDP_INSTANCE_NAME`
3. 运行 `list` 建立当前绑定下的 `pages.json`
4. 选取唯一 target 前缀
5. 首个 page 命令触发 attach
6. 后续命令全部复用该 target 的 daemon
7. 仅在真正结束时运行 `stop`

---

## 7. 失败分类与恢复动作

| 错误信号 | 含义 | 恢复动作 |
|----------|------|----------|
| `CDP_PORT_FILE is set but file not found` | 显式绑定路径错误或目标浏览器未启动 | 检查实例是否启动，确认路径是否正确 |
| `No DevToolsActivePort found` | 未启 remote debugging，或未使用正确 profile | 对 shared-session 开启 `chrome://inspect/#remote-debugging`；对 isolated-instance 用独立 profile 重新启动 |
| `Multiple DevToolsActivePort files found` | 当前机器存在多个候选实例 | 显式设置 `CDP_PORT_FILE` |
| `Invalid DevToolsActivePort file` | 浏览器仍在启动或端口文件损坏 | 短暂等待后重试；必要时重启实例 |
| `Cached page list belongs to a different browser instance/binding` | 当前缓存来自别的实例 | 重新执行 `list` |
| localhost 连接无响应，但 `netstat` 显示端口存在 | 本地 CDP 流量被 shell 代理截走 | 绕过或清除 `http_proxy` / `https_proxy` / `all_proxy` 后重试 |
| `Daemon failed to start` | target 不存在、授权未完成、绑定错误或 daemon 未能 attach | 检查 target 是否仍存在；shared-session 下确认 Chrome UI；必要时重新 `list` |

---

## 8. 对任何 AI 的最小硬约束

1. 不得省略连接模式判断。
2. 不得在多实例环境中猜测端口文件。
3. 不得把授权复用说成窗口级承诺。
4. 不得跳过 `list -> target -> attach -> reuse daemon` 的顺序。
5. 不得在无人值守模式下默认让 daemon 因 idle 退出。
6. 不得在 Chrome 136+ 下对默认 profile 使用 remote debugging port。
