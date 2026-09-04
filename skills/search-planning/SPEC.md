# 搜索规划 Skill 规范

**版本**: 1.3.0
**适用范围**: comparative / exploratory / analytical 类多步调研的规划阶段

---

## 1. 目标

本规范定义搜索规划阶段的字段、约束和归档格式。

为什么：当一个问题需要多次搜索、跨源对比时，最容易出现的失败不是"搜不到"，而是"搜得发散"——要么 sq 之间互相重叠浪费配额，要么 sq 边界过宽永远收不了口。本规范要求在执行前先把"打算怎么搜"写下来，把发散控制在规划阶段。

---

## 2. 6 阶段字段约束

| 阶段 | 名称 | 必填字段 | 退出条件 |
|------|------|----------|----------|
| 1 | `intent` | `core_question`, `query_type`, `time_sensitivity` | 三字段都已填 |
| 2 | `complexity` | `level`, `estimated_queries`, `estimated_calls`, `justification` | `level` ∈ {1, 2, 3}，估算非 0 |
| 3 | `sub_queries` | 每个 sq 的 `id`, `goal`, `expected_output`, `boundary`；有前置的 sq 加 `depends_on` | 每个 boundary 通过 §5 反模式自检 |
| 4 | `search_terms` | 每个 term 的 `term`(≤ 8 词), `purpose`(= sq id), `round` | 每个有 `tool_hint` 的 sq 至少 1 个 `round=1` 词 |
| 5 | Tool mapping | 每个需要检索的 sq 的 `tool_hint`, `reason` | 每个 sq 要么有 `tool_hint`，要么标明为综合类 sq（不调用检索工具） |
| 6 | `execution` | `parallel_groups`, `sequential`, `estimated_rounds` | `parallel_groups` 覆盖全部 sq，同组成员间无 `depends_on` 关系；`estimated_rounds` = 组数 |

阶段名称 `intent` / `complexity` / `sub_queries` / `search_terms` / `execution` 与字段名采用 openscry `research_plan` 输出的字段名。Phase 5 在 `research_plan` 输出中没有顶层字段，`tool_hint` 位于每个 `sub_queries[]` 元素内，本表保留名称 Tool mapping。本表字段与 `research_plan` 输出的逐项对应以 §9.4 为准。

可选字段的格式：

- `depends_on`：字符串，多个前置 sq id 用英文逗号连接（如 `sq1,sq2`）；没有前置的 sq 不带该字段。
- `tool_hint`：取值 `web_search` / `web_fetch` / `web_map`；综合 / 归纳类 sq（只基于前置 sq 的结果作答）不带该字段，执行时不调用检索工具。
- `unverified_terms` / `premise_valid` / `approach` / `reason` / `params` / `estimated_rounds`：本规范定义的字段，`research_plan` 不输出，由规划者补填。

---

## 3. 归档模板

`docs/references/YYYY-MM-DD-{scope}.md` 推荐结构：

```markdown
# {scope} 调研规划与执行记录

## 报告信息

| 项 | 值 |
|---|---|
| 日期 | YYYY-MM-DD |
| 复杂度 | L1 / L2 / L3 |
| 触发场景 | requirements / refactor / code-review / debug / 其他 |
| 计划状态 | 仅规划 / 已执行 / 部分执行 |
| 工具版本 | （配置了 openscry MCP 时）`get_config_info` 输出的 `version` / `model` / `search_tools` |

## Phase 1 — `intent`

- core_question: ...
- query_type: factual / comparative / exploratory / analytical
- time_sensitivity: realtime / recent / historical / irrelevant
- domain: (可选)
- unverified_terms: (可选)
- premise_valid: true / false

## Phase 2 — `complexity`

- level: L?
- estimated_queries: N
- estimated_calls: N
- justification: 一句话

## Phase 3 — `sub_queries`

| id | goal | expected_output | boundary | depends_on |
|---|---|---|---|---|
| sq1 | ... | ... | ... | - |
| sq2 | ... | ... | ... | - |
| sq3 | ... | ... | ... | sq1,sq2 |
| sq4 | 综合 sq1-sq3 的结果给出结论 | ... | 不做额外检索 | sq1,sq2,sq3 |

## Phase 4 — `search_terms`（L2+）

approach: broad_first / narrow_first / targeted

| term | purpose | round |
|---|---|---|
| ... | sq1 | 1 |

## Phase 5 — Tool mapping（L2+）

| sq | tool_hint | reason | params |
|---|---|---|---|
| sq1 | web_search | ... | platform=GitHub |
| sq4 | - | 综合类 sq，只读取 sq1-sq3 的结果，不调用检索工具 | - |

## Phase 6 — `execution`（L3）

- parallel_groups: [[sq1, sq2], [sq3], [sq4]]
- sequential: [sq3, sq4]
- estimated_rounds: 3
- strategies: （规划来自 `research_plan` 时原样附上 `fetch_before_claim` / `gap_check` / `fallback_plan`）

## 执行结果

| sq | 工具 | 命中信源 / URL | 可信度 | 备注 |
|---|---|---|---|---|
| sq1 | web_search | https://... | 高 / 中 / 低 | ... |

## 结论

（一句话回答 core_question；多段时使用列表）
```

L1 调研可省略 Phase 4 - 6 章节，但 "执行结果" 与 "结论" 仍建议保留。

表格中的 `-` 表示该 sq 没有该字段：Phase 3 的 `depends_on` 为 `-` 即没有前置；Phase 5 的 `tool_hint` 为 `-` 即综合类 sq，不调用检索工具。Phase 6 示例中 sq3、sq4 同时出现在 `parallel_groups` 的后两组和 `sequential` 里，`estimated_rounds` 等于 `parallel_groups` 的组数 3。

---

## 4. 复杂度评级

| 启发式 | L1 | L2 | L3 |
|---|---|---|---|
| 搜索次数 | 1-2 | 3-5 | ≥ 6 |
| 引用深度 | 1 source / claim 即可 | 推荐 2+ source / claim | 必须跨源互证 |
| 输出形态 | 单段 / 单格 | 多段答复 | 长篇含对比表 |

两条启发式不一致时，取较高的。出现以下任一信号时，自动 ≥ L2：

- `unverified_terms` 非空
- `query_type` 是 `comparative` 或 `analytical`
- 用户明确要求"对比 / 调研 / survey"

---

## 5. 子查询边界反模式

| 反模式 | 为什么失败 |
|---|---|
| 仅复述领域名（"研究 X"） | 不能与兄弟互斥 |
| 与其他 sq 重叠的语义（"背景与现状"） | 现状 sq 已存在 |
| 不可证伪 / 不收敛（"任何与 X 相关的"） | 无终止条件 |
| 跨期混淆（"X 的过去和未来"） | 时间维度未拆分 |

好的 boundary 写"这个 sq 拒绝回答什么 + 谁负责"。

---

## 6. 退出门禁

规划生成后退出前，必须满足：

| 类别 | 退出要求 |
|------|----------|
| 完整性 | 按复杂度走完对应阶段（L1: 1-3，L2: 1-5，L3: 1-6） |
| 字段 | §2 必填字段全部已填 |
| 互斥 | 子查询 boundary 互不包含，全部通过 §5 反模式自检 |
| 工具 | L2+ 每个需要检索的 sq 已映射到 `web_search` / `web_fetch` / `web_map` 之一；综合类 sq 已标明不调用检索工具 |
| 归档 | 中大型调研已落 `docs/references/YYYY-MM-DD-{scope}.md` |
| 验证 | 执行阶段记录至少 1 个真实信源（含 URL） |

---

## 7. 禁止清单

1. 跳过复杂度评级直接动手搜。
2. 子查询用领域名当 boundary。
3. 同一 sq 把多个 round 词塞成一个长查询。
4. 在 `parallel_groups` 的同一组中放有 `depends_on` 关系的 sq。
5. 大型调研只保留最终结论，丢掉 6 阶段过程产物。
6. 把训练数据里的"知道"当作信源——必须有可访问的 URL。
7. 传入 `extra_sources` 且同一批并发超过 3 条时不评估 Tavily / Firecrawl 配额。
8. 为没有 `tool_hint` 的综合类 sq 调用检索工具，或用它的 `search_terms` 条目发起检索。

---

## 8. 与外部事实源的关系

| 层级 | 唯一事实源 | 本规范的关系 |
|------|--------------|--------------|
| 工具契约 | openscry 的 `tools/list` 与 CHANGELOG | §9 是 openscry 的使用说明，不是工具契约；两者不一致时改 §9。§2 的阶段名与字段名取自 `research_plan` 输出，`research_plan` 输出字段改名时按 §9.4 同步 §2 |
| 方法论 | 本规范自身（§2 - §7） | 6 阶段字段、复杂度评级、边界反模式、退出门禁、归档模板以本规范为准 |
| 客户端调用 | 各客户端文档（Cursor / Windsurf / Claude Code 的 MCP 配置） | 本规范不与具体客户端绑定；客户端 prefix（如 `mcp5_web_search`）只在客户端文档中作为示例 |

变更原则：

- 工具契约变化（新增工具、参数或输出字段改名）：以 openscry 的 `tools/list` 与 CHANGELOG 为准，§9 同步，并更新 §9 的绑定版本
- 方法论调整（边界反模式、退出门禁、归档模板）：以本规范为唯一事实源
- 客户端 prefix 变化：不影响本规范

openscry 服务端的安装、部署、环境变量与 API key 管理不在本规范范围内。

---

## 9. openscry MCP 调用规范

**读取条件**：仅当项目配置了 openscry MCP 时读取本章。未配置 openscry MCP 的项目跳过本章：仍按 §2 - §8 的字段规划，把工具调用换成项目实际可用的检索工具。

**事实源**：openscry 的 `tools/list` 与 CHANGELOG 是工具契约（工具名、参数名、输出字段、尾注格式）的事实源。本章是使用说明，只规定怎样调用才能取得高质量、可核验的检索结果。两者不一致时改本章，不为迎合本章改 openscry。

**绑定版本**：openscry **v0.2.1**。`get_config_info.version` 应输出 `v0.2.1`；不一致时先核对本章与工具的差异，以工具为准。openscry 每次发版（CHANGELOG 新条目）后，维护者按 §9.1 逐项复核本章，并更新本段的绑定版本。

**实测数字来源**：本章的实测数字来自 2026-09-03 对 openscry v0.2.1 的端到端评测（下称"评测"）。评测报告位于 openscry 项目仓库，不在本仓库内；括注中的"评测 §2.4"等编号指该报告的章节，供持有 openscry 仓库的读者核对。本章只收录有评测数据或 openscry 使用记录支持的做法。

### 9.1 工具契约（openscry v0.2.1 `tools/list`）

`*` 表示必填参数。

| 工具 | 必填 / 可选参数 | 用途 | 输出要点 |
|---|---|---|---|
| `web_search` | `query`*；`platform`（如 GitHub）、`model`、`extra_sources` | 一次联网检索，返回带引用的答案 | 正文内联 `[[n]](url)`；`Sources (N)` 列表；尾注 `> model:`、`> tools: N server-side calls`、`> elapsed:`；有告警时 `> warning:`；传了 `extra_sources` 时 `> extra_sources: requested N, added M, K duplicated model sources[, failed: …]` |
| `web_search_batch` | `queries`*（最多 32 条）；同上可选参数 | 多个互不依赖的问题并发检索 | JSON：每条 `status`（ok / error / skipped）、`content`、`sources`、`sources_count`、`server_tool_calls`、`elapsed_s`、`warning` |
| `web_fetch` | `url`*；`timeout` | 取一个已知 URL 的正文（Markdown） | 首行 `<!-- openscry web_fetch: tier=tavily\|firecrawl\|grok\|http url=… [fetched=…] -->`；GitHub blob/raw 页自动改写为 raw 文件 |
| `web_map` | `url`*；`max_depth`、`max_breadth`、`limit`、`instructions`、`timeout` | 枚举站点 URL 结构 | JSON：`urls`、`count`、`tier` |
| `research_plan` | `question`*；`timeout` | 离线生成调研规划（不联网） | JSON，结构见 §9.4；含 `elapsed_s` |
| `submit_search_task` | `kind`*（web_search / web_search_batch）；`query` 或 `queries`；可选同 `web_search` | 后台执行长检索，立即返回 `task_id` | `state` 起始为 queued |
| `get_search_task_result` | `task_id`*；`wait`（Go 时长，最大 5m） | 读取 / 长轮询任务结果 | `state`、`result`（结构同上）、时间戳为 UTC |
| `list_search_tasks` | `states`、`kinds` | 列任务 | 最早的在前 |
| `cancel_search_task` | `task_id`*；`hint` | 取消排队 / 运行中的任务 | 终态任务原样返回 |
| `get_config_info` | 无 | 查看版本、模型、工具声明、Tavily / Firecrawl 是否启用、上游连通性 | 不返回任何密钥 |

以下名称在 openscry v0.2.1 中不存在；规划或归档中遇到即按实际名称改写：

- `research_plan` 输出中的字段名 `queries` / `tool`。实际字段名为 `sub_queries` / `tool_hint`；`queries` 只作为 `web_search_batch` 与 `submit_search_task` 的参数存在。
- "上游自动搜索"。检索由 openscry 在请求里显式声明 `web_search` / `x_search`。

### 9.2 结果可信度信号

先读尾注与 Sources 列表，再读正文。

| 信号 | 含义 | 处置 |
|---|---|---|
| `> tools: N server-side calls`，N >= 1 | 上游执行了检索 | 正常 |
| `> tools: 0`，或没有 `> tools:` 行且没有 `Sources` | 没有执行检索，模型直接依据训练数据作答 | 时效性结论一律视为未核验；改写问句重试，或改用 `web_fetch` 读取一手页面 |
| `> warning: answer carries no source citations …` | 答案没有来源 | 同上 |
| `> warning: search ran (N …) but the answer contains no parsable citations` | 执行了检索，但正文没有可解析的引用 | 结论可用，逐条溯源不可用；关键事实用 `web_fetch` 复核 |
| Sources 行尾 ` — via tavily\|firecrawl` | 该来源是 `extra_sources` 追加的 Tavily / Firecrawl 搜索结果，不是模型引用的来源 | 只作候选阅读列表，不作证据（评测 §2.6：补充来源一手占比仅 0.48） |
| 首行结论给出的版本 / 日期比已知的官方值更新 | 可能来自发布前工件（分支 RELEASES.md、追踪站） | 人工复核官方发布渠道；不直接采信，也不直接判错（评测 §3.1：openscry 返回 Rust 1.98.1 时官方尚未发布该版本，数小时后官方发布） |

### 9.3 调用方式

#### 9.3.1 定向核实

一次调用只核实一个事实。问句写清要什么、以什么为准：

- 版本 / 日期："X 当前稳定版本号与发布日期，以官方发布页或渠道清单为准，区分已发布与计划中。"
- 许可证："读取仓库 `LICENSE` 文件，说明许可证名称并逐字引用附加条款（多租户 / 品牌 / 源码公开），没读到就写 license not verified。" 然后用 `web_fetch https://github.com/<o>/<r>/blob/<ref>/LICENSE` 读取原文做第二次核对（v0.2.1 起 GitHub blob 页自动改写为 raw 文件）。
- 仓库事实：传 `platform: "GitHub"`；要求给出 stars 与最近发布 / 提交日期，并确认路径存在。
- 配置项 / 行为："在官方文档或源码中确认 X 的默认值与生效条件，给出文件路径。"

实测：版本 / 日期类 21/21 正确，3 次复测稳定 1.0，官方域名占比 0.94（评测 §2.4）。

#### 9.3.2 发现类问题

"有哪些项目 / 工具做 X"这类问题，上游检索排序偏向小项目与营销页，知名候选可能不出现在结果中（来源：openscry 使用反馈中编号为 P1 的记录；该记录不在本仓库内）。处理顺序：

1. 先用 GitHub API（`search/repositories`，按 stars 或 `pushed` 排序）或权威榜单取得候选名单；
2. 再用 `web_search_batch` 对每个候选做 §9.3.1 的定向核实；
3. 只在没有结构化来源时才让 openscry 发现候选。此时在问句里列出已知候选，要求逐个确认，并要求写出未核实项。

#### 9.3.3 抓取

- 已知 URL 直接调用 `web_fetch`：Tavily 层通常 < 1s；GitHub blob 页自动改写为 raw 文件原文。
- 长文档不依赖 Grok 层：Console 模型的 browse_page 只取回部分正文，会显式失败 `partial content`。Tavily / Firecrawl 未配置时改用 `web_search`，直接问页面里的那个事实。
- 需要抓取结果不降级时设 `GROK_FETCH_FALLBACK=strict`：抓取失败时不再降级到 basic-HTTP 层。

#### 9.3.4 批量与异步

- 互不依赖的子查询用 `web_search_batch` 并发执行；实测 3 条并发的总耗时约等于最慢一条的耗时；一批不超过 32 条。
- 预计超过 1-2 分钟，或不想阻塞当前会话时，用 `submit_search_task` 提交，再用 `get_search_task_result(wait="120s")` 读取；`wait` 上限 5m。

#### 9.3.5 `extra_sources`

默认不传。该参数只把 Tavily / Firecrawl 的搜索结果追加进 Sources，不改变答案正文；实测会把整体一手来源占比从 0.94 降到 0.70，约三成补充来源过时或不相关（评测 §2.6）。需要传时，读 `> extra_sources:` 尾注确认实际新增了几条。

#### 9.3.6 稳定性与复核

- 同一问题多次运行，结论一致，但来源集合不同（Jaccard 0.5-0.6）。需要可复现来源时，记录关键来源 URL，并用 `web_fetch` 抓取正文保存。
- 关键结论至少两条一手来源互证，或一次 `web_search` 加一次 `web_fetch` 官方页。
- 时延预算：搜索 p50 约 10-14s、p95 约 20-25s；单次成本约 0.02-0.06 USD（Console 模型）。规划轮次时按此估算。

#### 9.3.7 问句写法

- 问句自包含、只含一个事实、写明输出语言；标识符、版本号、URL 原文保留。
- 时效性问题写上"截至今天"，并要求区分 released / planned / rumored。
- 一条 `web_search` 只放一个问题；多个互不相关的问题用 `web_search_batch`。

### 9.4 `research_plan` 输出结构与 §2 字段的对应

`research_plan` 接收 `question`（可选 `timeout`），离线生成规划（不联网、不带检索工具），一次调用输出 §2 全部 6 阶段对应的字段。以下结构与字段语义依据 2026-09-04 对 v0.2.1 `research_plan` 的一次实测返回；实测记录见 `docs/references/2026-09-04-openscry-research-plan-probe.md`（本地归档，默认不随模板提交）。结构示例（sq3 展示带前置的子查询，sq4 展示没有 `tool_hint` 的综合类子查询）：

```json
{
  "intent": {"core_question": "", "query_type": "factual|comparative|exploratory|analytical", "time_sensitivity": "realtime|recent|historical|irrelevant", "domain": ""},
  "complexity": {"level": 1, "estimated_queries": 0, "estimated_calls": 0, "justification": ""},
  "sub_queries": [
    {"id": "sq1", "goal": "", "expected_output": "", "boundary": "", "tool_hint": "web_search|web_fetch|web_map"},
    {"id": "sq2", "goal": "", "expected_output": "", "boundary": "", "tool_hint": "web_search|web_fetch|web_map"},
    {"id": "sq3", "goal": "", "expected_output": "", "boundary": "", "depends_on": "sq1,sq2", "tool_hint": "web_search|web_fetch|web_map"},
    {"id": "sq4", "goal": "", "expected_output": "", "boundary": "", "depends_on": "sq1,sq2,sq3"}
  ],
  "search_terms": [{"term": "", "purpose": "sq1", "round": 1}],
  "execution": {"parallel_groups": [["sq1", "sq2"], ["sq3"], ["sq4"]], "sequential": ["sq3", "sq4"]},
  "strategies": {"fetch_before_claim": true, "gap_check": true, "fallback_plan": ""},
  "elapsed_s": 0.0
}
```

字段语义：

- `depends_on` 是字符串；多个前置子查询 id 用英文逗号连接（如 `"sq1,sq2"`）；没有前置的子查询不带该字段。
- `parallel_groups` 由 openscry 按 `depends_on` 分层推导：同一组内并行，组间顺序执行；每个子查询恰好出现在一个组里，`parallel_groups` 覆盖全部子查询。执行时按组推进，不必再自行排序；`estimated_rounds` 取 `parallel_groups` 的组数。
- `sequential` 列出所有带 `depends_on` 的子查询。这些子查询同时出现在 `parallel_groups` 的后续组里，所以 `sequential` 与 `parallel_groups` 重叠，不是互斥划分。
- 综合 / 归纳类子查询（如"基于前面的结果给出选型建议"）没有 `tool_hint` 字段；执行时该步不调用检索工具，只基于其 `depends_on` 列出的前置子查询结果作答。`research_plan` 仍会为它生成一条 `search_terms`（内容为该子查询的 `goal` 原文），执行时忽略该条。
- 每个 `tool_hint` 为 `web_search` 的子查询至少有一条 `search_terms`；缺失时 openscry 以该子查询的 `goal` 代替搜索词。
- `complexity` 使用 `estimated_queries`（子查询数）与 `estimated_calls`（工具调用数）。
- `strategies` 含 `fetch_before_claim`（布尔）、`gap_check`（布尔）、`fallback_plan`（字符串）；规划来自 `research_plan` 时原样归档。
- `research_plan` 只负责拆解问题；它的 `search_terms` 是起点，执行中按 §9.3 调整。

规划文档（§3 归档模板与 `docs/references/*.md` 中的 Phase 表）直接使用 `research_plan` 的字段名，不另起别名。§2 字段与 `research_plan` 输出的逐项对应：

| §2 阶段 | `research_plan` 字段 | 说明 |
|---|---|---|
| 1 `intent` | `intent.core_question` / `query_type` / `time_sensitivity` / `domain` | 名称一致。`unverified_terms`、`premise_valid` 是本规范字段，`research_plan` 不输出，由规划者补填 |
| 2 `complexity` | `complexity.level` / `estimated_queries` / `estimated_calls` / `justification` | 名称一致 |
| 3 `sub_queries` | `sub_queries[].id` / `goal` / `expected_output` / `boundary` / `depends_on` | 名称与格式一致：`depends_on` 是逗号连接的字符串，没有前置时不带该字段；归档表中没有前置的子查询该格写 `-` |
| 4 `search_terms` | `search_terms[].term` / `purpose` / `round` | 名称一致。`approach` 与"≤ 8 词"是本规范约束，`research_plan` 不输出；为没有 `tool_hint` 的子查询生成的条目不执行 |
| 5 Tool mapping | `sub_queries[].tool_hint` | 取值 `web_search` / `web_fetch` / `web_map`；综合 / 归纳类子查询没有该字段，归档表中该格写 `-`。`reason`、`params` 是本规范字段，`research_plan` 不输出，由规划者补填 |
| 6 `execution` | `execution.parallel_groups` / `sequential` | 名称一致。`estimated_rounds` 是本规范字段，取 `parallel_groups` 的组数 |
| 无 | `strategies.fetch_before_claim` / `gap_check` / `fallback_plan`、`elapsed_s` | 本规范没有对应字段。规划来自 `research_plan` 时，把 `strategies` 原样附在归档 Phase 6 之后；`elapsed_s` 是本次调用耗时，不属于规划字段 |

执行阶段的工具调用：

- 同一 `parallel_groups` 组内 `tool_hint` 为 `web_search` 的子查询合并为一次 `web_search_batch` 调用（每批不超过 32 条）；`tool_hint` 为 `web_fetch` / `web_map` 的子查询分别调用对应工具；没有 `tool_hint` 的子查询不调用工具，读取其前置子查询的结果作答。
- `web_search` / `web_search_batch` 默认不传 `extra_sources`（§9.3.5）；传入时 SKILL.md §3.5 的并发上限规则生效。

### 9.5 归档与验收

项目配置了 openscry MCP 时，以下要求叠加到 §6 退出门禁的"归档"与"验证"两行：

- 每条事实记录来源 URL、获取时间（到分钟）、出自哪次调用（`web_search` / `web_fetch`）；许可证类事实附 LICENSE 原文片段文件。
- 报告开头记录 `get_config_info` 输出的 `version`、`model`、`search_tools`，使结论可以对应到工具版本。
- 验收清单：
  - 没有把 `> tools: 0` 的结论当作已核验；
  - 候选名单来自结构化来源（§9.3.2）；
  - 许可证结论附 LICENSE 引文；
  - 一手 / 二手来源分开标注；
  - 未核实字段写"未核实"，不写推断值。

### 9.6 已知限制（截至 v0.2.1）

| 限制 | 原因 | 补偿 |
|---|---|---|
| 按域名限定检索不生效 | grok2api v3 Console 路径丢弃 `web_search.filters`（修复需要上游 PR） | 问句里点名官方域名；用 `web_fetch` 官方页复核 |
| 发现类问题的结果遗漏知名候选 | 上游检索排序偏向小项目与营销页 | §9.3.2 |
| 同一问题多次运行返回的来源集合不同 | 模型输出非确定性 | §9.3.6 |
| 长页面经 Grok 抓取层只取回部分正文 | Console 模型 browse_page 只返回部分正文 | 配置 Tavily / Firecrawl；或改用 `web_search` 问具体事实 |
| `extra_sources` 降低一手来源占比 | 追加的检索结果按相关度而非权威性排序 | 默认 0（不传） |

---

## 10. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-04-30 | 初始版本，依据 GrokSearch search-planning Anthropic Skill 治理化改写 |
| 1.1.0 | 2026-05-05 | 事实源校准：把"工具实现"事实源从未存在的 `skills/search-planning/` 改为 `src/grok_search/server.py` + `planning.py` + `sources.py`；删除主叙述中的 `mcp5_*` 客户端 prefix，统一使用 grok-search MCP 通用工具名；新增 §8 事实源分层表与 §1.5 / §7.3 scope 边界，明确 search-planning 只治理调研规划方法论，完整 grok-search MCP 使用由后续 `skills/grok-search/` 承接 |
| 1.1.1 | 2026-05-29 | 增加「模板实例化说明」：明确 grok-search MCP 工具名、`skills/grok-search/` 与 GrokSearch 仓库引用属于来源项目示例绑定，实例化到非 GrokSearch 项目时应替换为该项目实际搜索/抓取工具 |
| 1.1.2 | 2026-08-20 | 对齐 systematic-debugging 2.0：移除已废弃的固定根因假说阶段名，改为在建立或检验根因证据时按需调用多步外部调研 |
| 1.2.0 | 2026-09-04 | 新增 §9 openscry MCP 调用规范，只在项目配置了 openscry MCP 时读取，绑定 openscry v0.2.1：工具契约、结果可信度信号、调用方式、`research_plan` 输出与 §2 字段的对应、归档与验收、已知限制；§8 事实源表新增 openscry 条件行；原 §9 版本历史改为 §10。字段名按 `research_plan` 输出对照：`estimated_sub_queries` 改名 `estimated_queries`，`estimated_tool_calls` 改名 `estimated_calls`，Phase 5 的 `tool` 改名 `tool_hint`，阶段名称改为 `intent` / `complexity` / `sub_queries` / `search_terms` / `execution`（Phase 5 在 `research_plan` 中无顶层字段，保留 Tool mapping）；`core_question` / `query_type` / `time_sensitivity` / `domain` / `id` / `goal` / `expected_output` / `boundary` / `depends_on` / `term` / `purpose` / `round` / `parallel_groups` / `sequential` 名称已一致，未改；`unverified_terms` / `premise_valid` / `approach` / `reason` / `params` / `estimated_rounds` 在 `research_plan` 中没有对应字段，未改 |
| 1.3.0 | 2026-09-04 | 工具层整体切换到 openscry MCP：删除 grok-search MCP 绑定（SKILL.md §1.5 scope、§3.4 工具表、§3.4 `plan_intent` 等 `plan_*` 工具说明与 `mcp5_plan_intent` 客户端 prefix 示例、§7.1-§7.3 GrokSearch 源码事实源 / Anthropic Skill 镜像 / 待补 `skills/grok-search/`；SPEC.md §2 `plan_*` 源码事实源注、§3 模板 `extra_sources=3` 示例、§8 GrokSearch 事实源行与 `skills/grok-search/` 承接段、§9.1 与 §9.4 中 `plan_*` 对照说明），事实源改为 openscry `tools/list` 与 CHANGELOG，§2-§8 以 openscry 为默认工具层，§9 读取条件补充未配置 openscry 的项目按 §2-§8 字段规划并换用实际检索工具。规划字段语义统一为 `research_plan` 实际返回：`parallel_groups` 按 `depends_on` 分层并覆盖全部子查询，`sequential` 是带 `depends_on` 的子查询子集且与 `parallel_groups` 重叠，`estimated_rounds` = `parallel_groups` 组数（删除"组数 + `sequential` 长度"算法及 §3 旧示例）；`depends_on` 为逗号连接的字符串，没有前置时字段缺省（SKILL.md §4.3 原列表定义改此）；综合 / 归纳类子查询没有 `tool_hint`，执行时不调用检索工具，只基于前置子查询结果作答（§2 表、§6 门禁、§7 禁止清单第 8 条、§9.4、SKILL.md §2 / §3.4 / §4.5 补入）；`strategies` 原样归档。SKILL.md §4.6 步骤名 `plan_execution` 改为 `schedule_execution`，避免与已删除的工具名同形 |
