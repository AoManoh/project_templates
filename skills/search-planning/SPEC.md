# 搜索规划 Skill 规范

**版本**: 1.1.2
**适用范围**: comparative / exploratory / analytical 类多步调研的规划阶段

---

## 1. 目标

本规范定义搜索规划阶段的字段、约束和归档格式。

为什么：当一个问题需要多次搜索、跨源对比时，最容易出现的失败不是"搜不到"，而是"搜得发散"——要么 sq 之间互相重叠浪费配额，要么 sq 边界过宽永远收不了口。本规范要求在执行前先把"打算怎么搜"写下来，把发散控制在规划阶段。

---

## 2. 6 阶段字段约束

| 阶段 | 名称 | 必填字段 | 退出条件 |
|------|------|----------|----------|
| 1 | Intent | `core_question`, `query_type`, `time_sensitivity` | 三字段都已填 |
| 2 | Complexity | `level`, `estimated_sub_queries`, `estimated_tool_calls`, `justification` | `level` ∈ {1, 2, 3}，估算非 0 |
| 3 | Sub-queries | 每个 sq 的 `id`, `goal`, `expected_output`, `boundary` | 每个 boundary 通过 §5 反模式自检 |
| 4 | Search terms | 每个 term 的 `term`(≤ 8 词), `purpose`(= sq id), `round` | 每个 sq 至少 1 个 `round=1` 词 |
| 5 | Tool mapping | 每个 sq 的 `tool`, `reason` | 每个 sq 都有工具决定 |
| 6 | Execution order | `parallel_groups`, `sequential`, `estimated_rounds` | parallel 成员间无 `depends_on` 关系 |

字段语义以 grok-search MCP `src/grok_search/server.py` 中各 `plan_*` 工具的 `@mcp.tool()` `description` 和 `Annotated` 字段说明为最终事实源（`plan_intent` 在 line 1063 起，依次到 `plan_execution`）。本表只列必填字段与退出条件；可选字段（如 `is_revision` / `confidence` / `depends_on`）以源码注解为准。

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

## Phase 1 — Intent

- core_question: ...
- query_type: factual / comparative / exploratory / analytical
- time_sensitivity: realtime / recent / historical / irrelevant
- domain: (可选)
- unverified_terms: (可选)
- premise_valid: true / false

## Phase 2 — Complexity

- level: L?
- estimated_sub_queries: N
- estimated_tool_calls: N
- justification: 一句话

## Phase 3 — Sub-queries

| id | goal | expected_output | boundary | depends_on |
|---|---|---|---|---|
| sq1 | ... | ... | ... | - |

## Phase 4 — Search terms（L2+）

approach: broad_first / narrow_first / targeted

| term | purpose | round |
|---|---|---|
| ... | sq1 | 1 |

## Phase 5 — Tool mapping（L2+）

| sq | tool | reason | params |
|---|---|---|---|
| sq1 | web_search | ... | extra_sources=3 |

## Phase 6 — Execution order（L3）

- parallel_groups: [[sq1, sq2], [sq3]]
- sequential: [sq4]
- estimated_rounds: 3

## 执行结果

| sq | 工具 | 命中信源 / URL | 可信度 | 备注 |
|---|---|---|---|---|
| sq1 | web_search | https://... | 高 / 中 / 低 | ... |

## 结论

（一句话回答 core_question；多段时使用列表）
```

L1 调研可省略 Phase 4 - 6 章节，但 "执行结果" 与 "结论" 仍建议保留。

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
| 工具 | L2+ 已映射到 `web_search` / `web_fetch` / `web_map` 之一 |
| 归档 | 中大型调研已落 `docs/references/YYYY-MM-DD-{scope}.md` |
| 验证 | 执行阶段记录至少 1 个真实信源（含 URL） |

---

## 7. 禁止清单

1. 跳过复杂度评级直接动手搜。
2. 子查询用领域名当 boundary。
3. 同一 sq 把多个 round 词塞成一个长查询。
4. 在 `parallel_groups` 中放有 `depends_on` 关系的 sq。
5. 大型调研只保留最终结论，丢掉 6 阶段过程产物。
6. 把训练数据里的"知道"当作信源——必须有可访问的 URL。
7. `extra_sources > 0` 且并发 > 3 时不评估配额。

---

## 8. 与外部事实源的关系

| 层级 | 唯一事实源 | 本规范的关系 |
|------|--------------|--------------|
| 工具实现 | [`AoManoh/GrokSearch`](https://github.com/AoManoh/GrokSearch) `src/grok_search/server.py` 的 13 个 `@mcp.tool()` 注册（含 `web_search` / `get_sources` / `web_fetch` / `web_map` / `get_config_info` / `switch_model` / `toggle_builtin_tools` / `plan_intent` / `plan_complexity` / `plan_sub_query` / `plan_search_term` / `plan_tool_mapping` / `plan_execution`）以及 `planning.py` / `sources.py` | 本规范引用工具名与参数语义时以源码为准；发生参数/字段语义变更时本规范的§2 必填表需同步 |
| 方法论 | 本规范自身（§2 - §7） | 上游 process-only Anthropic Skill 镜像（如存在于 `AoManoh/GrokSearch/skills/search-planning/`）共享同一方法论，但措辞差异以本规范为准 |
| 客户端调用 | 各客户端文档（Cursor / Windsurf / Claude Code 的 MCP 配置） | 本规范不与具体客户端绑定；客户端 prefix（如 `mcp5_plan_intent`）只在客户端文档中作为示例 |

变更原则：

- 工具语义变化（新增工具、字段语义重定义、阶段拆分）：以 `src/grok_search/server.py` 为准，本规范同步
- 方法论调整（边界反模式、退出门禁、归档模板）：以本规范为唯一事实源，上游镜像跟进
- 客户端 prefix 变化：不影响本规范

完整 grok-search MCP 使用面（配置、调用参数、错误处理、代理隔离、信源后处理、模型切换、内置 WebSearch/WebFetch 路由控制）不在本规范范围内，由 `skills/grok-search/`（待补，独立任务）单独承接。

---

## 9. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-04-30 | 初始版本，依据 GrokSearch search-planning Anthropic Skill 治理化改写 |
| 1.1.0 | 2026-05-05 | 事实源校准：把"工具实现"事实源从未存在的 `skills/search-planning/` 改为 `src/grok_search/server.py` + `planning.py` + `sources.py`；删除主叙述中的 `mcp5_*` 客户端 prefix，统一使用 grok-search MCP 通用工具名；新增 §8 事实源分层表与 §1.5 / §7.3 scope 边界，明确 search-planning 只治理调研规划方法论，完整 grok-search MCP 使用由后续 `skills/grok-search/` 承接 |
| 1.1.1 | 2026-05-29 | 增加「模板实例化说明」：明确 grok-search MCP 工具名、`skills/grok-search/` 与 GrokSearch 仓库引用属于来源项目示例绑定，实例化到非 GrokSearch 项目时应替换为该项目实际搜索/抓取工具 |
| 1.1.2 | 2026-08-20 | 对齐 systematic-debugging 2.0：移除已废弃的固定根因假说阶段名，改为在建立或检验根因证据时按需调用多步外部调研 |
