<!--
================================================================================
                        AI 助手使用指南
                      （生成 AGENTS.md 后删除此区块）
================================================================================

【工作流程】

1. 确认模板文件已复制到项目根目录（AGENTS.md、skills/、docs/）
2. 读取 skills/requirements-governance/SKILL.md 与 SPEC.md，把新项目启动作为需求治理任务处理
3. 与用户讨论项目需求，确认：项目名称、类型、核心定位、非目标、技术栈、目录结构、核心模块、验证入口
4. 如涉及技术选型、架构对比或外部依据，读取 skills/search-planning/SKILL.md 与 SPEC.md，并将调研依据归档到 docs/references/
5. 将需求收敛结果写入 docs/requirements/YYYY-MM-DD-project-kickoff.md
6. 根据项目类型，保留 docs/_fragments/ 中对应的环境片段，删除不需要的片段，并同步删除 AGENTS.md 环境管理表格中对应的行
7. 替换所有 {{占位符}} 为项目实际内容
8. 删除本使用指南区块
9. 用户审核 AGENTS.md 与项目启动需求文档，确认无误后进入开发阶段

【占位符清单】

- {{项目名称}} / {{核心定位描述}} / {{技术重心表格}} / {{架构图}}
- {{目录结构}} / {{核心依赖表格}} / {{开发依赖表格}} / {{验证命令表格}}
- {{Node版本}} / {{Python版本}} / {{Go版本}}（环境片段中的占位符，按项目类型选用）

【片段选择】

- Python 项目：保留 python-env.md
- Node.js 项目：保留 nodejs-env.md
- TypeScript 项目：额外保留 typescript-config.md
- Go 项目：保留 go-env.md

================================================================================
-->

# {{项目名称}} - 项目指南

本文档是 AI Agent 和开发者的核心指南，定义了项目定位、架构设计和开发规范。

---

## 0. 总则：编码与字符安全规则（最高优先级）

- 所有文件必须使用 UTF-8 编码（无 BOM）
- 不允许将文件编码转换为 GBK、ANSI、Windows-1252、Latin-1 等编码
- 修改文件时必须保持原始文件编码
- 不得破坏中文、日文、emoji 等 Unicode 字符
- 如果文件编码不确定，必须先确认再修改
- 如果修改可能导致乱码，必须停止并提示用户
- 输出代码或修改代码时必须保持字符完整性
- 不允许自动转换文件编码

## 项目定位

### 核心定位

{{核心定位描述}}

### 技术重心

{{技术重心表格}}

### 架构概览

```
{{架构图}}
```

### 治理主线

本文件给 AI 助手定义唯一母流程：确认项目定位与根目录 → 校验环境与依赖 → 确认当前事实源 → 判断任务风险 → 按需触发 Skill → 执行实现与验证 → 完成 review 与记录 → 按恢复指南延续上下文。

后续章节都是这条母流程的展开，不是并列入口；当流程描述冲突时，以本段顺序和 §5 的事实源裁决规则为准。

新项目启动时，第一入口固定为 `requirements-governance`：先把项目目标、边界、架构方向和验证入口收敛为可审计需求，再实例化 `AGENTS.md`。不得在 `AGENTS.md` 和项目启动需求文档未经用户审核前直接进入开发治理或编码。

---

## 1. 项目结构声明

### 根目录结构

```
{{项目名称}}/
├── AGENTS.md                  # 本文件：AI Agent 和开发者核心指南
├── skills/                    # AI Skill 定义（技能规范，不存放产出物）
│   ├── work-logs/             # 工作日志技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── code-review/           # 质量保障技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── pua/                   # 项目级共享激励技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── auggie-mcp/            # Auggie MCP 能力抽象技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── development-governance/ # 开发治理技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── deepwiki/              # DeepWiki 文档生成技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── codex-orchestration/   # Codex 执行编排技能（跨项目复用）
│   │   ├── SKILL.md
│   │   ├── SPEC.md
│   │   └── scripts/run_codex_exec.sh
│   ├── git-governance/        # Git 协作治理技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── refactor-governance/   # 重构治理技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── requirements-governance/ # 需求治理技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── search-planning/       # 多步调研规划方法论技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   ├── systematic-debugging/  # 系统化调试技能
│   │   ├── SKILL.md
│   │   └── SPEC.md
│   └── chrome-cdp/            # Chrome DevTools Protocol 浏览器自动化技能
│       ├── SKILL.md
│       ├── SPEC.md
│       └── scripts/cdp.mjs
├── docs/                      # 文档产出物 + 静态片段
│   ├── _fragments/            # 环境管理等静态片段
│   ├── code-review/           # 质量保障报告产出目录
│   ├── codex/                 # Codex 编排产出目录
│   ├── deepwiki/              # DeepWiki 文档产出目录
│   ├── development/           # 开发治理产出目录
│   ├── refactor/              # 重构治理产出目录
│   ├── debug/                 # 系统化调试产出目录
│   ├── references/            # 外部资料、技术依据与决策参考归档
│   ├── requirements/          # 需求治理产出目录
│   └── work-logs/             # 工作日志产出目录
{{目录结构}}
```

### 关键子目录说明

| 目录 | 定位 | 说明 |
|------|------|------|
| `skills/` | Skill 定义 | 存放 AI 技能的规范文档，不存放产出物 |
| `docs/_fragments/` | 静态片段 | 环境管理、TypeScript 配置等可复用片段 |
| `docs/code-review/` | 产出目录空壳 | code-review Skill 的输出目录；本地产物默认不提交 |
| `docs/codex/` | 产出目录空壳 | codex-orchestration Skill 的输出目录；本地产物默认不提交 |
| `docs/deepwiki/` | 产出目录空壳 | deepwiki Skill 的输出目录；本地产物默认不提交 |
| `docs/development/` | 产出目录空壳 | development-governance Skill 的输出目录；本地产物默认不提交 |
| `docs/refactor/` | 产出目录空壳 | refactor-governance Skill 的输出目录；本地产物默认不提交 |
| `docs/debug/` | 产出目录空壳 | systematic-debugging Skill 的输出目录；本地产物默认不提交 |
| `docs/references/` | 参考目录空壳 | 外部调研、技术依据与决策参考归档目录；本地产物默认不提交 |
| `docs/requirements/` | 产出目录空壳 | requirements-governance Skill 的输出目录；本地产物默认不提交 |
| `docs/work-logs/` | 产出目录空壳 | work-logs Skill 的输出目录；本地产物默认不提交 |

---

## 2. 环境管理

**详细规范请参阅对应片段文档**：

| 项目类型   | 规范文档                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| Python     | [docs/_fragments/python-env.md](docs/_fragments/python-env.md)                |
| Node.js    | [docs/_fragments/nodejs-env.md](docs/_fragments/nodejs-env.md)                |
| TypeScript | [docs/_fragments/typescript-config.md](docs/_fragments/typescript-config.md)  |
| Go         | [docs/_fragments/go-env.md](docs/_fragments/go-env.md)                        |

### 环境变量

项目统一使用 `.env` 文件管理环境变量。

如项目提供根级 `.env.example`，则将其视为环境变量模板；若未提供，则由具体项目按实际配置面自行补齐。

---

## 3. 操作规范

**所有操作都必须在正确的环境中执行。**

```
开始任务 → 校验环境 → 校验依赖 → 执行操作
```

### .env 先行规则

每次排查服务、访问端口、调试接口之前，必须先读取 `.env` 文件确认端口和地址配置。

为什么：端口配置经常被修改但不提交，凭记忆假设端口号会导致在错误端口上浪费大量排查时间。先读 `.env` 是零成本的防御动作。

### 项目根判定规则

所有相对路径都必须基于**当前项目 `AGENTS.md` 所在目录**解析，而不是基于“最近的 git 仓库”猜测。

强制规则：

1. 当前项目根目录 = 当前项目 `AGENTS.md` 所在目录。
2. `docs/`、`skills/`、`scripts/`、各 Skill 的 `output_dir` 等相对路径，全部相对于该目录解析。
3. 不得仅按最近 `.git/` 所在目录推断项目根。
4. 如果父目录不是 git 仓库、子目录才是 git 仓库，默认仍以当前项目 `AGENTS.md` 所在目录为准；只有在任务明确要求进入子仓库时，才允许切换上下文。
5. 写入任何 `docs/*`、`skills/*` 或其他模板产物前，**必须先确认目标路径位于当前项目根目录之下**。

---

## 4. 依赖管理

**强制使用国内镜像源加速**（详见环境管理片段文档，参考路径 `docs/_fragments/`）。

### 核心依赖

{{核心依赖表格}}

### 开发依赖

{{开发依赖表格}}

### 验证入口

{{验证命令表格}}

实例化本模板时，必须补齐与项目匹配的安装、类型检查、测试、构建、E2E 或发布前验证命令；若某类命令不适用，必须写明 `N/A` 和替代验证方式。若项目已有 Makefile、CI workflow 或脚本聚合入口，则以该入口作为验证命令的事实源。

---

## 5. 项目管理规范

本节定义 AI 助手必须长期遵守的项目治理原则。`AGENTS.md` 负责高层约束，`skills/*/SKILL.md` 负责场景触发与执行流程，`skills/*/SPEC.md` 负责字段、模板和门禁细则；不得把同一条细则在多个位置重复维护。

### 代码质量底线

| 约束 | 为什么 |
|------|--------|
| 不允许简化代码或省略错误处理 | 简化代码是技术债的起点，省略错误处理是生产事故的伏笔 |
| 解释说明遵循"为什么"而非"是什么" | "是什么"读代码就知道，"为什么"才是知识传承的核心 |
| 源码至上：分析问题前必须先读源码 | LLM 内置知识可能过时或与项目实际不符，只有源码是当前真相 |
| 代码语义检索优先 | 不知道文件位置、调用链或影响面时，优先按 `skills/auggie-mcp/SKILL.md` 使用 Auggie MCP 做语义检索；检索结果必须读取真实文件确认，避免缓存或索引不一致 |
| 验证入口优先 | 按 §4 验证入口选择与改动匹配的最小充分验证；无实际验证证据不得宣称完成 |

### 单一事实源与过时信息治理

AI 助手后续迭代时会读取历史文档、日志、TODO、需求记录和参考资料。过时事实如果没有显式淘汰，会污染上下文并诱导错误决策，因此每次非平凡变更都必须先确认当前唯一权威事实源。

默认权威来源按领域判定：

| 领域 | 默认权威来源 | 不可替代来源 |
|------|--------------|--------------|
| 项目级约束 | `AGENTS.md` | 聊天记忆、旧日志、未同步 README |
| 场景流程 | 对应 `skills/*/SKILL.md` 与 `SPEC.md` | `AGENTS.md` 中的旧摘要、历史执行记录 |
| 当前代码行为 | 真实源码、测试、配置和运行结果 | 旧需求文档、旧工作日志、未验证推断 |
| 当前开发边界 | 用户最新确认、当前阶段的 `docs/requirements/`、`docs/development/` 或 `docs/refactor/` 文档 | 过期 TODO、历史阶段文档 |
| 进度索引 | `skills/auggie-mcp/` 暴露的外部任务索引能力、`docs/TODO.md` | 不能裁决接口、配置、架构和完成状态 |
| 历史背景 | `docs/work-logs/`、`docs/references/`、旧需求/旧重构记录 | 不能覆盖当前源码、当前阶段文档和最新确认 |

| 约束 | 为什么 |
|------|--------|
| 先确认权威来源 | 需求、架构、接口、配置、环境、测试和部署规则必须先明确以哪个文件或源码路径为准 |
| 单一事实源优先 | 同一规则不得长期分散在多个文档、脚本或注释中维护，避免 AI 在不同来源之间随机取信 |
| 旧事实源必须显式淘汰 | 当前说明文档、脚本、配置或入口失效时，必须删除、改写，或在文件顶部标注"已淘汰"及替代来源 |
| 历史归档不得回改为当前事实 | `docs/work-logs/` 和外部参考归档保留审计价值；不要求回改历史，只能在当前权威文档中声明替代关系 |
| 冲突信息必须暂停确认 | 如果 TODO、阶段文档、工作日志、README、源码或配置互相冲突，不得自行猜测，应先说明冲突并确认当前权威来源 |
| 进度索引不能裁决事实 | 外部任务索引与 `docs/TODO.md` 只帮助定位下一步，不得覆盖源码、配置、当前阶段文档或用户最新确认 |
| 历史资料只作背景 | `docs/work-logs/`、`docs/references/`、旧需求记录和旧重构记录默认不能覆盖当前源码、当前任务文档和已确认的最新事实源；被当前阶段文档引用时，只作为证据而非裁判 |
| 新事实源生效必须收敛旧事实 | 新实现、新接口、新配置或新流程生效时，必须同步处理旧事实源，防止后续 AI 基于过时信息继续演化 |

### 反最小化工作原则

AI 助手不得把“工作量小、改动少、立即解决”作为默认优化目标。除非用户明确要求临时止血，开发决策的优先级必须是：正确性与安全 > 架构一致性 > 可维护性与可扩展性 > 验证闭环 > 改动规模。

| 约束 | 为什么 |
|------|--------|
| 架构影响先行 | 非平凡修改前必须说明影响的层、模块、接口、数据流和扩展点，避免只在调用点堆补丁 |
| 高内聚、低耦合 | 新逻辑必须放在符合职责边界的位置，禁止把业务规则、基础设施、展示层或脚本逻辑混在一起 |
| 抽象服务真实复杂度 | 高层次抽象必须用于隔离变化、复用能力或收敛复杂度，禁止为了省当前实现制造错误抽象或过度抽象 |
| 扩展性优先于一次性补丁 | 面向明确演进方向设计接口、配置和数据结构，不把临时判断固化为长期分支 |
| 高并发与高压场景先评估 | 涉及 IO、队列、缓存、连接池、共享状态、长任务时，必须考虑并发安全、幂等、限流/背压、超时、重试、取消和观测性 |
| 资源生命周期必须闭环 | 文件句柄、网络连接、定时器、订阅、协程/线程/任务、缓存和大对象必须有释放、回收或上限策略 |
| 失败路径与边界输入显式处理 | 不允许吞错、弱化权限校验、跳过输入验证或只覆盖 happy path |
| 架构取舍必须升级确认 | 涉及重写、迁移、跨层改动、破坏兼容或长期临时方案时，必须先给出方案、权衡、成本和退出条件，等待用户确认 |

### 开发与重构治理底线

| 约束 | 为什么 |
|------|--------|
| 禁止默认选择“先能跑、以后再补” | 临时方案一旦被当成完成态，技术债、文档债和验证债会同时扩散 |
| 禁止用“最少改动”绕过架构边界 | 最小 diff 若固化错误抽象、错误依赖或错误事实源，后续维护成本会指数放大 |
| 每个 task 都必须完成代码、测试、文档、验证、清理与 review 闭环 | 不让“代码完成但验证/文档未完成”的半状态进入下一 task |
| 临时兼容层、双轨实现、迁移脚本、特例分支必须声明退出条件 | 过渡态最容易固化为永久态，必须在设计时就绑定清理责任 |
| 新事实源生效时，旧事实源必须在同阶段收敛 | 单一事实源一旦失效，AI 和开发者会基于不同真相继续工作 |
| 涉及架构、并发、资源、安全时必须扩大影响面分析 | 这些问题通常不会在局部 happy path 暴露，必须在设计阶段提前防守 |
| 文档粒度必须匹配问题规模 | 治理的目标是减少失真，不是制造新的文档负担 |
| 未确认项目根不得写产物 | 父目录与子仓库并存时，最容易把 `docs/*`、日志、计划或报告写到错误位置 |

### 文档规范

- 禁止使用 emoji 表情
- 流程图、架构图使用中文标注
- 代码注释使用中文

### 公共仓库与私有产物边界

公共模板仓库默认只维护 `AGENTS.md`、`skills/`、`.gitignore`、`docs/_fragments/` 和 `docs/` 目录空壳。`docs/` 下的需求文档、开发记录、重构记录、调试记录、审查报告、工作日志和参考资料属于本地治理产物，默认不得提交到公共仓库。

`docs/` 空壳通过 `.gitkeep` 占位文件保留目录结构。`.gitkeep` 不是 Git 参数，只是用于让 Git 跟踪空目录的占位文件；不得因为清理本地产物而删除已提交的 `.gitkeep`。

根目录 `.gitignore` 是私有产物默认不入库的 Git 事实源。若用户明确要求公开某个 `docs/` 产物，必须先说明公开范围与原因，再在 `.gitignore` 中添加精确的 `!` 例外规则并单独提交；不得批量放开整个 `docs/` 目录。

已经被 Git 跟踪的历史 `docs/` 文件不会因为 `.gitignore` 自动停止跟踪。需要调整跟踪范围时，必须使用 `git rm --cached` 做索引清理，保留本地文件，并作为单独的仓库治理提交处理。

### 提交规范

- 提交前必须执行与改动匹配的验证：类型检查、构建、测试、文档检查或等价的最小充分验证
- 提交信息必须遵循 `skills/git-governance/SPEC.md` §9 标准提交信息规范
- 提交信息使用中文描述，且必须包含 body 写清背景、变更、影响与边界
- 锁文件必须提交到版本控制

### Git 协作规范

| 约束 | 为什么 |
| ---- | ---- |
| 共享分支操作必须保守 | 防止隐式 merge、历史重写或强推扩大协作风险 |
| 高风险 Git 操作必须先采集基线并具备恢复路径 | 保证 merge/rebase/冲突处理失败时可以回滚 |
| 双端开发必须串行同步 | 避免 WSL、Remote SSH 等多端并发提交后互相拉取，产生持续分叉与冲突放大 |

具体基线采集、merge/rebase 前置条件、提交信息模板和失败恢复流程，以 `skills/git-governance/SKILL.md` 与 `skills/git-governance/SPEC.md` 为唯一维护来源。

---

## 6. Skill 发现机制

AI 助手在接收到任务时，必须按以下流程判断是否需要触发 Skill。`AGENTS.md` 只维护 Skill 的入口位置和职责摘要；触发条件、output_dir、流程和字段细则以各 Skill 自身的 `SKILL.md` / `SPEC.md` 为准。

```
1. 先定位项目根：当前项目 `AGENTS.md` 所在目录即项目根
2. 列出 skills/ 目录下所有子目录
3. 根据任务意图、风险等级、涉及文件和用户显式指令选择候选 Skill
4. 读取候选 Skill 的 SKILL.md；如有关联 SPEC.md，也一并读取
5. 以 Skill 自身声明的触发条件、output_dir 和执行流程为准
6. 如果多个 Skill 同时匹配，按任务主目标选择，不因关键词重复生成重复产物
```

### Skill 入口索引

| skill_id | 路径 | 定位 |
|----------|------|------|
| work-logs | [skills/work-logs/SKILL.md](skills/work-logs/SKILL.md) | 工作日志与任务完成记录 |
| code-review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | 静态审查、E2E、API 测试与质量报告 |
| pua | [skills/pua/SKILL.md](skills/pua/SKILL.md) | 失败、摆烂、被动等待时的行为约束 |
| auggie-mcp | [skills/auggie-mcp/SKILL.md](skills/auggie-mcp/SKILL.md) | Auggie MCP 源码语义检索、影响面定位和外部任务索引恢复 |
| development-governance | [skills/development-governance/SKILL.md](skills/development-governance/SKILL.md) | 中风险及以上开发闭环 |
| deepwiki | [skills/deepwiki/SKILL.md](skills/deepwiki/SKILL.md) | 项目文档生成治理 |
| codex-orchestration | [skills/codex-orchestration/SKILL.md](skills/codex-orchestration/SKILL.md) | Codex CLI 非交互执行与失败恢复，仅在用户显式要求时使用 |
| git-governance | [skills/git-governance/SKILL.md](skills/git-governance/SKILL.md) | Git 同步、提交、冲突和高风险历史操作 |
| refactor-governance | [skills/refactor-governance/SKILL.md](skills/refactor-governance/SKILL.md) | 重构、迁移、兼容层和旧事实源清理 |
| requirements-governance | [skills/requirements-governance/SKILL.md](skills/requirements-governance/SKILL.md) | 需求对齐、方案讨论和 PRD |
| search-planning | [skills/search-planning/SKILL.md](skills/search-planning/SKILL.md) | 多步调研规划：意图、复杂度、子查询、搜索词、工具映射、执行顺序 |
| systematic-debugging | [skills/systematic-debugging/SKILL.md](skills/systematic-debugging/SKILL.md) | 复现、定位、修复和验证问题 |
| chrome-cdp | [skills/chrome-cdp/SKILL.md](skills/chrome-cdp/SKILL.md) | Chrome 页面检查、截图、交互和浏览器自动化 |

如果 `bug`、`问题` 等词同时匹配调试与质量保障场景，先判断主目标：需要定位并修复根因时优先 `systematic-debugging`；需要审查、测试或生成质量报告时优先 `code-review`。

### Skill 执行边界

- Skill 声明的 output_dir 一律相对当前项目根解析；output_dir=`N/A` 时只执行行为约束，不写产物。
- 同一任务可以参考多个 Skill，但只能按主目标选择主产物目录，避免因关键词重叠生成重复文档。
- 新项目启动的主 Skill 固定为 `requirements-governance`；如需要外部资料、技术选型或社区实践支撑，再按需触发 `search-planning`，其产物只能作为证据，必须被需求文档或 `AGENTS.md` 引用后才成为当前决策依据。

---

## 7. 三阶段工作流程

### 第一阶段：项目初始化与需求对齐

**目标**：复制模板、收敛项目启动需求、敲定技术架构，产出项目启动需求文档和完整的 AGENTS.md

```
读取 AGENTS 模板
  -> 读取 requirements-governance/SKILL.md 与 SPEC.md
  -> 必要时读取 search-planning/SKILL.md 与 SPEC.md
  -> 生成 docs/requirements/YYYY-MM-DD-project-kickoff.md
  -> 实例化 AGENTS.md
  -> 用户审核
  -> 进入开发阶段
```

**执行要求**：

1. 确认模板文件已复制到项目根目录，并以当前 `AGENTS.md` 所在目录作为项目根。
2. 触发 `requirements-governance`，按决策树澄清项目启动需求；每轮只追问一个会改变范围、架构、验收或风险等级的关键问题，并给出推荐答案和理由。
3. 至少确认项目名称、项目类型、核心定位、目标用户、核心目标、非目标、技术栈、目录结构、核心模块、架构方向、核心依赖、开发依赖、验证入口、部署/运行约束、安全与隐私边界。
4. 涉及技术选型、架构对比、社区实践或外部依据时，触发 `search-planning`，将调研计划与结论写入 `docs/references/YYYY-MM-DD-{scope}.md`；参考资料只有被项目启动需求文档或 `AGENTS.md` 引用后，才成为当前决策依据。
5. 将需求收敛结果写入 `docs/requirements/YYYY-MM-DD-project-kickoff.md`，作为进入开发前的项目启动需求事实源。
6. 根据项目类型保留 `docs/_fragments/` 中对应的环境片段，删除不适用片段，并同步删除 `AGENTS.md` 环境管理表格中对应行。
7. AI 助手根据已确认需求实例化 `AGENTS.md`：替换所有 `{{占位符}}`，补齐验证命令表，删除顶部 AI 助手使用指南区块。
8. 用户审核 `AGENTS.md` 和项目启动需求文档，确认后才能进入第二阶段。未经确认不得触发 `development-governance` 开始编码。

**产出物**：
- 完整的 `AGENTS.md`（项目约束的唯一权威来源）
- `docs/requirements/YYYY-MM-DD-project-kickoff.md`（项目启动需求事实源，本地产物默认不提交）
- `docs/references/YYYY-MM-DD-{scope}.md`（按需产出，外部依据归档，本地产物默认不提交）
- 初始化的 `docs/` 和 `skills/` 目录结构

### 第二阶段：代码开发

**前置条件**：AGENTS.md 已经过用户审核确认

**约束**：
- AI 助手的所有行为受 AGENTS.md 约束
- 事实源驱动：先确认当前权威来源，再引用 `docs/references/` 等证据；已标记"已淘汰"的文档不得作为当前决策依据
- 不允许简化代码或省略错误处理
- 严格类型：遵循本文件和 `docs/_fragments/` 中声明的语言、类型与配置约束
- 非平凡开发必须先说明影响面、架构边界、质量门禁和风险处置

**风险分级闭环**：

| 风险等级 | 判定信号 | 执行要求 |
|----------|----------|----------|
| 小 | 单文件或局部修复；不新增接口、配置、脚本、事实源；不触及并发、资源、安全、数据一致性 | 读取真实源码后直接处理，按验证入口执行最相关验证；不强制新增阶段文档，但必须同步受影响的当前说明、测试或配置，并完成主 AI 自检 |
| 中 | 多文件改动；新增接口、配置、脚本；需要同步文档、测试或调用方 | 先说明影响面、事实源、架构边界和验证方式；触发 `development-governance`，并留下必要闭环记录 |
| 高 | 涉及架构迁移、兼容层、双轨实现、并发/资源/安全边界、数据迁移、破坏兼容或长期临时方案 | 先给出方案、权衡、风险、回退和退出条件，等待用户确认；触发 `development-governance`，若核心是迁移、替换实现、兼容层或旧事实源清理，则改用 `refactor-governance`；同时扩大 review 范围 |

临时止血必须由用户明确批准，并记录适用范围、风险、退出条件和最晚清理阶段。新事实源生效时，旧事实源必须在同阶段删除、改写或标注"已淘汰"，避免多个权威并存。

**开发/重构 Skill 触发要求**：
- 中风险及以上开发必须进入对应治理 Skill 的流程
- 涉及迁移、替换实现、兼容层、阶段切换或旧事实源清理时，必须优先选择重构治理流程
- 当任务天然包含阶段门禁、退出条件或清理责任时，不允许绕过治理 Skill 直接进入编码
- 扩大 review 范围不能替代开发治理或重构治理

**开发节奏**：

```
制定 tasks -> 用户审核 tasks -> 执行 task -> review 代码 -> 推进下一个 task
```

**Review 约束**：

- review 是开发闭环的强制环节，但不绑定特定执行器或 CLI
- 默认由当前 AI 助手完成自检与代码审查；中高风险变更可并行委派子代理、人工 reviewer 或外部审查工具
- 若使用辅助 reviewer，最终结论必须由主 AI 助手合并、去重并判断是否阻塞交付
- 禁止因辅助 reviewer 不可用、网络失败或工具缺失跳过 review；必须降级为主 AI 助手直接审查并说明范围
- 只有用户明确要求 Codex CLI 非交互执行、恢复或失败归档时，才触发 `codex-orchestration`

**Skills 触发**：
- AI 助手根据 §6 Skill 发现机制和各 `SKILL.md` 的触发条件，自动触发对应 Skill
- 用户也可以显式指令触发 Skill（如"执行 code review"、"生成项目文档"）
- AI 助手触发 Skill 前，必须先读取对应的 `SKILL.md`；触发条件、产物目录、记录粒度和退出门禁以 Skill 自身为准

### 第三阶段：工作日志记录

任务完成后的记录方式以 `skills/work-logs/SKILL.md` 与 `skills/work-logs/SPEC.md` 为准。

---

## 8. 恢复指南（上下文丢失时）

1. 读取本文档（AGENTS.md），理解项目定位和约束
2. 读取当前阶段文档：`docs/development/`、`docs/refactor/`、`docs/requirements/` 下与当前任务相关的最新文档（如有）
3. 读取真实源码、配置、测试和验证入口，确认当前事实
4. 按 `skills/auggie-mcp/SKILL.md` 检查外部任务索引与 `docs/TODO.md`，只用于恢复进度和下一步候选任务
5. 读取最新 `docs/work-logs/YYYY-MM-DD.md`，了解历史过程和最近操作
6. 读取 `docs/references/` 下被当前阶段文档引用的参考资料，恢复技术决策背景
7. 如果恢复过程中发现事实源冲突，必须优先采用已确认的当前权威来源；已标记"已淘汰"的资料只能作为历史背景，不得作为当前实现依据

---

## 9. 状态追踪

| 类型 | 工具/文件 | 用途 | 限制 |
|------|-----------|------|------|
| 任务索引 | `skills/auggie-mcp/` 外部任务索引能力 | 细粒度任务追踪 | 依赖服务可用性；不能裁决接口、配置、架构和完成状态 |
| 任务索引 | `docs/TODO.md` | 粗粒度进度追踪 | 只能定位下一步；不能覆盖当前阶段文档、源码、配置或用户最新确认 |
| 阶段事实 | `docs/development/`、`docs/refactor/`、`docs/requirements/` | 当前任务边界、完成定义、阶段门禁 | 若与源码或用户最新确认冲突，必须暂停确认 |
| 过程记录 | `docs/work-logs/` | 历史操作、决策过程和恢复线索 | 只能作为背景，不能单独裁决当前事实 |

当状态索引与事实源冲突时，不以 TODO 或日志直接判真；必须回到当前权威来源核对，并在必要时更新或标注过时信息。
