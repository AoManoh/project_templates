# 搜索规划 Skill

**skill_id**: `search-planning`
**版本**: 1.1.0
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
| 搜索 / 抓取 / 站点映射工具 | 执行规划产出的搜索动作 | 必需（任意一个） |
| `view` / 源码访问 | 验证 `unverified_terms` 类外部分类 | 推荐 |

### 1.4 关联规范

字段定义、复杂度评级、边界反模式、归档格式：[SPEC.md](./SPEC.md)

### 1.5 Scope 边界

本 skill **只治理"多步调研规划方法论"**——也就是 6 阶段 plan 流程（intent → complexity → sub-queries → search terms → tool mapping → execution）。

**本 skill 不治理**：

- 具体 grok-search MCP 工具（`web_search` / `web_fetch` / `web_map`）的配置、调用细节、信源获取、超时与重试策略
- `get_config_info` / `switch_model` / `toggle_builtin_tools` 的安全边界
- 代理隔离、API key 管理、模型选择策略
- inline citation 解析与 `get_sources` 的调用时机

以上属于 grok-search MCP 完整使用面，由 `skills/grok-search/`（待补，独立任务）单独承接。本 skill 引用 grok-search MCP 的工具名（如 `plan_intent` / `web_search`）只用于"何时调用"和"按什么顺序调用"的方法论决策，不下沉到工具内部细节。

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| 读取 SPEC.md | 开始规划前 |
| Phase 1 必须输出 `core_question` / `query_type` / `time_sensitivity` 三个字段 | 任何复杂度 |
| Phase 2 复杂度评级落地为 1 / 2 / 3 | 任何复杂度 |
| L1 至少完成 Phase 1-3，L2 至少完成 1-5，L3 全部 6 阶段 | 复杂度评级后 |
| 每个子查询必须有可证伪的 `boundary` | Phase 3 |
| 搜索词 ≤ 8 个词 | Phase 4 |
| 工具映射给出一句话 `reason` | Phase 5 |
| `parallel_groups` 内成员之间无 `depends_on` 关系 | Phase 6 |
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

| 现象 | 工具（一般名 / MCP 名） |
|---|---|
| 综合性"是什么 / 为什么 / 怎么样" | `web_search`（grok-search MCP）|
| 已知 URL 取全文 | `web_fetch`（grok-search MCP，Tavily 主路径、Firecrawl 降级）|
| 先发现 URL 拓扑 | `web_map`（grok-search MCP，Tavily Map）|
| 时效性（"最新" / "今天"）| `web_search`（grok-search MCP 自注入当前时间上下文）|
| Paywall / SPA | 跳过 `web_fetch`，让 `web_search` 走 LLM 索引 |

可选：`plan_intent` / `plan_complexity` / `plan_sub_query` / `plan_search_term` / `plan_tool_mapping` / `plan_execution` 一组工具（grok-search MCP 提供）可把 6 阶段产物落到一个 `session_id` 上，跨调用累积同一份计划。

> **客户端命名提示**：在 Cursor / Windsurf / Claude Code 等具体客户端中，这些工具可能带客户端 prefix（如 `mcp5_plan_intent`、`mcp5_web_search`）。本 skill 正文统一使用 grok-search MCP 上游工具名（无 prefix）。客户端 prefix 仅在各客户端文档中作为示例出现，不影响本 skill 的方法论描述。

### 3.5 并行 vs 串行判定

A 与 B 可放进同一个 `parallel_groups` 当且仅当：

- `A.depends_on` 不含 `B.id` 且反之亦然
- 在该轮预期并发下不会撞同一 API 配额上限

`extra_sources > 0` 时把 `parallel_groups` 单组成员上限设为 3，除非已确认配额充足。`depends_on` 链上的 sq 全部进 `sequential`。

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
2. 估算 `estimated_sub_queries` 和 `estimated_tool_calls`。
3. 一句话写 `justification`。

### 4.3 decompose_sub_queries

**目的**：把 `core_question` 拆为相互独立的子查询。

**执行步骤**：
1. 给每个 sq 唯一 id（`sq1`, `sq2`...）。
2. 写 `goal` / `expected_output` / `boundary`。
3. 标记 `depends_on`（其他 sq 的 id 列表）。
4. 用 §3.3 反模式表自检 `boundary`。

### 4.4 draft_search_terms（L2+）

**目的**：把 sq 转化为可输入到搜索工具的查询词。

**执行步骤**：
1. 每个 sq 至少给 1 个 `round=1` 搜索词（≤ 8 个词）。
2. 整体选定 `approach` ∈ {`broad_first`, `narrow_first`, `targeted`}。
3. 写 `round=2` 的 follow-up 触发条件（陌生术语、矛盾源、需要 fetch 单 URL 等）；停在 `round=2`，除非确实出现新触发条件。

### 4.5 map_to_tools（L2+）

**目的**：给每个 sq 分配执行工具。

**执行步骤**：
1. 每个 sq 选一个工具（`web_search` / `web_fetch` / `web_map`）。
2. 写一句 `reason`。
3. 必要时指定 `params`（例如 `extra_sources=3`）。

### 4.6 plan_execution（L3）

**目的**：给出执行顺序。

**执行步骤**：
1. 列 `parallel_groups`：每个内层 list 是一轮可并发的 sq id。
2. 列 `sequential`：必须按 `depends_on` 链顺序跑的 sq id。
3. 估 `estimated_rounds` = `parallel_groups` 链长 + `sequential` 长度。

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
6. plan_execution (Phase 6)
   |
7. 执行计划 -> archive_plan（中大型必须）
```

### 5.2 与其他 Skill 配合

| 触发场景 | 主 Skill | 嵌入位置 |
|---|---|---|
| 需求对齐前需要外部资料调研 | `requirements-governance` | 在需求收集阶段调用 search-planning，结果归 `docs/references/` |
| 重大重构前需要技术调研 | `refactor-governance` | 在方案讨论阶段调用 search-planning |
| code-review 中遇到 unfamiliar 技术 | `code-review` | 调用 search-planning 后读到的资料作为 review 依据 |
| 调试需要参考外部 issue / 博客 | `systematic-debugging` | 在 form_root_cause_hypothesis 阶段调用 search-planning |

search-planning 本身不替代以上任何 skill，只为它们的"先调研再做"提供可复用骨架。

---

## 6. 错误处理

| 错误类型 | 处理方式 |
|---|---|
| 子查询互相重叠（boundary 不互斥） | 退回 Phase 3 重写 boundary，或合并 sq |
| 搜索词超过 8 个词 | 拆成多 round，或在 boundary 上收敛子查询 |
| `parallel_groups` 内有 `depends_on` 关系 | 退回 Phase 6 把违规 sq 移到 `sequential` |
| `unverified_terms` 检索结果与训练知识冲突 | 优先采用刚检索到的源，并在归档中标注更新理由 |
| 大型调研中 API 配额耗尽 | 暂停执行，缩小 sq 数量或 `extra_sources`，记录在归档"执行结果"中 |
| 工具不可用（如 `web_fetch` 失败） | 按 §3.4 替代规则降级（`fetch` → `web_search`），并在归档备注 |

---

## 7. 与上游事实源的关系

本 skill 治理的是"多步调研规划方法论"，不直接维护工具实现。事实源分两类：

### 7.1 实现事实源

grok-search MCP 工具的唯一事实源在 [`AoManoh/GrokSearch`](https://github.com/AoManoh/GrokSearch) 仓库的源码中：

- `src/grok_search/server.py`：13 个 MCP 工具的 `@mcp.tool()` 注册和 `Annotated` 字段说明（`web_search` / `get_sources` / `web_fetch` / `web_map` / `get_config_info` / `switch_model` / `toggle_builtin_tools` / `plan_intent` / `plan_complexity` / `plan_sub_query` / `plan_search_term` / `plan_tool_mapping` / `plan_execution`）
- `src/grok_search/planning.py`：6 阶段 plan_* 工具的内部状态机与合并策略
- `src/grok_search/sources.py`：信源缓存与 inline citation 解析
- `README.md` 的"MCP 工具"章节：工具签名与默认参数对外说明

发生工具语义变化（参数、阶段定义、字段约束）时**以这一组源码为唯一事实源**。本 skill 在引用工具名（如 `plan_intent`）和阶段语义（如"Phase 1 输出 core_question / query_type / time_sensitivity"）时，应保持与源码注解一致。

### 7.2 process-only Anthropic Skill 镜像（可选）

[`AoManoh/GrokSearch`](https://github.com/AoManoh/GrokSearch) fork 可能附带一份 process-only Anthropic Skills 包（位置约定为 `skills/search-planning/`），用于让支持 Claude Skills 自激活的客户端直接挂载。该镜像在不同时间点可能存在或缺失。如果存在：

- 它是同一 6 阶段方法论的英文 process-only 形态
- 它和本 skill 共享设计目标，但**不互为事实源**——双方都以 §7.1 的 Python 源码为最终事实源
- 当上游镜像与本 skill 的中文表述发生措辞差异时，**方法论描述以本 skill 为准**（治理化中文版），**工具语义以源码为准**

本 skill 不要求 GrokSearch fork 必须维护该镜像；如果该 fork 决定不维护，本 skill 不受影响。

### 7.3 与待补 grok-search skill 的关系

`skills/grok-search/`（待补，作为独立任务推进）将治理 grok-search MCP 完整使用面：配置诊断、搜索调用、信源获取、代理隔离、模型切换、内置 WebSearch/WebFetch 路由控制。它和本 skill 的边界：

- **search-planning（本 skill）**：何时该调研、按什么顺序调研——**决策层**
- **grok-search（待补）**：grok-search MCP 工具该怎么调、怎么诊断、怎么避坑——**执行层**

二者协作但不重叠：本 skill 的 §3.4 工具映射、§4.5 map_to_tools 决定"用哪个工具"，但工具的具体调用参数、错误处理、信源后处理由 grok-search skill 治理。
