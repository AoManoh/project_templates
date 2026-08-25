# Git 协作治理规范

**版本**: 2.0.0
**适用范围**: Git 仓库边界、remote 与认证、分支同步、提交、提交信息、push、异常恢复和结果验证

## 1. 目标与事实来源

本规范保证一轮 Git 操作同时满足五件事：

1. 操作发生在正确的 Git 仓库；
2. remote、平台、认证方式和目标 branch 明确；
3. 同步策略不会意外覆盖工作树或改写共享历史；
4. 每个 commit 只有一个中心变化，提交信息足以让人类工程师开始代码评审；
5. push 后读取远端引用，确认实际结果。

Git 事实按以下来源裁决：

| 事实 | 当前来源 |
|---|---|
| Git 仓库根、HEAD、工作树、index、branch、remote 配置 | 当前仓库的 Git 命令输出 |
| 远端 branch 和 commit | fetch/ls-remote 后的远端引用及平台结构化结果 |
| GitHub/Codeup 支持的认证方式 | 对应平台当前官方设置和文档；本规范给出已确认基线 |
| 提交实际内容 | commit tree、parent、message 和 changed-file 清单 |
| 测试与运行结果 | 实际命令、CI、测试输出或目标观测；提交信息只是摘要 |
| 业务目标和代码方案 | 当前 primary owner 的事实源，不由 Git 历史自行改写 |

旧日志和上一轮 `status` 只能帮助定位，不能替代当前 Git 输出。

## 2. 项目根与 Git 仓库根

项目根由当前 `AGENTS.md` 决定；Git 仓库根由以下命令决定：

```bash
git rev-parse --show-toplevel
git rev-parse --git-dir
git status -sb
```

两者可以不同。例如外层目录存放治理文档，内层子目录才是源码仓库。所有 Git 命令必须在实际仓库执行，所有治理产物仍相对项目根写入。

无法确认仓库根时停止。不得在外层目录擅自 `git init`，也不得因为找到最近的 `.git` 就假设它是用户要求操作的仓库。

## 3. Remote 角色与地址

### 3.1 命名

| 名称 | 语义 |
|---|---|
| `origin` | 当前唯一或主要协作仓库 |
| `upstream` | 代码来源仓库，通常只 fetch，不 push |
| `github` / `codeup` | 同时维护多个平台时按平台明确区分 |

不要使用 `push`、`remote1`、`backup2` 等无法判断目标的名称。若项目已有稳定命名，以项目约定为准，但必须能从脱敏后的 host/path 和项目说明判断角色。

### 3.2 安全基线检查

先读取不含 URL 的信息：

```bash
git remote
git branch -vv
git rev-parse --is-shallow-repository
```

Remote URL 可能已经含有 userinfo、token 或敏感查询参数，禁止直接把 `git remote -v` 或 raw `get-url` 输出到工具日志。URL inventory 必须在 stdout 前完成以下脱敏：

1. 删除 `scheme://` 后、host 前的全部 userinfo；
2. 删除查询参数和 fragment；
3. SSH/scp 形式只保留脱敏 user、host 和仓库 path；
4. 分别统计 `git remote get-url --all <remote>` 与 `git remote get-url --push --all <remote>` 的结果数量；
5. 没有可用的本地脱敏器时，由用户本地检查并只提供协议、host、path 和数量，Agent 不读取 raw URL。

日常 fetch/push remote 必须恰好有一个有效 fetch 目标和一个有效 push 目标，并且二者是同一仓库。`upstream` 即使 Git 能推送，也按角色禁止 push。多个 URL 或 pushurl 会导致 Git 多目标 push 或只从首个 URL fetch；发现时停止并拆为分别命名、分别授权的 remote。

修改已有 remote 时必须使用真实名称：

```bash
git remote set-url <remote> <fetch-url>
git remote set-url --push <remote> <push-url>
```

新增独立仓库才使用：

```bash
git remote add <remote> <url>
```

执行前记录脱敏旧值、脱敏新值和用途，执行后重新统计并脱敏读取全部 fetch/push URL。`set-url` 只修改首个匹配值，不能用它假设其他 URL 已被清理。Agent 不修改全局 Git 配置。

### 3.3 Fetch URL 与 Push URL

同一 remote 的 fetch/push URL 可以使用不同协议，例如 GitHub HTTPS fetch 与 GitHub SSH push，但必须指向同一个仓库。Push 后应能立即从 fetch URL 看到相同引用。

GitHub 与 Codeup 是两个独立仓库时必须使用两个 remote。禁止把 GitHub 设为 fetch URL、Codeup 设为同一 remote 的 push URL；这种配置会让 remote-tracking branch 不能证明 push 目标的真实状态。

日常操作使用命名 remote 和完整目标 ref：

```bash
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
git push <remote> HEAD:refs/heads/<branch>
```

裸 URL 只用于一次性只读诊断。使用裸 URL 的 push/pull 不会建立清楚的长期 remote 角色，不作为标准流程。

## 4. GitHub 与 Codeup 认证

### 4.1 平台矩阵

| 平台 | HTTPS Git 操作 | SSH Git 操作 |
|---|---|---|
| GitHub | 提示中可能要求 username，但账户密码不能用于 Git；使用个人访问令牌，或由 GitHub CLI/credential helper 提供凭据 | 使用已上传到 GitHub 账号的公钥；私钥只留在本机，由 SSH 或 ssh-agent 使用 |
| Codeup | 使用 Codeup 提供的 HTTPS 克隆账号/密码，或仓库和账号设置允许的 Git 令牌；可由 credential helper 提供 | 使用已上传到 Codeup 账号的公钥；多账号可由用户配置明确的 SSH host alias 和 key |
| 其他平台 | 读取该平台当前官方文档，不从 GitHub 或 Codeup 类推 | 读取该平台当前官方文档 |

Codeup 的个人访问令牌、HTTPS 克隆密码和普通登录密码不是当然等价；以平台页面为当前事实。GitHub PAT 规则也不能直接套用到 Codeup。

### 4.2 秘密边界

禁止：

- 把 token、密码或私钥写入 remote URL；
- 在聊天、命令日志、提交信息、文档、测试夹具或错误报告中复制秘密；
- 读取或展示凭据管理器中的秘密值；
- 认证失败后通过创建新历史、force push 或改 branch 规避权限。

可以记录：provider、协议、remote 名、脱敏 host/path、凭据是否由用户配置、错误类别和恢复结果。

认证需要交互、账号授权、SSO、PAT、克隆密码或 SSH key 时，由用户在平台或本机完成。Agent 报告 blocker，不要求用户把秘密发到对话。

### 4.3 错误分类

`401/403`、`Authentication failed`、`Permission denied (publickey)` 通常属于认证或授权。`non-fast-forward`、protected branch 和分支分叉不属于认证问题；已经收到 non-fast-forward 说明服务器已处理到 ref 更新检查，继续轮换密码不能解决历史冲突。

## 5. 状态基线与同步

### 5.1 必采状态

```bash
git status -sb
git branch -vv
git remote
git rev-parse --is-shallow-repository
git log --oneline --decorate -n 20
```

浅克隆无法保证 merge-base 和 ahead/behind 完整。`--is-shallow-repository` 为 true 时，先由用户批准取得足够历史；无法取得时停止并报告不能裁决分叉。

访问目标 remote 前先按第 3.2 节确认单一、脱敏目标，再读取精确 branch：

```bash
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
git rev-list --left-right --count refs/remotes/<remote>/<branch>...HEAD
git log --left-right --graph --oneline refs/remotes/<remote>/<branch>...HEAD
```

`ls-remote` 必须恰好返回一条 `refs/heads/<branch>`；不存在时停止并按“新建远端 branch”单独取得授权，不能使用可能 stale 的 tracking ref 猜测。`rev-list` 左值是 remote-only，右值是 local-only，报告时写明顺序。

### 5.2 状态矩阵

| remote-only | local-only | 状态 | 允许动作 |
|---:|---:|---|---|
| 0 | 0 | 已同步 | 不整合 |
| >0 | 0 | 本地落后 | `git merge --ff-only refs/remotes/<remote>/<branch>`；失败则停止 |
| 0 | >0 | 本地领先 | 完成提交和验证门禁后 push |
| >0 | >0 | 已分叉 | 禁止普通 push；进入第 6 节 |

禁止把不带策略的 `git pull` 当成开始同步的默认命令。`pull` 同时执行 fetch 和整合，会压缩观察窗口；标准流程先读取远端 OID、fetch 精确 ref，再显式选择 fast-forward、merge 或 rebase。

### 5.3 Dirty worktree

工作树或 index 有 staged、unstaged 或 untracked 内容时，停止 merge、rebase、fast-forward、reset 和可能改写工作树的 branch 切换，并让用户决定：

- 把属于同一中心变化的内容提交；
- 移到独立 branch/worktree；
- 明确授权 stash；
- 放弃内容。

Agent 不自动 stash、reset、clean、切换分支或覆盖文件。未跟踪文件同样属于用户数据。

## 6. 分叉、Merge、Rebase 与历史改写

### 6.1 先按数据类型建立恢复路径

任何 merge、rebase、历史改写或复杂冲突处理前记录 HEAD、双方精确引用和工作树。恢复路径必须覆盖实际可能损失的数据：

- 已提交历史：建立不会覆盖现有引用的 rescue branch/ref；
- branch/tag：记录并保护原始对象，annotated tag 还要保留 tag object；
- staged、unstaged、untracked 内容：branch 不能保护这些数据，必须由用户选择已验证备份、独立 worktree/commit、明确 stash，或确认不可恢复地丢弃；
- 删除任何救援引用或备份需要单独确认。

没有覆盖相应数据的恢复路径时，不执行可能丢失它的操作。

### 6.2 决策矩阵

| 场景 | 默认策略 |
|---|---|
| 本地提交已经 push 或被他人基于其开发 | merge；不 rebase 公共历史 |
| 本地 topic 完全未共享、工作树干净 | 只有用户确认没有线下/他人依赖，且所有相关 remote refs 与 PR/MR 均不含这些提交时，经批准才可 rebase |
| 共享分支或大文件/高代价重放 | merge 优先 |
| 远端发生历史改写、过滤发布或相同内容使用不同 SHA | 先比较 commit、tree、range 和最终 diff，再由用户决定保留哪条历史；不自动 merge/rebase |
| 共享状态、目标 tree 或 local-only 提交的发布授权不明确 | 停止并让用户裁决；不以 merge 代替授权判断 |
| 只是远端领先且可快进 | `merge --ff-only`，不产生 merge commit |

Merge 只说明保留双方历史，不说明 local-only 提交获准进入远端。选择 merge 后仍要单独核对最终 tree 和用户授权的发布范围。

发生冲突时只处理当前整合操作。没有安全把握继续时执行对应 `merge --abort` 或 `rebase --abort`，回到可解释状态，不在中断状态叠加其他 Git 操作。

## 7. 高风险与例外审批

任何移动 refs、重写历史或丢弃 index/工作树数据的动作，都要取得针对本次对象和范围的明确确认，并满足第 6.1 节恢复要求，包括：

- 所有 `reset` 模式、`checkout`/`restore` 覆盖、`clean`；
- 删除或强制更新 branch/tag；
- rebase/cherry-pick 已共享历史；
- 覆盖远端历史；
- 清除 staged、unstaged 或 untracked 内容。

普通 `push --force` 禁止。确需覆盖远端历史时：

1. 先用 `ls-remote --exit-code --refs` 读取目标 `refs/heads/<branch>` 的精确 OID；
2. 说明将被替换的远端提交、影响对象和恢复 ref，并取得本次确认；
3. 只允许单一明确目标，使用钉住该 OID 的 `--force-with-lease=refs/heads/<branch>:<observed-oid>`；
4. OID 在执行前发生变化时停止，重新取证和确认；
5. 执行后重新读取远端 OID 和最终 tree。

一次授权不覆盖后续新的 destructive action，也不授权关闭 branch protection、删除救援引用或改写另一 remote。

## 8. 一个 Commit 一个中心变化

### 8.1 判断标准

一个 commit 应能用一句标题说明一个行为变化，并能整体 review、revert、cherry-pick 和 bisect。跨多个文件不等于不原子；关键是这些文件是否共同完成同一结果。

默认拆分：

- 功能变更与无行为重构；
- bug 修复与无关格式化；
- 公共接口定义与可独立评审的后续实现；
- 多个没有共同原因和共同验证的修复；
- 自动生成大变更与手写功能变更。

出现以下信号时先检查拆分：

- 标题只能写“综合调整、完成某阶段、多个优化”；
- body 需要多个互不依赖的问题和方案；
- 部分文件可以独立 revert；
- 关键风险被文件清单和过程记录淹没；
- 不同变更需要不同 reviewer 或不同验证。

不设置固定文件数或正文行数上限。超长 message 和大 diff 是检查信号，不是单独失败条件。

### 8.2 Git Add 前与 Staged 范围

`git add` 前先从 `git status --short` 列出 intended paths，包括未跟踪文件，读取实际内容并完成第 9.6.1 节公开性四问。未跟踪文件不能因为尚未进入 diff 就跳过检查。

暂存后、commit 前必须读取：

```bash
git status -sb
git diff --cached --name-status
git diff --cached --stat
git diff --cached
```

只暂存当前中心变化，并再次执行公开性和 message 检查。不得因工作树存在其他修改而把它们一起提交，也不得用全量 add 掩盖范围不清。

## 9. 标准提交信息规范

### 9.1 默认读者

提交信息写给未参与当前任务、知道项目用途、只能访问该 Git 仓库代码和历史的工程师。读者不应依赖：

- 当前会话上下文和未写入仓库的任务过程；
- 未提交或仓库外治理文档；
- 未解释的阶段、工作包、审计或评测代号；
- 私有 issue、临时 URL 或即将失效的日志；
- 只在本轮工具输出里存在的哈希映射。

Message 与 diff、已有代码一起，应足以让该读者开始判断实现是否符合描述。

### 9.2 标题

```text
<type>[可选 (<scope>)][可选 !]: <具体对象发生的行为变化或结果>
```

没有项目级 allowlist 时，允许的 `type` 为 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`。项目已有更严格配置时以实际配置为准。

标题同时满足：

1. `type` 反映变更性质；
2. `scope` 只在存在稳定模块或业务能力名称时使用，不为满足格式自造；跨模块但仍是一个变化时使用共同功能 scope，无法形成共同 scope 时检查拆分；
3. 摘要命名具体对象、动作和结果；
4. 单独出现在 `git log --oneline` 时仍能与同类提交区分；
5. 不以句号结尾；
6. 任何使既有调用方、数据或运维流程不能继续按原契约工作的接口、输入、输出、配置、数据格式、默认值或运行语义变化，在 type/scope 后使用 `!`，并按第 9.5 节写 `BREAKING CHANGE`。

以下标题不通过：

```text
refactor(cache): 优化缓存治理闭环
feat(debug): 完成第二阶段
chore(repo): 对齐机制
feat(systematic-debugging): 发布 checkpoint
```

“优化、对齐、固化、完善、闭环、阶段、checkpoint”等词不是绝对禁词；只有同时写清对象、行为和结果时才可使用。真实 API、配置、schema 或版本名可以保留，但正文首次出现时说明它在本次变化中的作用。

### 9.3 Body

本项目中准备进入长期历史或 push 的 commit 使用四个标题：

```text
背景：
变更：
影响与边界：
验证：
```

按改动选择内容 profile：

- **行为变化 profile**：背景写触发条件、旧行为和实际问题；变更写新行为及非显然理由；影响写调用方、数据、接口、配置、部署、兼容、迁移、权衡和限制中实际存在的部分；验证写真实场景/命令、实际结果和未覆盖范围。
- **无行为变化 profile**：适用于拼写、注释、纯格式、机械重命名或经证据确认的重构。四段都保持简短：为什么需要调整、具体改了什么、经核实不改变哪些运行行为、实际做了什么检查。不得制造用户影响、风险或替代方案来凑字数。

事实按类别取证：

1. 旧/新业务行为和使用者影响回到当前业务契约及仓库实现事实；
2. 代码、配置、数据和接口变化回到 staged diff 与目标 tree；
3. 风险和权衡属于评估，写明依据和不确定性，不冒充已观察事实；
4. 验证结果只能来自实际命令、CI、运行或人工检查；
5. Message 只摘要上述事实和证据，不是证据本体。

不得凭记忆填写，也不得用 `hash/publicity/main-set=PASS` 等检查器名称替代可理解结果。证据只支持部分结论时缩小表述；不推断旧作者意图、停机时间、未给出的文件、风险等级或测试结果。

本项目提交信息使用中文，真实 API、标识符和协议字段保留原名。文字使用人类工程师陈述事实的语气，不包含模型/工具读取过程、AI branding 或 AI attribution；项目明确要求机器生成声明时除外。

### 9.4 自包含评审门禁

提交前从默认读者视角，仅凭 message、diff 和已有代码回答：

1. 哪个用户、业务流程或组件在什么条件下出现什么旧行为？
2. 为什么需要改变，实际影响是什么？
3. 本提交把行为改成什么，改动前后有什么可观察差异？
4. 为什么选择当前方案；是否有 reviewer 需要判断的权衡或替代？
5. 哪些调用方、数据、接口、配置或运行方式受影响，哪些明确不变？
6. 实际验证了什么、结果是什么，哪些关键范围失败或未验证？
7. 不打开聊天、issue、仓库外文档和内部评测代号，能否开始判断 diff 是否正确？

任一适用问题答不出时不得提交。根据原因补事实、重写 message、补验证或拆 commit；不能用更多抽象名词填满模板。

### 9.5 引用与 Trailer

正文先自包含，再用 trailer 定位机器或跨系统信息：

```text
Fixes: <sha> ("<原提交标题>")
Refs: <可访问 issue/PR>
BREAKING CHANGE: <受影响接口；旧行为；新行为；调用方迁移动作>
```

规则：

- 引用 commit 时同时给足够长度的 SHA 和标题；不禁止哈希，但禁止只给哈希；
- repo-relative 路径应在目标 tree 中可追踪；若本提交删除或重命名该路径，正文明确其旧身份，并保证它可从指定 parent/source commit 定位；仓库外文档必须把关键结论写回正文；
- URL、issue、任务号和设计文档不能替代问题、方案与影响；
- 机器 trailer 放在正文末尾；
- 既有调用方、数据或运维流程不能继续按原契约工作的接口、输入、输出、配置、数据格式、默认值或运行语义变化，必须同时使用标题 `!` 和 `BREAKING CHANGE`；
- `BREAKING CHANGE` 不只写 schema/版本号，必须写受影响对象和已知前后行为；迁移部分写已确认动作、明确没有迁移路径，或如实说明迁移路径尚未确认，未知停机和步骤不得推断；
- Tests 命令若因工具约定进入 trailer，正文验证段仍说明测试对象和实际结果。

### 9.6 提交前公开性检查

#### 9.6.1 公开性四问

`git add` 前列出本次 intended paths，包括未跟踪文件，并逐文件回答：

1. 文件属于项目公开性分类的哪一档；是否允许进入当前仓库？
2. 文件是否被 `.gitignore` 默认忽略；若使用精确公开例外，公开原因和范围是否已获批准？
3. 文件是否包含真实密钥、token、内网 URL、客户数据或个人身份信息；是否已经脱敏？
4. 文件是否属于测试；其单元/集成/E2E/夹具/覆盖率类别是否符合当前仓库公开性规则？

任一问题无法肯定通过时，不执行 `git add`。暂存后对 staged 文件和 message 再做一次同样检查，确认没有 hook、生成器或误操作扩大范围。

#### 9.6.2 Message 自身

提交信息同样不得包含秘密、未经批准的内网信息、客户/人员身份或不可公开运维细节。敏感词命中需要人工确认；合法 API、安全说明和已脱敏示例不能只因关键词被删除。

### 9.7 特殊提交

- **revert**：标题说明撤销的行为；正文写被撤销提交、撤销原因、恢复后的行为和验证，不只保留自动生成的 `This reverts commit`。
- **cherry-pick**：保留来源 SHA/`-x` 定位；若目标环境差异影响行为，在正文说明；来源引用不替代当前影响。
- **merge commit**：说明合并哪两条历史、为什么需要非快进 merge、重要冲突如何裁决以及最终验证。
- **多模块变化**：只有共同完成一个结果时使用共同功能 scope；否则拆 commit。
- **历史改写**：message 描述最终逻辑变化，不记录“第 N 版、按评审意见修改、重跑第二轮”等 patch iteration；改写动作本身另记 Git 决策日志。

### 9.8 正反示例

以下是通用教学例子，不代表当前项目实现。

不通过：

```text
fix(checkout): 优化库存处理

背景：
- checkout 有问题。

变更：
- 完善库存机制。

影响与边界：
- 提升一致性。

验证：
- Tests: checkout=PASS
```

它没有说明触发条件、旧行为、新行为和测试结果，评审者无法判断 diff 是否解决了真实问题。

通过方向：

```text
fix(checkout): 支付拒绝时保持库存不变

背景：
- checkout 在支付被拒绝后仍保留库存扣减，用户没有完成订单，但后续请求看到的可售库存已经减少。

变更：
- checkout 现在只在支付成功后确认库存扣减；支付拒绝时返回失败，并保持原库存数量。

影响与边界：
- 支付失败不再占用库存；支付成功流程和库存不足处理不变。
- 本提交只修改 checkout 的库存确认顺序，不改变支付服务接口。

验证：
- 拒绝支付场景测试通过：响应失败且库存保持原值。
- 支付成功和库存不足回归测试通过；未执行跨服务端到端测试。
```

### 9.9 提交信息机械与语义复核

#### 9.9.1 机器可判定项

可由 hook、CI 或提交前脚本强制检查：

- 标题符合项目允许的 Conventional Commits 结构；
- body 非空且含 `背景：`、`变更：`、`影响与边界：`、`验证：`；
- trailer 位于末尾且格式可解析；
- 没有 token、密码、私钥标记、内网 URL、客户/人员信息等可疑敏感串；
- message 引用的 repo-relative 路径在目标 tree 中可追踪，或已明确为可从指定 parent/source commit 定位的旧路径；
- 没有空段或只写“见 diff、已完成、已验证、无”。

检测命中后人工确认；合法 API 名和安全文档不能因关键词被直接删除。

#### 9.9.2 不能只靠机器判断的项

以下由七问门禁和 reviewer 判断：

- 标题是否真的说明行为变化；
- 内部术语是否已经解释；
- 一个 commit 是否只有一个中心变化；
- 方案理由、风险和验证范围是否足够；
- message 是否与 staged diff 一致。

禁词表不能替代这项判断，也不设置统一 body 行数上限。

#### 9.9.3 Commit 后复核

Commit 成功后立即读取：

```bash
git show -s --format='%H%n%T%n%P%n%B' HEAD
git diff-tree --no-commit-id --name-status -r HEAD
git show --stat --oneline HEAD
```

检查真实 commit 的 OID、tree、parent、文件、标题、body 和 trailer 与已审核草稿一致。Merge commit 还要分别比较其 tree 与每个 parent；combined diff 不能替代逐 parent 检查。Hook 修改 message 或文件时，以 commit 对象为准重新评审。

## 10. Push 与远端验证

### 10.1 Push 前

先按第 3.2 节确认脱敏后的单一 fetch/push 目标，再读取精确远端 branch：

```bash
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
git status -sb
git rev-list --left-right --count refs/remotes/<remote>/<branch>...HEAD
git log --left-right --graph --oneline refs/remotes/<remote>/<branch>...HEAD
```

保存 `ls-remote` 返回的唯一远端 OID，并确认：

- remote/provider/branch 是用户授权目标；
- remote-only 为 0；
- local-only 是预期 commit；
- 工作树剩余改动可解释且不会被误认为已推送；
- 当前平台认证已由用户配置；
- 远端 branch 不存在时，已经单独取得创建授权。

远端 branch 不存在时不使用 stale tracking ref 计算 remote-only。创建流程单独记录“远端无该 ref”、本地 HEAD、目标 branch 和授权，再执行显式 `HEAD:refs/heads/<branch>` push，并按第 10.2 节验证新 ref。

### 10.2 执行与验证

```bash
git push <remote> HEAD:refs/heads/<branch>
git ls-remote --exit-code --refs <remote> refs/heads/<branch>
git fetch --no-tags <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>
```

`ls-remote` 必须恰好返回一条记录。将其 OID 与 `git rev-parse HEAD` 的结果做等值比较；只有相同才能声明该 branch push 成功。`git push` 退出 0、`rev-parse` 打印两个值或 stale tracking ref 都不能替代比较。

多个 remote 分别执行和验证；GitHub 成功不能证明 Codeup 成功。任一 remote 有多个有效 pushurl 时不得进入本步骤。

Push 成功不代表 PR/MR 已创建、合并、发布或部署。必须分别读取对应平台事实。

### 10.3 Protected Branch

平台拒绝直接 push 且错误指向 branch protection 时，按项目流程创建 PR/MR。禁止通过 force push、替代 branch 名或关闭保护绕过策略。

## 11. 错误恢复

| 错误 | 分类 | 恢复 |
|---|---|---|
| `No such remote` | remote 名错误 | 读取 `git remote` 名称；修改使用现有名称，新增仓库才 `remote add` |
| 401/403 | HTTPS 认证/授权 | 用户更新平台凭据或授权；不改变历史 |
| `Permission denied (publickey)` | SSH key/账号/host | 用户检查公钥、账号、host alias 和 ssh-agent；不复制私钥 |
| `non-fast-forward` | 历史分叉 | fetch、比较 remote-only/local-only，按第 6 节处理 |
| `Need to specify how to reconcile divergent branches` | 未选择整合策略 | 停止 pull，显式选择 fast-forward、merge、rebase 或保留分支 |
| merge/rebase conflict | 整合冲突 | 只处理当前操作；无法安全继续则 abort |
| detached HEAD | 无当前 branch | 记录 HEAD，建立明确保留引用后再切换 |
| protected branch | 平台策略 | PR/MR，不绕过 |
| push 后跟踪分支未变化 | 裸 URL 或 ref 未 fetch | 读取 ls-remote，并 fetch 命名 remote 验证 |

遇到未列错误时保留原命令、脱敏错误、状态和 refs，再查 Git 或 provider 官方文档；不试探 force/reset。

## 12. Git 决策日志

只有需要长期审计的异常或高风险决策才写 `docs/work-logs/YYYY-MM-DD.md`：

- 实际 Git 仓库、branch、remote/provider；
- 操作前 HEAD、remote ref、ahead/behind 和工作树状态；
- 触发错误或目标；
- 选择 merge/rebase/保留分支/历史改写的理由；
- rescue 引用和恢复命令；
- 实际执行命令；
- commit 和远端 ref 的最终结果；
- 未处理的本地改动、风险和责任。

日志不保存凭据，不复制敏感 remote URL 参数，也不冒充当前 branch/ref 事实源。

## 13. 退出门禁

### 13.1 只读检查

- 仓库根、HEAD、branch、工作树、remote 名称、浅克隆状态和目标问题均已从当前 Git 输出确认；
- URL 只以脱敏形式显示，且多 URL/pushurl 数量已检查；
- 结论区分本地、远端和历史背景。

### 13.2 Commit

- `git add` 前 intended paths 已完成公开性四问，暂存后再次检查；
- staged diff 只有一个中心变化；
- 与改动匹配的验证已实际执行或明确失败/未执行边界；
- 文件和 message 通过公开性、敏感信息检查；
- message 通过适用 profile、四段结构和七问自包含门禁；
- commit 后真实 OID、tree、parent、文件清单和 message 已读取；
- 不把 commit 存在外推成 push 或 merge。

### 13.3 Sync/Merge/Rebase

- 操作前有完整历史基线和覆盖实际数据类型的恢复路径；
- staged、unstaged 和 untracked 状态已按用户决定处理；
- 策略符合共享/未共享历史边界，发布范围已明确；
- 冲突、验证和剩余差异可解释；
- 未使用未授权历史改写。

### 13.4 Push

- remote/provider、单一 push 目标、完整 `refs/heads/<branch>`、认证协议和授权目标明确；
- push 前精确远端 OID 已保存，remote-only 为 0，或新建 branch 已单独授权；
- push 后 `ls-remote --exit-code --refs` 恰好返回一条记录，OID 与本地 HEAD 相同；
- 多 remote 分别验证；
- 未把 push 写成 PR/MR、merge、release 或 deploy。

## 14. 版本历史

| 版本 | 变更 |
|---|---|
| 2.0.0 | 将 Git 治理从提交格式和冲突恢复扩展为完整协作链路：区分项目根/Git 根，增加 remote 角色、GitHub/Codeup 认证、fetch/push URL、多平台、dirty worktree、ahead/behind、分叉决策和远端验证；增加一个 commit 一个中心变化；把提交信息升级为面向人类代码评审的四段自包含契约，并补充机器检查、敏感信息、引用、revert/cherry-pick/merge/破坏性变化规则 |
| 1.1.0 | 增加 Conventional Commits 标题、三段 body、footer 和提交前公开性检查 |
| 1.0.0 | 定义共享分支同步、merge/rebase 恢复、救援分支和双端开发流程 |
