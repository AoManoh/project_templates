# 搜索规划 Skill

**skill_id**: `search-planning`
**版本**: 1.3.0
**output_dir**: `docs/references/`

---

## 1. 概述

本技能定义 AI Agent 在执行多步网络调研（comparative / exploratory / analytical 类问题）前，先生成可执行搜索计划的标准流程。它不是"再多搜一次"，而是"先决定怎么搜、按什么顺序搜、用哪个工具搜"。

目标不是让调研变慢，而是让调研过程可追溯、子问题可拆分、信源可对照、配额可控。

### 1.1 触发条件

| 触发方式 | 条件 |
|----------|------|
| 显式触发 | 用户指令包含关键词：`调研`、`research`、`对比`、`compare`、`探索`、`survey`、`找资料` |
| 场景触发 | 问题是比较型 / 探索型 / 分析型，预计需要 ≥ 2 次搜索；问题中含未经核实的外部分类（如 "CCF-A 会议"、"OWASP Top 10"）；用户希望系统化输出而不是单点回答 |

### 1.2 不使用边界

| 反场景 | 替代方案 |
|--------|----------|
| 单事实查询（"X 什么时候发布的？"） | 直接调用 `web_search` |
| 已经有明确 URL，需要全文 | 直接调用 `web_fetch` |
| 用户只要快速扫一眼 | 不强制走规划流程 |

### 1.3 前置依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| AGENTS.md | 项目根、事实源、产物路径约束 | 必需 |
| openscry MCP（`research_plan` / `web_search` / `web_search_batch` / `web_fetch` / `web_map`） | 生成规划、执行规划产出的检索动作 | 默认工具层；未配置时换成项目实际可用的检索工具 |
| `view` / 源码访问 | 验证 `unverified_terms` 类外部分类 | 推荐 |

### 1.4 关联规范

字段定义、复杂度评级、边界反模式、归档格式：[SPEC.md](./SPEC.md)

项目配置了 openscry MCP 时，在首次调用 openscry 工具（含 `research_plan`）或判定 openscry 检索结果可信度之前，读取 [SPEC.md](./SPEC.md) §9。未配置 openscry MCP 的项目不读该章：仍按 SPEC.md §2–§8 的字段规划，把工具调用换成项目实际可用的检索工具。

### 1.5 Scope 边界

本 skill **只治理"多步调研规划方法论"**——也就是 6 阶段 plan 流程（intent → complexity → sub_queries → search_terms → tool mapping → execution）。

**本 skill 不治理**：

- openscry 服务端的安装、部署、环境变量与 API key 管理
- openscry 各工具内部的抓取分层、超时与重试实现
- 检索结果正文的引用解析实现

本 skill 引用 openscry 工具名（如 `research_plan` / `web_search`）只用于"何时调用"和"按什么顺序调用"的方法论决策。openscry 工具的调用方式、结果可信度信号、`research_plan` 输出字段与本 skill 字段的对应、归档验收和已知限制由 [SPEC.md](./SPEC.md) §9 承载。

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| 读取 SPEC.md | 开始规划前 |
| 项目配置了 openscry MCP 时读取 SPEC.md §9 | 首次调用 openscry 工具前 |
| Phase 1 必须输出 `core_question` / `query_type` / `time_sensitivity` 三个字段 | 任何复杂度 |
| Phase 2 复杂度评级落地为 1 / 2 / 3 | 任何复杂度 |
| L1 至少完成 Phase 1-3，L2 至少完成 1-5，L3 全部 6 阶段 | 复杂度评级后 |
| 每个子查询必须有可证伪的 `boundary` | Phase 3 |
| 搜索词 ≤ 8 个词 | Phase 4 |
| 工具映射给出一句话 `reason`；综合 / 归纳类子查询不填 `tool_hint` | Phase 5 |
| `parallel_groups` 覆盖全部子查询，同组成员之间无 `depends_on` 关系 | Phase 6 |
| 没有 `tool_hint` 的子查询不调用检索工具，只基于前置子查询结果作答 | 执行阶段 |
| 中大型调研必须落盘到 `docs/references/` | 计划生成后 |

---

## 3. 快速参考

### 3.1 复杂度速查

| 等级 | 启发式 | 必走阶段 |
|---|---|---|
| L1 | 1-2 次搜索可解决 | 1, 2, 3 |
| L2 | 3-5 次搜索 | 1, 2, 3, 4, 5 |
| L3 | ≥ 6 次搜索 或 需要跨源互证 | 全部 6 阶段 |

含 `unverified_terms` 自动 ≥ L2，因为每个未核实分类都会成为 Phase 3 的前置子查询。

### 3.2 适用规模

| 调研规模 | 判定信号 | 是否落盘 |
|---|---|---|
| 小 | L1，且最终输出 ≤ 一段话 | 不强制 |
| 中 | L2，多 source 综合 | 必须落 `docs/references/YYYY-MM-DD-{scope}.md` |
| 大 | L3，需要长报告 / 跨源互证 | 必须落盘并保留 6 阶段完整草稿 |

### 3.3 子查询边界反模式

| 反模式 | 为什么失败 | 改写方向 |
|---|---|---|
| `boundary: "research X"` | 复述领域，不能与兄弟互斥 | "X 的安装/配置（性能基准属于 sq2）" |
| `boundary: "background and current state"` | 与 "current state" sq 重叠 | 二选一，剩下的拆出独立 sq |
| `boundary: "anything related to RAG"` | 边界无穷大 | 按时间 / 技术 / 厂商 / 区域之一收敛 |

好的边界要写"这个 sq **拒绝回答什么**，并指向负责的兄弟"。

### 3.4 工具映射

| 现象 | 工具（openscry MCP） |
|---|---|
| 综合性"是什么 / 为什么 / 怎么样" | `web_search` |
| 同一轮内多个互不依赖的 `web_search` 子查询 | 合并为一次 `web_search_batch`（一批不超过 32 条） |
| 已知 URL 取全文 | `web_fetch`（抓取层为 tavily / firecrawl / grok / http 之一，返回首行注释的 `tier=` 标明实际使用的层） |
| 先发现 URL 拓扑 | `web_map` |
| 时效性（"最新" / "今天"） | `web_search`，问句写明"截至今天"并要求区分 released / planned / rumored（SPEC.md §9.3.7） |
| `web_fetch` 取不到完整正文（paywall、SPA、`partial content`） | 改用 `web_search`，直接问页面里的那个事实（SPEC.md §9.3.3） |
| 综合 / 归纳前置子查询的结果 | 不填 `tool_hint`，不调用检索工具，只基于 `depends_on` 列出的前置子查询结果作答 |

规划阶段可调用 `research_plan`（参数 `question`）一次输出全部 6 阶段字段；它离线生成、不联网，字段对应见 SPEC.md §9.4。

> **客户端命名提示**：在 Cursor / Windsurf / Claude Code 等具体客户端中，这些工具可能带客户端 prefix（如 `mcp5_web_search`）。本 skill 正文统一使用 openscry `tools/list` 中的工具名（无 prefix）。客户端 prefix 仅在各客户端文档中作为示例出现，不影响本 skill 的方法论描述。

### 3.5 并行 vs 串行判定

`parallel_groups` 按 `depends_on` 分层：第 1 组是没有 `depends_on` 的子查询；之后每一组的成员，其 `depends_on` 列出的前置全部位于更早的组中。每个子查询恰好出现在一个组里，`parallel_groups` 覆盖全部子查询。

`sequential` 列出所有带 `depends_on` 的子查询。这些子查询同时出现在 `parallel_groups` 的后续组里，所以 `sequential` 与 `parallel_groups` 重叠，不是互斥划分。

A 与 B 可放进同一组当且仅当 `A.depends_on` 不含 `B.id` 且反之亦然。

`estimated_rounds` = `parallel_groups` 的组数。

`web_search` / `web_search_batch` 默认不传 `extra_sources`（SPEC.md §9.3.5）。传入 `extra_sources` 时，每条子查询会额外触发 Tavily / Firecrawl 检索；此时同一组一次合并进 `web_search_batch` 的子查询不超过 3 条，除非已确认 Tavily / Firecrawl 配额充足。

---

## 4. Skill 定义

### 4.1 distill_intent

**目的**：把用户问题压缩到结构化 Phase 1 字段。

**执行步骤**：
1. 写出一句话的 `core_question`。
2. 标 `query_type` ∈ {`factual`, `comparative`, `exploratory`, `analytical`}。
3. 标 `time_sensitivity` ∈ {`realtime`, `recent`, `historical`, `irrelevant`}。
4. 列出 `unverified_terms`（外部分类、行业排名等可能 LLM 训练数据已过期的词）。
5. 若问题含错误前提，标 `premise_valid=false` 并先找出。

### 4.2 score_complexity

**目的**：决定后续阶段范围。

**执行步骤**：
1. 用 §3.1 启发式评级 1 / 2 / 3。
2. 估算 `estimated_queries`（子查询数）和 `estimated_calls`（工具调用数）。
3. 一句话写 `justification`。

### 4.3 decompose_sub_queries

**目的**：把 `core_question` 拆为相互独立的子查询。

**执行步骤**：
1. 给每个 sq 唯一 id（`sq1`, `sq2`...）。
2. 写 `goal` / `expected_output` / `boundary`。
3. 有前置的 sq 写 `depends_on`：字符串，多个前置 sq id 用英文逗号连接（如 `sq1,sq2`）；没有前置的 sq 不写该字段。
4. 用 §3.3 反模式表自检 `boundary`。

### 4.4 draft_search_terms（L2+）

**目的**：把 sq 转化为可输入到搜索工具的查询词。

**执行步骤**：
1. 每个有 `tool_hint` 的 sq 至少给 1 个 `round=1` 搜索词（≤ 8 个词）；综合 / 归纳类 sq 不需要搜索词。
2. 整体选定 `approach` ∈ {`broad_first`, `narrow_first`, `targeted`}。
3. 写 `round=2` 的 follow-up 触发条件（陌生术语、矛盾源、需要 fetch 单 URL 等）；停在 `round=2`，除非确实出现新触发条件。

### 4.5 map_to_tools（L2+）

**目的**：给每个 sq 分配执行工具。

**执行步骤**：
1. 需要检索的 sq 在 `tool_hint` 选一个工具（`web_search` / `web_fetch` / `web_map`）；综合 / 归纳类 sq 不填 `tool_hint`，执行时不调用检索工具，只基于前置 sq 的结果作答。
2. 写一句 `reason`。
3. 必要时指定 `params`（例如仓库事实传 `platform=GitHub`；各工具可用参数见 SPEC.md §9.1）。

### 4.6 schedule_execution（L3）

**目的**：给出执行顺序。

**执行步骤**：
1. 列 `parallel_groups`：按 `depends_on` 分层，每个内层 list 是一轮可并发的 sq id；每个 sq 出现且只出现一次。
2. 列 `sequential`：所有带 `depends_on` 的 sq id；它们同时位于 `parallel_groups` 的后续组中。
3. `estimated_rounds` = `parallel_groups` 的组数。
4. 规划来自 `research_plan` 时，`parallel_groups` 与 `sequential` 已由 openscry 按 `depends_on` 推导，直接采用；`strategies`（`fetch_before_claim` / `gap_check` / `fallback_plan`）原样归档，见 SPEC.md §9.4。

### 4.7 archive_plan

**目的**：让计划可追溯。

**执行步骤**：
1. 按 SPEC.md §3 模板写 `docs/references/YYYY-MM-DD-{scope}.md`。
2. 中大型调研保留全部 6 阶段字段；小调研只留 Phase 1-3 即可。
3. 把执行后真正抓回的关键信源（URL + 可信度评估）追加到归档底部。

---

## 5. Skill 编排流程

### 5.1 标准规划流程

```
1. distill_intent (Phase 1)
   |
2. score_complexity (Phase 2) -> 决定走 L1 / L2 / L3
   |
3. decompose_sub_queries (Phase 3)
   |  L1 在此停止
4. draft_search_terms (Phase 4)
   |
5. map_to_tools (Phase 5)
   |  L2 在此停止
6. schedule_execution (Phase 6)
   |
7. 执行计划 -> archive_plan（中大型必须）
```

项目配置了 openscry MCP 时，步骤 1-6 的字段可由一次 `research_plan` 调用产出；规划者补填 `research_plan` 不输出的 `unverified_terms` / `premise_valid` / `approach` / `reason` / `params` / `estimated_rounds`，再进入步骤 7。

### 5.2 与其他 Skill 配合

| 触发场景 | 主 Skill | 嵌入位置 |
|---|---|---|
| 需求对齐前需要外部资料调研 | `requirements-governance` | 在需求收集阶段调用 search-planning，结果归 `docs/references/` |
| 重大重构前需要技术调研 | `refactor-governance` | 在方案讨论阶段调用 search-planning |
| code-review 中遇到 unfamiliar 技术 | `code-review` | 调用 search-planning 后读到的资料作为 review 依据 |
| 调试需要跨源比较外部 issue / 博客 | `systematic-debugging` | 在建立或检验根因证据时按需调用 search-planning |

search-planning 本身不替代以上任何 skill，只为它们的"先调研再做"提供可复用骨架。

---

## 6. 错误处理

| 错误类型 | 处理方式 |
|---|---|
| 子查询互相重叠（boundary 不互斥） | 退回 Phase 3 重写 boundary，或合并 sq |
| 搜索词超过 8 个词 | 拆成多 round，或在 boundary 上收敛子查询 |
| `parallel_groups` 同一组内有 `depends_on` 关系 | 退回 Phase 6，把该 sq 移到其全部前置所在组之后的组，并加入 `sequential` |
| `unverified_terms` 检索结果与训练知识冲突 | 优先采用刚检索到的源，并在归档中标注更新理由 |
| 大型调研中 Tavily / Firecrawl 或上游配额耗尽 | 暂停执行，缩小 sq 数量或停止传 `extra_sources`，记录在归档"执行结果"中 |
| `web_fetch` 失败或只取回部分正文 | 按 §3.4 改用 `web_search` 直接问页面里的那个事实，并在归档备注 |
| `web_search` 结果尾注为 `> tools: 0`，或没有 `Sources` 列表 | 该结论视为未核验：改写问句重试，或用 `web_fetch` 读取一手页面（SPEC.md §9.2） |

---

## 7. 与上游事实源的关系

本 skill 治理的是"多步调研规划方法论"，不维护工具实现。事实源分两类：

### 7.1 工具契约事实源

openscry MCP 工具契约（工具名、参数名、输出字段、尾注格式）的事实源是 openscry 的 `tools/list` 与 CHANGELOG。[SPEC.md](./SPEC.md) §9 是 openscry 的使用说明，绑定 openscry v0.2.1，记录调用方式、结果可信度信号、`research_plan` 输出与本 skill 字段的对应、归档验收和已知限制；该章与工具契约不一致时改该章。

本 skill 引用的工具名（如 `research_plan` / `web_search`）与 `research_plan` 输出字段名（如 `sub_queries[].tool_hint`、`execution.parallel_groups`）以 openscry 实际返回为准。

### 7.2 方法论事实源

6 阶段字段、复杂度评级、边界反模式、退出门禁与归档模板以 [SPEC.md](./SPEC.md) §2–§7 为唯一事实源。`research_plan` 不输出的字段（`unverified_terms` / `premise_valid` / `approach` / `reason` / `params` / `estimated_rounds`）由本 skill 定义，与工具契约无关。
