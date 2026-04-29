<!--
================================================================================
                        AI 助手使用指南
                      （生成 AGENTS.md 后删除此区块）
================================================================================

【工作流程】

1. 确认模板文件已复制到项目根目录（AGENTS.md、skills/、docs/）
2. 与用户讨论项目需求，确认：项目名称、类型、技术栈、目录结构
3. 根据项目类型，保留 docs/_fragments/ 中对应的环境片段，删除不需要的片段，并同步删除 AGENTS.md 环境管理表格中对应的行
4. 替换所有 {{占位符}} 为项目实际内容
5. 删除本使用指南区块
6. 用户审核 AGENTS.md，确认无误后进入开发阶段

【占位符清单】

- {{项目名称}} / {{核心定位描述}} / {{技术重心表格}} / {{架构图}}
- {{目录结构}} / {{核心依赖表格}} / {{开发依赖表格}}
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
│   ├── references/            # 外部资料与决策参考
│   ├── requirements/          # 需求治理产出目录
│   └── work-logs/             # 工作日志产出目录
{{目录结构}}
```

### 关键子目录说明

| 目录 | 定位 | 说明 |
|------|------|------|
| `skills/` | Skill 定义 | 存放 AI 技能的规范文档，不存放产出物 |
| `skills/pua/` | Skill 定义 | 项目级共享激励技能，约束 AI 在失败、摆烂、被动等待时的行为 |
| `skills/development-governance/` | Skill 定义 | 开发阶段治理，防止“先能跑再补”与验证/文档滞后 |
| `skills/codex-orchestration/` | Skill 定义 | Codex CLI 调用编排与失败恢复，支持跨项目复用 |
| `skills/git-governance/` | Skill 定义 | Git 协作治理规范，统一分支同步与冲突处理流程 |
| `skills/refactor-governance/` | Skill 定义 | 重构阶段治理，定义阶段门禁、迁移边界与清理责任 |
| `skills/requirements-governance/` | Skill 定义 | 需求对齐治理，约束讨论节奏、方案对比与边界确认 |
| `skills/systematic-debugging/` | Skill 定义 | 系统化调试治理，约束根因定位、修复验证与调试记录 |
| `skills/chrome-cdp/` | Skill 定义 | Chrome DevTools Protocol 浏览器自动化，连接本地 Chrome 进行页面检查、截图、交互，支持独立实例与 profile 隔离 |
| `docs/_fragments/` | 静态片段 | 环境管理、TypeScript 配置等可复用片段 |
| `docs/code-review/` | 产出目录 | code-review Skill 的输出目录 |
| `docs/codex/` | 产出目录 | codex-orchestration Skill 的输出目录 |
| `docs/deepwiki/` | 产出目录 | deepwiki Skill 的输出目录 |
| `docs/development/` | 产出目录 | development-governance Skill 的输出目录 |
| `docs/refactor/` | 产出目录 | refactor-governance Skill 的输出目录 |
| `docs/debug/` | 产出目录 | systematic-debugging Skill 的输出目录 |
| `docs/references/` | 参考目录 | 外部调研、技术决策与事实依据归档目录 |
| `docs/requirements/` | 产出目录 | requirements-governance Skill 的输出目录 |
| `docs/work-logs/` | 产出目录 | work-logs Skill 的输出目录 |

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

---

## 5. 项目管理规范

### 代码质量底线

| 约束 | 为什么 |
|------|--------|
| 不允许简化代码或省略错误处理 | 简化代码是技术债的起点，省略错误处理是生产事故的伏笔 |
| 解释说明遵循"为什么"而非"是什么" | "是什么"读代码就知道，"为什么"才是知识传承的核心 |
| 源码至上：分析问题前必须先读源码 | LLM 内置知识可能过时或与项目实际不符，只有源码是当前真相 |
| 代码检索优先级：Augment Codebase > view 工具 | Augment Codebase 提供语义检索能力，但检索结果必须用 view 工具读取真实文件确认，避免缓存不一致 |
| 无验证证据不得宣称完成 | "应该通过"不是验证，必须引用当前轮次实际执行的验证命令与完整输出 |

### 开发与重构治理底线

| 约束 | 为什么 |
|------|--------|
| 禁止默认选择“先能跑、以后再补” | 临时方案一旦被当成完成态，技术债、文档债和验证债会同时扩散 |
| 每个 task 都必须完成代码、测试、文档、验证、清理与 review 闭环 | 不让“代码完成但验证/文档未完成”的半状态进入下一 task |
| 临时兼容层、双轨实现、迁移脚本、特例分支必须声明退出条件 | 过渡态最容易固化为永久态，必须在设计时就绑定清理责任 |
| 新事实源生效时，旧事实源必须在同阶段删除或改写 | 单一事实源一旦失效，AI 和开发者会基于不同真相继续工作 |
| 文档粒度必须匹配问题规模 | 治理的目标是减少失真，不是制造新的文档负担 |
| 未确认项目根不得写产物 | 父目录与子仓库并存时，最容易把 `docs/*`、日志、计划或报告写到错误位置 |

### 文档规范

- 禁止使用 emoji 表情
- 流程图、架构图使用中文标注
- 代码注释使用中文

### 提交规范

- 提交前确保类型检查和构建通过
- 提交信息必须遵循 `skills/git-governance/SPEC.md` §9 标准提交信息规范
- 提交信息使用中文描述，且必须包含 body 写清背景、变更、影响与边界
- 锁文件必须提交到版本控制

### Git 协作规范

| 约束 | 为什么 |
| ---- | ---- |
| 默认使用 `git pull --ff-only origin <branch>` 同步 | 防止隐式 merge commit 污染历史，第一时间暴露分叉 |
| `push` 被拒绝时，默认 `fetch + merge origin/<branch>` 后再推送 | 对共享分支更稳妥，避免重放大量差异导致超时或遗漏 |
| 含大体量数据目录（如 `vector_db/`）或已共享的分支，禁止直接 `rebase` | rebase 会改写历史并重放大文件差异，失败恢复成本高 |
| 执行 merge/rebase 前必须创建救援分支 `rescue/<timestamp>` | 保证任意失败场景都能快速回滚 |
| 双端开发（WSL + Remote SSH）必须采用单向同步链路 | 避免两端并发提交后相互拉取，产生持续分叉与冲突放大 |

**标准流程（共享分支）**：

```bash
# 1) 日常同步
git fetch origin
git pull --ff-only origin <branch>

# 2) push 被拒绝（non-fast-forward）
git fetch origin
git branch rescue/<timestamp>
git merge origin/<branch>
git push origin <branch>
```

---

## 6. Skill 发现机制

AI 助手在接收到任务时，必须按以下流程判断是否需要触发 Skill：

```
1. 先定位项目根：当前项目 `AGENTS.md` 所在目录即项目根
2. 列出 skills/ 目录下所有子目录
3. 根据任务关键词匹配候选 Skill（见下表）
4. 读取候选 Skill 的 SKILL.md，确认触发条件是否满足
5. 如果满足，按 SKILL.md 定义的执行流程执行
6. 若 Skill 声明了 output_dir，则该路径一律相对项目根解析；若 output_dir 为 `N/A`，则遵守其行为约束即可
```

### Skill 注册表

| skill_id | 路径 | 触发关键词 | output_dir |
|----------|------|-----------|------------|
| work-logs | [skills/work-logs/SKILL.md](skills/work-logs/SKILL.md) | 任务完成时自动触发；`日志`、`记录` | `docs/work-logs/` |
| code-review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | `测试`、`E2E`、`code review`、`代码审查`、`API 测试` | `docs/code-review/` |
| pua | [skills/pua/SKILL.md](skills/pua/SKILL.md) | `pua`、`try harder`、`不要放弃`、`换个方法`、`为什么还不行`、`你再试试`、`stop giving up` | `N/A` |
| development-governance | [skills/development-governance/SKILL.md](skills/development-governance/SKILL.md) | `开发`、`实现`、`新功能`、`feature`、`需求落地`、`接口实现` | `docs/development/` |
| deepwiki | [skills/deepwiki/SKILL.md](skills/deepwiki/SKILL.md) | `deepwiki`、`wiki文档`、`项目文档`、`技术文档` | `docs/deepwiki/` |
| codex-orchestration | [skills/codex-orchestration/SKILL.md](skills/codex-orchestration/SKILL.md) | `codex`、`CLI`、`resume`、`超时`、`reconnect`、`交叉审查` | `docs/codex/` |
| git-governance | [skills/git-governance/SKILL.md](skills/git-governance/SKILL.md) | `git`、`push 被拒绝`、`rebase`、`merge`、`分支同步`、`冲突` | `docs/work-logs/` |
| refactor-governance | [skills/refactor-governance/SKILL.md](skills/refactor-governance/SKILL.md) | `重构`、`迁移`、`替换实现`、`抽象收敛`、`兼容层清理`、`refactor` | `docs/refactor/` |
| requirements-governance | [skills/requirements-governance/SKILL.md](skills/requirements-governance/SKILL.md) | `需求`、`讨论需求`、`需求对齐`、`brainstorming`、`方案讨论`、`PRD` | `docs/requirements/` |
| systematic-debugging | [skills/systematic-debugging/SKILL.md](skills/systematic-debugging/SKILL.md) | `调试`、`debug`、`排查`、`定位问题`、`根因分析`、`bug` | `docs/debug/` |
| chrome-cdp | [skills/chrome-cdp/SKILL.md](skills/chrome-cdp/SKILL.md) | `chrome`、`浏览器`、`CDP`、`截图`、`页面检查`、`自动化操作`、`标签页`、`profile`、`隔离`、`独立实例`、`浏览器实例` | `N/A` |

### 强制行为

| 行为 | 时机 |
|------|------|
| 触发 Skill 前，必须先读取对应的 SKILL.md | 执行 Skill 前 |
| 如果 Skill 有关联 SPEC.md，也必须读取 | 执行 Skill 前 |
| 若 Skill 声明了 output_dir，则产出物必须写入该目录；若 output_dir=`N/A`，则只执行行为约束 | 执行 Skill 后 |

---

## 7. 三阶段工作流程

### 第一阶段：项目初始化与需求对齐

**目标**：复制模板、讨论项目细节、敲定技术架构，产出完整的 AGENTS.md

```
1. 确认模板文件已复制到项目根目录
2. 与用户讨论项目需求，确认：
   - 项目名称、类型、技术栈
   - 目录结构、核心模块划分
   - 架构设计
3. 根据项目类型，保留 docs/_fragments/ 中对应的环境片段
4. AI 助手根据讨论结果，丰满 AGENTS.md：
   - 替换所有 {{占位符}} 为项目实际内容
   - 删除 AGENTS.md 顶部的 AI 助手使用指南区块
5. 用户审核 AGENTS.md，确认无误后进入下一阶段
```

**产出物**：
- 完整的 `AGENTS.md`（项目约束的唯一权威来源）
- 初始化的 `docs/` 和 `skills/` 目录结构

### 第二阶段：代码开发

**前置条件**：AGENTS.md 已经过用户审核确认

**约束**：
- AI 助手的所有行为受 AGENTS.md 约束
- 证据驱动：技术决策引用 `docs/references/` 中的参考文档（如有）
- 不允许简化代码或省略错误处理
- 严格类型：遵循 AGENTS.md 中定义的语言特定类型约束

**反最小化选择原则**：
- 默认不接受“先能跑、以后再补”作为完成标准；除非用户明确批准临时方案，并记录适用范围、风险与退出条件
- 每个 task 必须在当前 task 内完成代码、测试、文档、验证、清理和 review 闭环
- 临时兼容层、双轨实现、迁移脚本、特例分支必须声明 owner、保留范围和最晚清理阶段
- 新事实源生效时，旧事实源必须在同阶段删除或改写，避免多个权威并存
- 文档粒度必须与问题规模匹配：小问题不制造额外文档债，中大型开发/重构必须留下可追溯产物

**开发/重构 Skill 触发要求**：
- 涉及新增能力、新接口、跨文件实现计划时，优先触发 `development-governance`
- 涉及迁移、替换实现、抽象收敛、兼容层、阶段切换时，优先触发 `refactor-governance`
- 当任务天然包含阶段门禁、退出条件或清理责任时，不允许绕过上述 Skill 直接进入编码

**开发节奏**：

```
制定 tasks -> 用户审核 tasks -> 执行 task -> review 代码 -> 推进下一个 task
```

**Code Review 辅助**：

当项目安装了 Codex CLI 时，AI 助手应在 review 阶段调用 Codex 辅助审查。

为什么：多模型交叉审查能发现单一模型的盲区，提高代码质量。

**Codex CLI 交互约束**：

- AGENTS 仅保留 Codex 治理摘要；参数、命令、失败分类与恢复细则以 `skills/codex-orchestration/SKILL.md` 与 `skills/codex-orchestration/SPEC.md` 为唯一维护来源
- 执行入口统一使用非交互 `codex exec`，优先走 `skills/codex-orchestration/scripts/run_codex_exec.sh`（兼容入口：`scripts/codex/run_code_review.sh`）
- review 任务仍要求 Prompt/原始输出/失败记录分别落盘到 `docs/code-review/_inputs/`、`docs/code-review/_codex_raw/`、`docs/code-review/_codex_failures/`
- 非交互调度场景必须显式处理代理（`--proxy-port/--proxy-url` 或环境变量），不得依赖 `.bashrc` 的 `codex()` 函数隐式注入
- 网络型失败与“部分输出超时”必须按 `codex-orchestration` 规范处理，并在达到阈值后降级人工审查
- 禁止使用交互式 `codex -m ... -a never`

**Skills 触发**：
- AI 助手根据 Skill 注册表中的触发条件，自动触发对应 Skill
- 用户也可以显式指令触发 Skill（如"执行 code review"、"生成项目文档"）
- AI 助手触发 Skill 前，必须先读取对应的 SKILL.md 文件
- 进入中大型开发时，应在 `docs/development/` 留下可追溯的闭环记录
- 进入阶段性重构时，应在 `docs/refactor/` 留下包含门禁与清理要求的阶段文档

### 第三阶段：工作日志记录

按 `skills/work-logs/SKILL.md` 与 `skills/work-logs/SPEC.md` 规范，记录到 `docs/work-logs/YYYY-MM-DD.md`

---

## 8. 恢复指南（上下文丢失时）

1. 读取本文档（AGENTS.md），理解项目定位和约束
2. 如存在 `docs/TODO.md`，优先读取以了解当前进度和下一步任务
3. 读取最新的 `docs/work-logs/YYYY-MM-DD.md`，了解最近做了什么
4. 读取 `docs/development/` 与 `docs/refactor/` 下最新文档，恢复当前开发/重构阶段边界（如有）
5. 读取 `docs/references/` 下的参考文档，恢复技术决策上下文（如有）
6. 如果 Augment tasks 可用，同步检查 tasks 状态

---

## 9. 状态追踪

| 层级 | 工具 | 用途 | 可靠性 |
|------|------|------|--------|
| 第一层 | Augment Tasks | 细粒度任务追踪 | 依赖服务可用性 |
| 第二层（可选） | `docs/TODO.md` | 粗粒度进度追踪 | 文件级持久化，不依赖外部服务 |
| 补充层 | `docs/work-logs/` | 详细工作记录 | 文件级持久化，包含决策细节 |

当 `docs/TODO.md` 存在且与其他层信息冲突时，以其为准；若不存在，则按 `docs/work-logs/` 与阶段文档恢复。
