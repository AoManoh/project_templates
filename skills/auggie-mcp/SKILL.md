---
name: auggie-mcp
description: Use when a task needs Auggie/Augment MCP capabilities: semantic codebase retrieval, source-grounded impact analysis, call-chain discovery, root-cause tracing, or external task/progress index recovery. Treat retrieved results as leads only; verify with real files before editing or making claims.
---

# Auggie MCP Skill

**skill_id**: `auggie-mcp`
**版本**: 1.0.0
**output_dir**: `N/A`

---

## 1. 概述

本技能把当前项目可用的 Auggie/Augment MCP 能力抽象为通用治理入口，避免在 `AGENTS.md` 和其他 Skill 中直接绑定具体工具名称。

它覆盖两类能力：

| 能力 | 用途 | 事实等级 |
|------|------|----------|
| 源码语义检索 | 定位文件、调用链、影响面、根因线索 | 线索，必须读取真实文件确认 |
| 外部任务索引 | 恢复任务进度、候选下一步、上下文断点 | 进度索引，不能裁决技术事实 |

### 1.1 触发条件

| 触发方式 | 条件 |
|----------|------|
| 显式触发 | 用户指令包含：`auggie`、`Auggie MCP`、`Augment`、`代码语义检索`、`任务索引`、`影响面分析` |
| 场景触发 | 不知道相关代码在哪里、需要跨模块理解、需要恢复任务进度、需要基于源码验证历史说法 |

### 1.2 前置依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| Auggie MCP | 语义检索或任务索引能力提供者 | 可用时优先 |
| 文件读取工具 | 确认真实源码、配置和文档内容 | 必需 |
| 精确文本搜索 | MCP 不可用或需要全量匹配时的降级路径 | 必需 |

### 1.3 关联规范

详细约束见：[SPEC.md](./SPEC.md)

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| 读取 SPEC.md | 使用本 Skill 前 |
| 语义检索前必须确认项目根目录 | 调用 MCP 前 |
| MCP 检索结果必须用真实文件确认 | 编辑、引用或下结论前 |
| 外部任务索引只能用于恢复进度 | 上下文恢复时 |
| MCP 不可用时必须降级为文件列表、精确搜索和真实文件读取 | 工具失败后 |

---

## 3. 快速参考

### 3.1 源码语义检索

适用于：

- 不知道代码在哪个文件或模块中
- 需要定位调用链、接口流转、配置来源
- 需要评估改动影响面
- 需要为 review、debug、refactor 找根因线索

执行顺序：

1. 用项目根目录作为检索范围。
2. 用自然语言描述要找的行为、模块、接口或风险。
3. 将检索结果视为候选线索。
4. 打开真实文件确认内容、行号、上下文和当前状态。
5. 若检索结果与真实文件冲突，以真实文件为准。

### 3.2 外部任务索引

适用于：

- 长上下文恢复
- 多轮开发后确认候选下一步
- 需要回看任务拆分和进度标记

关键边界：

- 任务索引不是需求、接口、配置、架构或完成状态的事实源。
- 任务索引与源码、当前阶段文档或用户最新确认冲突时，必须回到当前权威来源核对。
- 任务索引过期时，不要求回改历史；应在当前阶段文档或 `AGENTS.md` 中声明新的权威来源。

### 3.3 降级策略

| 失败场景 | 处理 |
|----------|------|
| Auggie MCP 不可用 | 使用文件列表、精确文本搜索和真实文件读取 |
| 语义检索结果过宽 | 收窄查询目标，增加模块名、接口名、错误信息或文件类型 |
| 语义检索结果疑似过期 | 打开真实文件确认；必要时用精确搜索补全 |
| 任务索引不可用 | 使用 `docs/TODO.md`、当前阶段文档和工作日志恢复进度 |

---

## 4. 与其他 Skill 的关系

- `development-governance`、`refactor-governance`、`systematic-debugging` 和 `code-review` 可依赖本 Skill 做源码语义检索。
- `AGENTS.md` 只声明本 Skill 的入口和事实源边界，不维护具体 MCP 工具细节。
- 本 Skill 不写产物；所有阶段记录仍写入调用方 Skill 的 output_dir。
