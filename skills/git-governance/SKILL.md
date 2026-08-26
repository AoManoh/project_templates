---
name: git-governance
description: >-
  生成或改写 Git commit message 时必须先使用，即使不执行 Git 命令；最终只输出 message，
  不在调用前后添加过程旁白。审查 message，或创建、修改、整合、发布 Git 历史与引用时也使用，
  包括 branch/worktree、remote/认证、merge/rebase/cherry-pick/revert、push、历史改写及
  non-fast-forward、分叉、冲突、中断、protected branch。普通代码/测试设计、仅评审文件内容，
  或无需 Git 决策的简单只读 status/log/diff 查询不使用。
---

# Git 协作治理 Skill

**skill_id**: `git-governance`
**版本**: 2.2.0
**output_dir**: `docs/work-logs/`
**SPEC**: [SPEC.md](./SPEC.md)

## 1. 角色与边界

本 Skill 负责把已经确认的改动安全、清楚地写入 Git 历史，并验证远端实际结果。它管理仓库根、remote、认证、同步、分叉、commit、message、push、branch/worktree 生命周期和恢复边界。

本 Skill 不决定业务目标、实现方案、代码修改或测试充分性；对应开发、重构、调试或需求 Skill 仍是内容负责人，git-governance 只拥有 Git 链路。

正常 commit/push 不创建工作日志。分叉整合、历史改写、跨平台同步、恢复中断操作，或 branch/worktree 跨会话保留时，才按 SPEC §13 写入 `docs/work-logs/`。

## 2. 渐进式加载路由

触发后先用内容搜索工具匹配 `^## `，定位 SPEC 章节起止，只读当前任务命中的行段；禁止从文件开头顺序翻页到目标章节：

| 当前任务 | 加载 SPEC |
|---|---|
| 项目根、Git 根或事实来源不明确 | §1–2 |
| remote 命名、URL、GitHub/Codeup 认证 | §3–4；修改后 §14.6 |
| status、fetch、ahead/behind、dirty worktree | §5 |
| 分叉、merge、rebase、reset、force push | §6–7 |
| 完整事实已给定，只生成普通 message，不读取 diff | 直接用本文件 §6，不加载 SPEC |
| staged 范围、原子 commit、message 评审、引用或 breaking 歧义 | §8–9 |
| cherry-pick、revert，包括冲突和生成 commit | §6–9 适用段；错误时 §12；退出时 §14.2–14.3 |
| push、远端 OID、protected branch | §10 |
| branch/worktree、多 Agent 并发与回收 | §11 |
| 错误恢复、长期日志、完成判断 | 按需读 §12–14 |

不要因 Skill 已触发就默认加载完整 SPEC。任务跨多个场景时加载对应多段；动作范围扩大时再补读新段。任何 Git 写操作结束前都读 §14 的对应退出门禁。

## 3. 五条核心原则

1. **当前事实优先**：确认项目根和实际 Git 根，读取当前 HEAD、工作树、branch、remote 和相关历史；不凭上轮记忆继续。
2. **用户数据与授权优先**：dirty、ignored、submodule 和未跟踪内容都可能是用户数据。reset、clean、删除引用、历史改写和覆盖远端必须针对当前对象重新确认并具备恢复路径。
3. **精确引用与结果证据**：使用命名 remote、完整 ref 和当前 OID。命令退出 0、push 文本或 stale tracking ref 不能替代远端 OID 等值检查。
4. **一个 commit 一个中心变化**：提交应能整体 review、revert、cherry-pick 和 bisect；message 直接说明旧行为、新行为、影响边界和真实验证。
5. **创建就负责回收**：任何 worktree 写入前取得共享 write claim；一项写任务独占一个 worktree。任务结束时清理本任务对象，或记录 durable anchor、责任人、复核点和可判定退出条件。

## 4. 最小工作流

1. **建立现场**：确认双重根路径、HEAD、工作树、branch/worktree、remote 名称和相关 log；URL 只经脱敏后显示。
2. **选择细则**：按 §2 路由加载 SPEC，不把无关认证、message 或生命周期细则同时塞入上下文。
3. **作出决策**：明确目标 ref、发布范围、dirty 数据处置、共享状态和授权；不明确时停止。
4. **执行并复核**：只执行已批准范围；commit 后读真实 tree/parent/message，push 后读远端 OID。
5. **收口生命周期**：盘点本任务创建的 branch/worktree/claim；clean/merged 不代表责任人释放，删除前重读最终状态。

## 5. 高频停止条件

| 现场 | 必须停止并处理 |
|---|---|
| 项目根或 Git 根不明确 | 不执行 Git 写操作，不擅自 `git init` |
| dirty worktree 将进入整合或切换 | 由用户决定 commit、备份、stash、独立 worktree 或丢弃 |
| remote/provider/branch 或发布范围不明确 | 不 fetch/push 到猜测目标 |
| 双方历史分叉 | 不普通 push，不让无策略 pull 自动选择 merge/rebase |
| local-only 提交是否共享或获准发布不明确 | 不用 merge 代替授权判断 |
| 认证需要秘密或交互 | 由用户在平台或本机处理，不读取、展示或持久化凭据 |
| destructive action 的对象、OID、数据状态或恢复路径变化 | 旧确认失效，重新取证和确认 |
| worktree 存在其他 Agent 的 active/unknown claim | 不写入、不抢占；使用独立 worktree 或等待 handoff |
| 清理对象含 dirty/ignored/submodule/nested-repo 或唯一提交 | 不 force remove/delete；先保护数据并裁决归属 |

## 6. 提交信息承诺

完整事实已由当前输入给定、只需生成普通 message 时，直接使用以下最小契约，不加载 SPEC：

```text
<type>[可选 (<scope>)][可选 !]: <具体对象的行为变化或结果>

背景：<旧行为、触发条件和实际问题>
变更：<新行为及必要理由>
影响与边界：<实际影响、限制和明确不变项>
验证：<真实检查、结果和未覆盖范围>
```

同时满足：

- 只输出可直接交给 `git commit` 的 message，不加读取过程、分析旁白或 Markdown 代码围栏；
- 会话中的“用户要求”“AI 认为”“按本轮讨论”不能替代变更原因；真实业务用户、管理员、维护者或 AI Agent 是产品/权限角色时可以保留并说明语义；
- 每句话只来自当前输入或实际证据，不补充未给出的并发、兼容、风险、文件或验证边界；
- 路径、章节、issue、URL 与 SHA 只能补充定位；不可访问或可能失效的引用不能承担结论；
- 存在 staged 范围、引用、breaking、revert/cherry-pick 或事实充分性歧义时，改读 SPEC §8–9。

## 7. 退出纪律

只有以下事实都可观察时，Git 任务才可结束：

- 仓库、目标 ref、工作树和授权范围明确；
- commit 只有一个中心变化，真实 tree、parent、文件和 message 已复核；
- message 不依赖当前会话、不可访问资料或未解释代号即可供维护者评审；
- push 场景已验证远端 OID，多个 remote 分别验证；
- 本任务 write claim 已 release/handoff；创建的 branch/worktree 已清理，或已记录可达引用、责任人、下一复核和下一动作；
- 没有把 commit、push、PR/MR、merge、release 或 deploy 互相冒充。
