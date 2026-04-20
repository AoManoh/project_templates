# 质量保障 Skill

**skill_id**: `code-review`
**版本**: 1.0.0
**output_dir**: `docs/code-review/`

---

## 1. 概述

本技能定义 AI Agent 执行质量保障活动（E2E 测试、API 测试、静态代码审查）的标准流程，使 AI Agent 能够系统化地发现问题、采集证据、追溯根因并生成规范化报告。

### 1.1 触发条件

| 触发方式 | 条件 |
|----------|------|
| 显式触发 | 用户指令包含关键词（见下表） |

| 关键词 | 活动类型 |
|--------|---------|
| `测试`、`E2E`、`端到端` | E2E 界面测试 |
| `code review`、`代码审查` | 静态代码审查 |
| `API 测试`、`接口测试` | API 接口测试 |
| `bug`、`问题`、`缺陷` | 问题记录 |

### 1.2 前置依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| Chrome MCP | 浏览器自动化操作、截图、网络监控 | E2E/API 测试必需 |
| Augment Codebase | 源码检索、根因追溯 | 所有活动必需 |
| view 工具 | 读取源码文件确认 | 所有活动必需 |
| Codex CLI | 多模型交叉审查与复核 | 静态代码审查推荐 |

### 1.3 关联规范

报告格式标准详见：[SPEC.md](./SPEC.md)
Codex 执行编排详见：[../codex-orchestration/SKILL.md](../codex-orchestration/SKILL.md) 与 [../codex-orchestration/SPEC.md](../codex-orchestration/SPEC.md)
目录快速参考见：[../../docs/code-review/README.md](../../docs/code-review/README.md)

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| 读取 SPEC.md | 开始测试前 |
| 写入报告或 Codex 审查产物前，必须先确认项目根为当前 `AGENTS.md` 所在目录；所有 `docs/code-review/*` 路径相对该目录解析 | 创建报告前 |
| 获取真实时间（中国上海时间） | 创建报告前 |
| 按本 SKILL.md 流程执行测试 | 测试过程中 |
| 按 SPEC.md 格式生成报告 | 测试完成后 |
| 每个问题必须包含 5 要素 | 记录问题时 |
| 每个问题必须附带证据 | 记录问题时 |
| 使用 Codex CLI 前，必须先读取 codex-orchestration 的 SKILL/SPEC | 调用前 |
| 触发 Codex CLI 审查时，Prompt 必须先落盘到 `docs/code-review/_inputs/` | 调用 `codex exec` 前 |
| Codex 原始输出必须写入 `docs/code-review/_codex_raw/` | 调用 `codex exec` 时 |
| Codex 执行失败必须写入 `docs/code-review/_codex_failures/` | 执行失败时 |
| Codex 执行后必须校验输出文件非空，失败至少重试一次 | 执行后 |

---

## 3. 快速参考

### 3.1 编号前缀

| 前缀 | 活动类型 | 示例 |
|------|---------|------|
| CR-xxx | 静态代码审查 | CR-001: 缺少数据库唯一约束 |
| E2E-xxx | E2E 界面测试 | E2E-001: 审核按钮点击无响应 |
| API-xxx | API 接口测试 | API-001: 创建接口返回 422 |

编号在单份报告内自增，跨报告不要求全局唯一。

### 3.2 严重程度速查

| 等级 | 标记 | 一句话判断 |
|------|------|-----------|
| 阻塞 | [阻塞] | 核心流程中断，无法绕过 |
| 高 | [高] | 核心流程受损，有临时绕过方案 |
| 中 | [中] | 非核心流程异常，或有性能/安全隐患 |
| 低 | [低] | UI 瑕疵、文案错误、代码规范 |

### 3.3 生命周期状态

```
待确认 --> 已确认 --> 修复中 --> 已修复 --> 已验证 --> 已关闭
```

### 3.4 5 要素速查

每个问题条目必须回答：

1. **在哪发现的？** - 环境 + 页面 + 组件
2. **怎么触发的？** - 可复现的操作步骤
3. **期望什么？** - 需求定义的正确行为
4. **实际怎样？** - 偏离期望的具体表现
5. **为什么会这样？** - 源码级根因追溯

### 3.5 报告文件命名

```
docs/code-review/YYYY-MM-DD-{scope}.md
```

| 测试类型 | scope 格式 | 示例 |
|----------|-----------|------|
| 单页面 E2E | 页面名称（kebab-case） | hazard-audit |
| 多页面 E2E | 功能模块名称 | regulation-module |
| API 测试 | api-{模块名} | api-hazards |
| 代码审查 | cr-{分支名或范围} | cr-shared-branch |

### 3.6 证据采集优先级

1. 网络请求/响应（最客观的证据）
2. 页面快照（a11y tree，可机器解析）
3. 截图（视觉证据）
4. 控制台日志（运行时错误）
5. 源码片段（根因定位）

### 3.7 Codex CLI 执行规范（静态审查）

| 项目 | 约束 |
|------|------|
| Prompt 输入目录 | `docs/code-review/_inputs/*.prompt.md` |
| 原始输出目录 | `docs/code-review/_codex_raw/*.md` |
| 失败记录目录 | `docs/code-review/_codex_failures/*.md` |
| 默认超时 | `1200s`（快速检查 `600s`，大范围审查 `1800s`） |
| 默认心跳 | `20s`（用于输出运行中状态，避免误判卡住） |
| 默认重试 | 失败自动重试 `1` 次（建议 `>=1`，否则无法触发“连续 2 次网络失败”判定） |
| Prompt 传入方式 | 必须通过 stdin（`codex exec ... - < <prompt_file>`） |
| 通用执行脚本 | `skills/codex-orchestration/scripts/run_codex_exec.sh` |
| 细则维护边界 | `AGENTS.md` 仅保留摘要，Codex 执行细则以 `skills/codex-orchestration/{SKILL,SPEC}.md` 为准 |
| 代理策略（非交互） | `launch-process` 非交互执行时，优先显式传 `--proxy-port` 或 `--proxy-url`，不要依赖 `.bashrc` 里的 `codex()` 函数 |
| 外层超时缓冲 | 若通过 `launch-process` 调用，`max_wait_seconds >= --timeout + 30s`；或使用 `wait=false` + 轮询 |
| 网络失败降级阈值 | 单次脚本调用内连续 2 次网络型失败（`timeout_with_partial_stream_output` / `network_unstable_after_retries` / 日志含 `reconnect`）后直接降级人工审查 |

**推荐命令**：

```bash
bash skills/codex-orchestration/scripts/run_codex_exec.sh \
  --scope cr-shared-branch \
  --prompt-file docs/code-review/_inputs/cr-shared-branch.prompt.md \
  --raw-dir docs/code-review/_codex_raw \
  --failure-dir docs/code-review/_codex_failures \
  --proxy-port 7899 \
  --timeout 1200 \
  --heartbeat 20 \
  --retries 1
```

兼容入口（已有流程可不改）：

```bash
bash scripts/codex/run_code_review.sh \
  --scope cr-shared-branch \
  --prompt-file docs/code-review/_inputs/cr-shared-branch.prompt.md \
  --timeout 1200 \
  --heartbeat 20 \
  --retries 1
```

恢复提示：`codex exec resume <session_id> - < <prompt_file>` 通常不要附加 `-o/-s` 参数。

---

## 4. Skill 定义

### 4.1 prepare_test_environment

**目的**: 确认测试环境就绪，采集环境基线信息

**执行步骤**:
1. 使用 Chrome MCP navigate_page 访问前端地址
2. 使用 take_snapshot 采集初始页面状态
3. 使用 list_network_requests 确认前后端通信正常
4. 使用 list_console_messages 检查是否有启动时错误
5. 记录环境基线信息

**失败处理**: 如果环境不就绪，终止测试并记录环境问题

### 4.2 navigate_to_target

**目的**: 导航到目标测试页面

**执行步骤**:
1. 使用 take_snapshot 获取当前页面状态
2. 在快照中定位目标导航元素
3. 使用 click 点击导航元素
4. 使用 wait_for 等待目标页面加载完成
5. 使用 take_snapshot 确认已到达目标页面

### 4.3 discover_interactive_elements

**目的**: 发现页面中所有可交互元素

**执行步骤**:
1. 使用 take_snapshot 获取完整页面 a11y tree
2. 提取所有可交互元素（button、link、input/select/textarea、带 click handler 的元素）
3. 对每个元素记录：uid、文本标签、元素类型、是否可见、是否禁用

### 4.4 test_interactive_element

**目的**: 测试单个可交互元素的行为

**执行步骤**:
1. **操作前**：
   - take_snapshot 记录操作前页面状态
   - list_network_requests 记录当前网络请求基线
   - list_console_messages 记录当前控制台基线
2. **执行操作**：
   - click 点击目标元素
   - 等待响应（wait_for 或固定等待）
3. **操作后**：
   - take_snapshot 记录操作后页面状态
   - list_network_requests 对比新增的网络请求
   - list_console_messages 对比新增的控制台消息
   - take_screenshot 截取当前页面
4. **结果判定**：
   - 对比操作前后的页面状态变化
   - 检查网络请求是否成功（状态码 2xx）
   - 检查控制台是否有新增错误
   - 判定是否符合预期行为

### 4.5 trace_root_cause

**目的**: 对发现的问题进行源码级根因追溯

**执行步骤**:
1. **前端追溯**：
   - 从网络请求的 URL 出发，使用 Augment Codebase 检索前端 API 调用代码
   - 使用 view 工具确认源码内容（避免缓存不一致）
   - 追溯调用链：组件 -> store/composable -> API 函数
2. **后端追溯**（如果网络请求返回错误）：
   - 从 API 路由出发，使用 Augment Codebase 检索后端路由处理函数
   - 使用 view 工具确认源码内容
   - 追溯调用链：路由 -> 服务层 -> 数据层
3. **根因定位**：
   - 确定直接原因（哪行代码导致了问题）
   - 分析深层原因（为什么代码会写成这样）

**关键约束**:
- Augment Codebase 检索后，必须用 view 工具读取真实文件确认
- 如果 Augment Codebase 调用失败，重试一次后改用 view 工具直接读取

### 4.6 generate_bug_report

**目的**: 将测试结果和根因分析组装为符合 SPEC.md 规范的 Bug 报告

**执行步骤**:
1. 按 SPEC.md 的报告头部模板生成报告信息
2. 对每个失败的测试结果：
   - 分配编号（E2E-xxx / API-xxx / CR-xxx）
   - 评估严重程度
   - 按 5 要素模板填充问题条目
   - 嵌入证据引用
3. 生成问题汇总表
4. 生成测试覆盖表
5. 组装完整报告

**输出**: 符合 SPEC.md 规范的完整 Markdown 报告文件，写入 `docs/code-review/`

### 4.7 run_codex_cli_review

**目的**: 用 Codex CLI 生成可追溯的静态审查原始结果，并进行执行校验。

**执行步骤**:
1. 生成并落盘 Prompt 文件到 `docs/code-review/_inputs/`。
2. 执行 `skills/codex-orchestration/scripts/run_codex_exec.sh` 调用 Codex CLI（或兼容入口 `scripts/codex/run_code_review.sh`）。
3. 校验原始输出文件存在且非空。
4. 如果失败，检查 `docs/code-review/_codex_failures/` 中失败记录并在报告中标注执行状态。
5. 若失败记录包含 `session_id`，可使用 `codex exec resume <session_id> - < <prompt_file>` 恢复。
6. 若连续 2 次网络型失败，停止继续重试，降级为人工审查并在报告中说明降级原因。

**关键约束**:
- 不允许仅使用 `/tmp` 作为最终产物目录。
- 不允许把长 Prompt 直接拼接在命令行中。
- 对“有流式日志输出但最终超时”的情况，按“部分输出失败”处理，不得记为“无输出”。

---

## 5. Skill 编排流程

### 5.1 E2E 界面测试完整流程

```
1. prepare_test_environment（环境准备）
   |
2. navigate_to_target（导航到目标页面）
   |
3. discover_interactive_elements（发现可交互元素）
   |
4. for each element（遍历每个元素）:
   |-- test_interactive_element（测试元素行为）
   |-- if fail: trace_root_cause（根因追溯）
   |
5. generate_bug_report（生成报告）
```

### 5.2 API 接口测试流程

```
1. prepare_test_environment（环境准备）
   |
2. 构造 API 请求（正常参数 + 边界参数 + 异常参数）
   |
3. 发送请求并采集响应
   |
4. 对比响应与 API 文档定义
   |
5. if fail: trace_root_cause（后端根因追溯）
   |
6. generate_bug_report（生成报告）
```

### 5.3 静态代码审查流程

```
1. 确定审查范围（变更文件列表）
   |
2. 生成 Prompt 文件（写入 `docs/code-review/_inputs/`）
   |
3. run_codex_cli_review（生成原始审查结果）
   |
4. for each file（遍历每个文件）:
   |-- 使用 Augment Codebase 检索相关代码
   |-- 使用 view 工具读取完整文件
   |-- 检查：安全性、性能、数据一致性、错误处理、代码规范
   |
5. for each issue（遍历每个问题）:
   |-- trace_root_cause（根因追溯）
   |
6. generate_bug_report（生成报告）
```

---

## 6. 错误处理

### 6.1 Skill 执行失败处理

| 错误类型 | 处理方式 |
|----------|---------|
| 页面加载超时 | 重试一次，仍失败则记录为环境问题 |
| 元素不可点击 | 记录为 UI 问题（元素被遮挡或禁用） |
| 网络请求超时 | 记录为后端问题 |
| Augment Codebase 失败 | 重试一次，仍失败则用 view 工具直接读取 |
| 截图失败 | 用 take_snapshot 文本快照替代 |
| Codex 执行超时（exit code 124） | 提升超时到 `1200~1800s` 并自动重试一次，仍失败则写入 `docs/code-review/_codex_failures/` |
| Codex 有流式输出但最终超时 | 归类为“部分输出失败”，保留日志和 `session_id`，可尝试 `resume` |
| Codex 连续网络失败（2 次） | 判定为网络不可达，立即降级人工审查（不继续无效重试） |
| Codex 输出为空或缺失 | 记录执行失败，禁止进入“审查完成”状态 |
| Prompt 引号/转义错误 | 改为 Prompt 文件输入并使用包装脚本重试 |

### 6.2 测试中断恢复

如果测试过程中出现不可恢复的错误：
1. 记录已完成的测试结果
2. 记录中断原因
3. 生成部分报告（标记报告状态为"中断"）
4. 向用户报告中断情况

---

## 7. 证据采集最佳实践

### 7.1 截图策略

| 场景 | 截图时机 | 说明 |
|------|---------|------|
| 页面加载完成 | navigate_to_target 后 | 基线截图 |
| 操作前 | test_interactive_element 步骤 1 | 操作前状态 |
| 操作后 | test_interactive_element 步骤 3 | 操作后状态 |
| 错误弹窗 | 检测到 dialog 时 | 错误证据 |

### 7.2 网络请求采集策略

| 关注点 | 判断标准 | 说明 |
|--------|---------|------|
| 请求是否发出 | 操作前后 network_requests 对比 | 按钮点击后是否触发了 API 调用 |
| 请求参数是否正确 | get_network_request 查看请求体 | 前端是否传了正确的参数 |
| 响应状态码 | 2xx 为正常 | 4xx/5xx 为异常 |
| 响应体内容 | get_network_request 查看响应体 | 后端返回的数据是否符合预期 |

### 7.3 控制台日志采集策略

| 日志类型 | 关注级别 | 说明 |
|----------|---------|------|
| error | 必须记录 | 运行时错误，通常是 Bug |
| warn | 按需记录 | 可能是潜在问题 |
| log/info | 忽略 | 正常日志 |
