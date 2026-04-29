# Git 协作治理 Skill

**skill_id**: `git-governance`
**版本**: 1.0.0
**output_dir**: `docs/work-logs/`

---

## 1. 概述

本技能用于统一 Git 协作流程，降低共享分支下的冲突放大、历史污染和错误回滚成本，尤其适用于包含大体量数据目录（如 `vector_db/`）和双端开发（WSL + Remote SSH）的项目。

### 1.1 触发条件

| 触发方式 | 条件 |
|----------|------|
| 显式触发 | 用户指令包含关键词：`git`、`push 被拒绝`、`rebase`、`merge`、`分支同步`、`冲突`、`双端同步` |
| 场景触发 | 出现 `non-fast-forward`、rebase 中断、分支分叉、跨终端同步失败 |

### 1.2 前置依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| git CLI | 分支状态查询、同步、合并、回滚 | 必需 |
| view/read 工具 | 读取 `.gitignore`、数据目录状态、项目约束 | 必需 |

### 1.3 关联规范

规范标准详见：[SPEC.md](./SPEC.md)

---

## 2. 强制行为

| 行为 | 时机 |
|------|------|
| 读取 SPEC.md | 开始前 |
| 需要落盘治理记录时，必须先确认项目根为当前 `AGENTS.md` 所在目录；所有 `docs/work-logs/*` 路径相对该目录解析 | 记录决策前 |
| 执行高风险操作前，必须采集基线状态（`status`、`branch -vv`、`log --oneline`） | merge/rebase 前 |
| 默认同步策略为 `git pull --ff-only origin <branch>` | 每次开始开发前 |
| `push` 被拒绝时，默认走 `fetch + merge`，禁止直接强推 | 推送失败时 |
| 生成或执行提交前，必须审查 `git status -sb` 与 `git diff --cached`，并按 SPEC.md §9 编写带 body 的标准提交信息 | commit 前 |
| 含大体量数据目录或共享分支时，禁止直接 `rebase` | 处理分叉时 |
| merge/rebase 前必须创建救援分支 `rescue/<timestamp>` | 风险操作前 |
| 双端开发必须单向串行同步，避免两端并发提交后互拉 | WSL/SSH 协作时 |

---

## 3. 快速参考

### 3.1 基线采集命令

```bash
git status -sb
git branch -vv
git log --oneline --decorate -n 20
git remote -v
```

### 3.2 场景决策表

| 场景 | 推荐动作 | 禁止动作 |
|------|----------|----------|
| 日常同步 | `git fetch` + `git pull --ff-only origin <branch>` | 直接 `git pull`（隐式 merge） |
| push 被拒绝（non-fast-forward） | `git fetch` -> 建立 `rescue/*` -> `git merge origin/<branch>` -> `git push` | 未审计差异就 `git push --force` |
| 共享分支 + 大文件/数据目录 | 使用 merge 整合远端提交 | 对共享分支做 rebase 重写历史 |
| rebase 过程中异常 | 先 `rebase --abort`，回到可解释状态，再按 merge 流程处理 | 在异常状态继续叠加操作 |
| 双端开发同步 | 一端提交推送后，另一端仅 `pull --ff-only` 同步 | 两端各自先提交，再互相拉取 |

### 3.3 标准提交模板

```text
<type>(<scope>): <中文摘要>

背景：
- 为什么需要这次变更。

变更：
- 本次提交实际修改了什么。

影响与边界：
- 本次提交带来的行为变化、兼容影响、风险或未覆盖范围。
```

---

## 4. Skill 定义

### 4.1 inspect_branch_state

**目的**: 建立“是否可安全继续”的客观状态快照。

**执行步骤**:
1. 运行基线采集命令。
2. 判断是否存在以下风险信号：
   - `HEAD (no branch)` 或 rebase/merge 中间态
   - 本地与远端分叉
   - 大体量数据目录存在未提交差异
3. 输出“可继续 / 需中止修复”结论。

### 4.2 sync_with_remote

**目的**: 在不污染历史的前提下同步远端。

**执行步骤**:
1. `git fetch origin`
2. `git pull --ff-only origin <branch>`
3. 若失败，转入 `resolve_push_rejection`。

### 4.3 resolve_push_rejection

**目的**: 处理 `non-fast-forward`，优先保证稳定性。

**执行步骤**:
1. `git fetch origin`
2. 创建 `rescue/<timestamp>`
3. `git merge origin/<branch>`
4. 处理冲突并完成 merge
5. `git push origin <branch>`

**关键约束**:
- 默认不使用 rebase 重放共享分支提交。
- 默认不使用 `--force`/`--force-with-lease`，除非用户明确批准并说明范围。

### 4.4 recover_from_failed_rebase

**目的**: 从 rebase 异常状态恢复到可解释状态。

**执行步骤**:
1. `git status` 确认当前处于 rebase 中。
2. 创建救援分支（如果仍可创建）。
3. 执行 `git rebase --abort`。
4. 回到目标分支后按 merge 流程整合远端。

### 4.5 dual_environment_sync

**目的**: 保证 WSL + Remote SSH 的同步链路稳定。

**执行步骤**:
1. 设定单向主端（例如 WSL）作为“提交端”。
2. 提交端完成：`pull --ff-only` -> 开发 -> `push`。
3. 非提交端只做：工作区暂存（如需）-> `pull --ff-only` -> 恢复本地改动。
4. 非提交端出现分叉时，禁止直接 rebase，先回到提交端统一整合。

### 4.6 record_decision_log

**目的**: 让后续协作可追溯。

**执行步骤**:
1. 在 `docs/work-logs/YYYY-MM-DD.md` 记录：
   - 触发场景（例如 push 被拒绝）
   - 采取动作（merge/rebase abort/rescue 分支）
   - 决策原因（为什么不是另一种方案）
2. 标注关键提交哈希与分支名。

### 4.7 prepare_standard_commit_message

**目的**: 生成可审计、可回溯、可统一解析的标准提交信息。

**执行步骤**:
1. 运行 `git status -sb`，确认工作区只包含本次任务预期文件。
2. 运行 `git diff --cached` 审查已暂存内容；若无暂存内容，先审查 `git diff` 并只暂存本次任务文件。
3. 根据实际 diff 判断 `type`、`scope` 和中文摘要。
4. 按 SPEC.md §9 写出包含 `背景`、`变更`、`影响与边界` 的 body。
5. 验证证据不作为 body 固定段落；若需要进入提交信息，可放入 `Tests:` footer。不得因为 body 不写验证而宣称未验证的工作已完成。

---

## 5. Skill 编排流程

### 5.1 日常协作流程

```
1. inspect_branch_state
   |
2. sync_with_remote
   |
3. 开发、验证与暂存
   |
4. prepare_standard_commit_message
   |
5. commit
   |
6. push
   |
7. record_decision_log（按需）
```

### 5.2 推送失败流程

```
1. inspect_branch_state
   |
2. resolve_push_rejection
   |
3. push
   |
4. record_decision_log
```

### 5.3 rebase 异常恢复流程

```
1. inspect_branch_state
   |
2. recover_from_failed_rebase
   |
3. resolve_push_rejection（merge 路径）
   |
4. record_decision_log
```
