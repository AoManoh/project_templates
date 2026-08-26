---
name: git-governance
description: >-
  在需要查看或修改 Git 仓库状态、remote、认证方式、分支跟踪关系、提交、拉取、
  合并、rebase、cherry-pick、revert、push 或历史时使用；出现认证失败、
  non-fast-forward、分支分叉、protected branch、detached HEAD、merge/rebase
  中断或多端同步问题时也使用。负责确认实际 Git 仓库、GitHub/Codeup 等平台支持
  的认证方式、远端角色、同步策略、单一逻辑提交、人类可评审的自包含提交信息、
  push 目标和远端结果。它不决定业务需求、代码方案或测试充分性；这些仍由当前任务
  owner 决定，Git Skill 只把已经确认的改动安全、清楚地写入版本历史。创建 branch
  或 worktree 时还必须记录归属、用途和退出条件，并在任务结束时回收或说明保留原因。
  生成或改写提交信息时，最终回复只包含可直接提交的 message，不输出读取、检查或分析过程。
---

# Git 协作治理 Skill

**skill_id**: `git-governance`
**版本**: 2.1.0
**output_dir**: `docs/work-logs/`
**SPEC**: [SPEC.md](./SPEC.md)

## 1. 目标与边界

本 Skill 管理从“确认仓库现场”到“远端确认收到目标提交”的完整 Git 链路：

```text
确认 Git 仓库和 remote
→ 确认平台与认证方式
→ fetch 并判断 ahead/behind
→ 需要隔离时选择 detached worktree 或有明确归属的 branch/worktree
→ 选择 fast-forward、merge、rebase 或停止
→ 把一个中心变化整理为一个 commit
→ 写出人类工程师可直接用于代码评审的提交信息
→ push 到明确 remote/branch
→ 读取远端 ref 验证结果
→ 回收本任务创建的 worktree/branch，或说明保留原因和退出条件
```

本 Skill 不拥有业务目标、实现方案、代码修改和测试设计。它可以在 development、refactor、debug 或其他任务中作为 Git collaborator；当前 primary owner 仍负责改动内容和验证是否充分。

正常 commit/push 不要求创建工作日志。只有分叉整合、历史改写、force push、跨 provider 同步、恢复中断操作或其他需要长期审计的 Git 决策，才在 `docs/work-logs/` 记录。

## 2. Owner 复核与加载

| 当前目标 | 处理 |
|---|---|
| 查看 Git 状态、提交、remote、branch 或历史 | git-governance owner |
| 创建 commit、pull/fetch、merge/rebase、push 或配置 remote | git-governance owner |
| 处理认证、non-fast-forward、分叉、冲突或中断状态 | git-governance owner |
| 设计业务功能或修改代码 | 对应开发/重构/调试 Skill 为 primary；git-governance 只处理 Git 链路 |
| 只读取普通文件且不涉及 Git 判断 | 不加载本 Skill |

取得 owner 后，在生成/改写提交信息，或执行任何会修改 `.git/`、工作树、分支或远端的命令前读取 [SPEC.md](./SPEC.md)。只读 `status/log/diff` 和 remote 名称可以先用于确认现场；URL 必须按 SPEC 脱敏后才显示，结论和后续动作必须服从 SPEC。

## 3. 不可绕过的行为

1. **确认双重根路径**：先确认项目根，再用 `git rev-parse --show-toplevel` 确认实际 Git 仓库；两者可以不同，不得把外层治理目录误当源码仓库。
2. **先读现场再动作**：至少读取 `status -sb`、`branch -vv`、remote 名称、浅克隆状态和相关 log；不能凭上轮记忆继续。Remote URL 先脱敏，禁止把已有 userinfo、token 或敏感查询参数写进工具输出。
3. **使用单目标命名 remote**：日常 fetch/push 不直接使用裸 URL。`origin`、`upstream`、`github`、`codeup` 等名称必须表达角色；一个 remote 有多个有效 push 目标时停止并拆为分别授权的 remote。
4. **按平台认证**：GitHub HTTPS 不接受账户密码；Codeup 可以使用平台提供的 HTTPS 克隆账号/密码或允许的令牌；两者都支持 SSH。不得把任何 token、密码或私钥写入 URL、命令记录、提交信息或文档。
5. **用精确远端 ref 判断分叉**：先读取 `refs/heads/<branch>` 的远端 OID，再 fetch 到 `refs/remotes/<remote>/<branch>`；分叉时禁止普通 push，也禁止让无策略的 pull 自动决定 merge/rebase。远端 branch 不存在时按新建 branch 单独授权。
6. **保护未提交工作**：存在 staged、unstaged 或 untracked 内容时不得 merge、rebase、fast-forward、reset 或切换可能改写工作树的分支；保存、备份、stash 或丢弃方式由用户决定，Agent 不静默选择。
7. **禁止未授权改写或丢数据**：移动 refs、reset、clean、删除 branch/tag、rebase 已共享提交和覆盖远端历史都需要该具体动作的用户确认；已提交历史用备份 ref 保护，index/工作树/未跟踪文件必须另有已验证备份或明确不可恢复的丢弃确认。
8. **一个 commit 一个中心变化**：功能、重构、格式化和无关清理默认拆开；提交信息难以用一句标题和一组因果说明讲清时，先检查是否应该拆 commit。
9. **提交信息服务人类评审**：Conventional Commits 只负责机器结构；正文按实际适用范围说明旧行为、新行为、影响、边界和验证结果，不为凑模板虚构风险。
10. **提交后和 push 后复核**：commit 后读取真实 OID、tree、parent、message 和文件清单；push 后把精确远端 OID 与本地 HEAD 比较。命令退出码或 stale tracking ref 不能单独证明成功。
11. **提交信息按事实类型取证**：旧/新行为和影响回到业务契约或仓库事实；风险和权衡写明依据与不确定性；验证结果只能来自实际命令、CI、运行或人工检查。不得猜测旧作者意图、停机时间、文件范围、风险等级或测试结果。
12. **破坏性变化必须显式标记**：任何使既有调用方、数据或运维流程不能继续按原契约工作的接口、输入、输出、配置、数据格式、默认值或运行语义变化，标题使用 `!`；footer 写明已知前后行为，并给出已确认迁移动作、明确无迁移路径，或如实说明迁移路径尚未确认。
13. **保留历史不等于授权发布**：merge 可以避免重写双方历史，但不会自动授权把 local-only 提交推到远端；共享状态、目标 tree 或发布范围不清时停止并请用户裁决，不以 merge 作为默认猜测。
14. **Branch/Worktree 有创建就有回收**：任何 worktree 写入前取得共享 write claim；创建时记录 owner、用途、基线、提交权限、退出条件和清理动作。只读或验证优先 detached，一项写任务独占一个 worktree。结束前盘点本任务对象；clean/merged 不代表 owner release，清理必须绑定最终 OID/dirty/owner 状态并获确认，其他 Agent 或归属不明对象只能经用户批准的 orphan recovery 处理。

## 4. 最小执行流程

### 4.1 现场检查

```bash
git rev-parse --show-toplevel
git rev-parse --is-shallow-repository
git status -sb
git branch -vv
git remote
git log --oneline --decorate -n 20
```

需要访问远端时，按 SPEC 脱敏检查全部有效 URL，确认单一目标，然后使用精确 ref：

```bash
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
git rev-list --left-right --count refs/remotes/<remote>/<branch>...HEAD
git log --left-right --graph --oneline refs/remotes/<remote>/<branch>...HEAD
```

### 4.2 远端和认证

先区分：

- 同一仓库使用不同协议：同一个 remote 可以用 HTTPS fetch、SSH push；
- GitHub 与 Codeup 两个仓库：建立两个 remote，不能把它们伪装成同一 remote 的 fetch/push URL；
- 认证失败：交给用户在平台或本机凭据管理器处理，不读取或索要秘密；
- `non-fast-forward`：是历史问题，不是认证问题。

### 4.3 同步决策

| 状态 | 动作 |
|---|---|
| 已同步 | 不整合 |
| 只有远端提交 | 只允许明确的 fast-forward；失败则重新判断 |
| 只有本地提交 | 完成提交与验证门禁后 push |
| 双方都有提交 | 建立救援锚点并比较历史；已共享历史默认 merge，未共享 topic 经批准才可 rebase |
| 工作树不干净 | 停止整合，先决定未提交内容的保存位置 |

### 4.4 提交准备

1. `git add` 前列出 intended paths，包括未跟踪文件；逐文件完成 AGENTS 公开性四问和敏感信息检查。
2. 只暂存当前中心变化，再读取 staged 文件清单、完整 diff 和提交信息草稿。
3. 执行当前 primary owner 指定的验证，并读取实际结果。
4. 对 staged 文件和提交信息再次执行公开性、秘密、内网和个人信息检查。
5. 按 SPEC 的提交信息契约和适用 profile 生成草稿，并通过 reviewer 自包含检查。
6. commit 后读取：

```bash
git show -s --format='%H%n%T%n%P%n%B' HEAD
git diff-tree --no-commit-id --name-status -r HEAD
git show --stat --oneline HEAD
```

Merge commit 还要分别比较其 tree 与各 parent，不能只依赖 combined diff。

### 4.5 Push 与验证

```bash
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
git rev-list --left-right --count refs/remotes/<remote>/<branch>...HEAD
git push <remote> HEAD:refs/heads/<branch>
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
```

Push 前保存精确远端 OID，push 后重新读取并与 `git rev-parse HEAD` 比较；命令退出 0 或 tracking ref 相同不替代 OID 等值检查。远端 branch 原本不存在时，按新建 branch 单独授权。Push 被拒绝时按错误类型处理：认证错误修认证，non-fast-forward 回到分叉决策，protected branch 转 PR/MR，不能统一用 force push 解决。

### 4.6 Branch/Worktree 收口

```bash
git worktree list --porcelain -z
git -C <worktree> status --porcelain=v1 --untracked-files=all --ignored
git -C <worktree> submodule foreach --recursive 'git status --porcelain=v1 --untracked-files=all --ignored'
git branch -vv
git rev-parse <branch> <target>
git merge-base --is-ancestor <branch-oid> <target-oid>
```

1. 任何写入先取得共享 write claim；active/unknown claim 不抢占，私有 todo 不算并发声明。
2. 只读、调研或验证任务优先 detached worktree，不创建 branch；单 commit 会在本会话立即推送和验证时也可 detached，但删除前必须由 durable ref 接住。
3. 多 commit、跨会话或等待其他任务的写入才创建 branch/worktree；创建前登记 owner/state、用途、基线、退出条件和下次复核。
4. 结束时逐 worktree 检查 tracked/untracked/ignored、submodule 和 nested repo；clean/merged 不等于 owner release。
5. 清理确认绑定 canonical path/ref、最终 OID、数据/owner 状态和 loss set；执行前重读，变化即失效。
6. 删除 worktree、local、remote 和 rescue ref 分别确认；remote 删除使用精确 OID lease，其他 Agent 或 stale claim 走 orphan recovery。
7. 无法清理时记录 durable anchor、唯一提交、owner、当前下一动作和可判定复核点，不能静默遗留。

## 5. 提交信息快速检查

详细格式和例外只在 SPEC §9 维护。生成草稿前确认：

1. 标题命名具体对象、行为和结果；scope 只在存在稳定模块名时使用；
2. 先选择行为变化 profile 或简短无行为变化 profile，不填无意义段落；
3. 问题、改动、影响/边界和验证按事实类型取证，不复述 diff，不补故事；
4. 破坏性变化使用 `!` 和 `BREAKING CHANGE`，未知迁移路径如实说明；
5. issue、URL、路径、哈希和 trailer 只作定位，不能替代正文；
6. 通过 SPEC 的自包含、公开性和敏感信息检查。

用户要求生成或改写提交信息时，只输出可直接交给 `git commit` 的 message；不添加读取规则、分析步骤或完成提示，不使用 Markdown 代码围栏。

## 6. 失败处理

| 现象 | 处理 |
|---|---|
| `No such remote` | 读取 `git remote` 名称；修改已有 remote 时使用真实名称，需要新增仓库时再 `remote add` |
| 401/403、password、publickey 错误 | 按 provider 和协议处理认证；不改历史 |
| `non-fast-forward` | fetch、比较双方历史，进入分叉流程 |
| `Need to specify how to reconcile divergent branches` | 停止 pull；明确选择 fast-forward、merge、rebase 或保留分支 |
| detached HEAD | 先记录 HEAD 和可回退引用，再决定目标分支 |
| merge/rebase 中断 | 读取状态；无法安全继续时执行对应 abort，不叠加新操作 |
| protected branch | 使用平台 PR/MR 流程，不绕过保护 |
| remote push 成功但本地跟踪未更新 | fetch 并读取 remote ref，不凭 stdout 猜测 |

## 7. 退出纪律

只有以下事实都可观察时，Git 任务才可结束：

- 实际 Git 仓库、分支、remote、目标 branch 和认证协议明确；
- 工作树与 staged 状态可解释，没有把无关改动混入 commit；
- 分叉策略没有重写未获授权的共享历史；
- commit 只表达一个中心变化，真实 message 和文件清单已复核；
- message 不依赖聊天、不可访问文档或未解释代号即可供人类开始评审；
- 文件和 message 已完成公开性与敏感信息检查；
- push 场景已读取远端 ref；多个 remote 分别验证；
- 没有把 commit、push、PR/MR、merge 或发布互相冒充；
- 本任务 write claim 已 release/handoff；创建的 worktree/branch 已按最终状态确认清理，或已记录 durable anchor、唯一提交、owner/state、最近确认、下一复核和当前下一动作；
- 高风险、异常或保留临时 branch 的 Git 决策已按需写入 `docs/work-logs/`。
