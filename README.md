# project_templates

这是我自己的 AI 开发 workflow 模板仓库。

它不是业务代码脚手架，也不是一个“开箱即用的产品”。它是我在实际做项目时，持续沉淀出来的一套 AI 协作开发范式：先把项目约束写清楚，再让 AI 在约束内工作，并把需求、开发、调试、重构、审查、日志等过程持续落盘，避免开发过程只存在于聊天上下文里。

## 这个仓库解决什么问题

我不希望 AI 在一个长对话里自由发散式地开发项目。

我更希望 AI：

- 先和我讨论需求，确认边界，而不是直接开写代码
- 先把项目级规范写成 `AGENTS.md`，再进入开发
- 在需求、开发、重构、调试、审查等不同阶段，按不同治理规则工作
- 把关键过程沉淀到 `docs/`，让后续工作有迹可循、可复盘、可恢复

所以这个仓库本质上提供的不是“代码模板”，而是“AI 开发治理骨架”。

## 我怎么用这套 workflow

当我开始一个新项目时，通常会按下面的流程使用这个仓库：

1. 把当前模板目录里的 `AGENTS.md`、`skills/`、`docs/` 复制到新项目根目录。
2. 先和 AI 讨论需求，确认项目名称、项目类型、技术栈、目录结构、核心模块和架构设计。
3. 让 AI 根据讨论结果初始化 `AGENTS.md`。
4. 初始化时，AI 会把 `AGENTS.md` 里的占位符替换成项目真实内容，并按项目类型裁剪 `docs/_fragments/` 中的环境片段。
5. 我审核 `AGENTS.md`，确认它已经成为当前项目的唯一高层约束。
6. 后续开发阶段，AI 按任务类型触发对应的 Skill，并把需求文档、开发记录、调试记录、重构文档、审查报告、工作日志持续写入 `docs/`。

一句话概括这套流程：

> 先复制模板到项目里，再和 AI 对齐需求，由 AI 生成项目级 `AGENTS.md` 约束，之后让 `skills/` 驱动行为、让 `docs/` 沉淀证据。

## 三个核心角色

### 1. `AGENTS.md`

`AGENTS.md` 是项目级总约束。

它负责定义当前项目的定位、架构、目录结构、环境管理、开发规范、Skill 发现机制、工作流程和恢复路径。这个仓库里的 `AGENTS.md` 是母版，不是最终项目规范；复制到具体项目后，需要由 AI 按实际需求实例化。

### 2. `skills/`

`skills/` 存放的是治理规则，不是业务代码。

每个 Skill 都负责一个明确的工作场景，例如：

- `requirements-governance`：需求对齐与讨论收敛
- `search-planning`：多步调研规划与外部证据归档
- `development-governance`：开发 task 闭环、验证、文档同步
- `refactor-governance`：迁移、替换实现、兼容层清理
- `systematic-debugging`：问题复现、定位、修复、验证
- `code-review`：静态审查、E2E、API 测试与证据链
- `work-logs`：任务完成后的工作日志沉淀
- `auggie-mcp`：Auggie MCP 源码语义检索、影响面定位和任务索引恢复
- `git-governance`：共享分支同步、冲突处理、风险操作约束
- `codex-orchestration`：Codex CLI 的非交互执行与失败恢复
- `deepwiki`：项目文档生成治理
- `chrome-cdp`：浏览器自动化能力
- `pua`：高压场景下的行为约束器，防止 AI 放弃、摆烂、原地打转
- `engineering-writing-style`：供人阅读文字的直白表达约束，治理隐喻简称、套话和晦涩表述

这套拆分的目的，是给不同阶段设定明确 owner，避免 AI 在一个大上下文里同时扮演所有角色。

### 3. `docs/`

`docs/` 不是普通杂项文档目录，而是治理产物的固定归档位置。

这里会按类型沉淀：

- `docs/requirements/`：需求对齐和方案收敛
- `docs/development/`：开发计划、实现闭环、验证结果
- `docs/refactor/`：阶段性重构文档、门禁、退出条件
- `docs/debug/`：调试过程、根因定位、恢复路径
- `docs/code-review/`：质量保障报告和审查证据
- `docs/codex/`：Codex 编排产物
- `docs/deepwiki/`：项目文档产物
- `docs/references/`：外部资料、技术依据、治理决策参考
- `docs/work-logs/`：每日工作日志
- `docs/_fragments/`：环境管理和配置约束的静态模板片段

这意味着 AI 后续的关键动作，不应该只停留在聊天里，而要落到固定目录里，形成可复盘的事实链。

## 为什么这套方式能抑制 AI 扩散式开发

因为它不是靠“提醒 AI 认真一点”来治理，而是靠结构化约束来治理：

- 高层原则只放在 `AGENTS.md`
- 场景化规则拆到各个 Skill
- 细则通过 `SKILL.md + SPEC.md` 分层维护
- 不同阶段的产物写入固定 `docs/` 目录
- 任务完成后自动留下工作日志
- 上下文丢失时，优先从文档恢复事实，而不是让 AI 重新猜

这背后的目标很简单：

- 不接受“先能跑、以后再补”作为默认完成标准
- 不让“代码写了但验证没做、文档没补、清理没做”的半完成状态进入下一轮
- 不让同一个项目同时存在多个相互竞争的事实源

## 仓库结构概览

```text
project_templates/
├── AGENTS.md
├── README.md
├── skills/
│   ├── requirements-governance/
│   ├── search-planning/
│   ├── development-governance/
│   ├── refactor-governance/
│   ├── systematic-debugging/
│   ├── code-review/
│   ├── work-logs/
│   ├── auggie-mcp/
│   ├── git-governance/
│   ├── codex-orchestration/
│   ├── deepwiki/
│   ├── chrome-cdp/
│   ├── pua/
│   └── engineering-writing-style/
└── docs/
    ├── _fragments/
    ├── requirements/
    ├── development/
    ├── refactor/
    ├── debug/
    ├── code-review/
    ├── codex/
    ├── deepwiki/
    ├── references/
    └── work-logs/
```

## 使用边界

为了避免误解，这里明确几点：

- 这个仓库是 workflow 模板，不是可直接运行的业务项目。
- 当前仓库里的 `AGENTS.md` 是母版，复制到具体项目后才会被实例化为真正的项目规范。
- `docs/_fragments/` 是可裁剪片段库，不是所有项目都需要全部保留。
- `docs/` 下很多目录是预留产物槽位，是否有内容取决于项目是否已经进入对应阶段。
- 模板提供的是治理骨架，不会替你自动生成所有项目级文件；复制到具体项目后，仍需按项目实际情况补齐例如 `.env.example`、`docs/TODO.md` 之类的项目事实文件。

## 这套 workflow 的设计偏好

这套模板长期坚持几条偏好：

- 单一事实源优先，不鼓励同一规则在多个地方双写
- 先约束 AI 怎么工作，再让 AI 写业务代码
- 文档不是装饰，而是恢复上下文和验证事实的基础设施
- 规则粒度要和问题规模匹配，避免为了治理而制造新的文档负担
- 模板仓库本身要持续维护，因为它本身就是后续项目的参考样板

## 适合谁

如果你也有类似偏好，这个仓库可能适合你：

- 你会长期和 AI 结对开发，而不是只偶尔让它补几行代码
- 你希望项目过程可追溯、可恢复、可审计
- 你不希望 AI 在需求未收敛、事实源未确认时就直接动手
- 你希望需求、开发、调试、重构、review、日志都有固定归档位置

如果你只是想要一个快速生成业务代码的脚手架，这个仓库并不适合。

## 总结

这个仓库记录的不是某个具体项目，而是我自己的项目启动方式和 AI 协作方式。

它的核心思想不是“让 AI 更快写代码”，而是“让 AI 在一个可治理、可留痕、可恢复的框架里写代码”。
