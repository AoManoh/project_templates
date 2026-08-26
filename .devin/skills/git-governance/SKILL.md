---
name: git-governance
description: >-
  生成或改写 Git commit message 时必须先使用，即使不执行 Git 命令；最终只输出 message，
  不在调用前后添加过程旁白。审查 message，或创建、修改、整合、发布 Git 历史与引用时也使用，
  包括 branch/worktree、remote/认证、merge/rebase/cherry-pick/revert、push、历史改写及
  non-fast-forward、分叉、冲突、中断、protected branch。普通代码/测试设计、仅评审文件内容，
  或无需 Git 决策的简单只读 status/log/diff 查询不使用。
---

# Git 治理发现适配器

这是 Devin CLI 的项目级发现入口，不是第二份行为契约。唯一下一动作是读取 [唯一 Skill 事实源](../../../skills/git-governance/SKILL.md)；在该 Skill 完成场景路由前，不执行任务，也不读取任何 SPEC。适配器目录没有 `SPEC.md`；路由后遇到根 Skill 的 `./SPEC.md`，必须相对根 Skill 所在目录解析。
