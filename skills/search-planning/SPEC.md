# 搜索规划 Skill 规范

**版本**: 1.0.0
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

字段语义详细参考：[GrokSearch/skills/search-planning/references/phase-templates.md](https://github.com/AoManoh/GrokSearch/blob/main/skills/search-planning/references/phase-templates.md)

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

## 8. 与外部规范的关系

- 上游英文 process-only skill：[`AoManoh/GrokSearch/skills/search-planning/`](https://github.com/AoManoh/GrokSearch/tree/main/skills/search-planning) 是同一方法论的 Anthropic Claude Skills 形态，可直接挂载到 Claude / Claude Code 客户端使用。
- 本规范是该方法论的"治理化中文版"：补充了 `output_dir`、退出门禁、与其他 governance skill 的协作位点，并去掉了对具体 LLM 客户端的依赖。
- 工具实现层（`mcp5_*` MCP 工具、`grok-web-search` 等可执行脚本）属于"事实源 / 可执行体"，本规范不与具体实现绑定；当上游脚本接口变更时，本规范保持稳定，仅由 §3 引用链接更新。

---

## 9. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-04-30 | 初始版本，依据 GrokSearch search-planning Anthropic Skill 治理化改写 |
