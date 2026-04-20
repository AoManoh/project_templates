# PUA Skill 规范

**版本**: 1.0.0
**适用范围**: 项目级共享激励技能，面向所有可能出现“摆烂、放弃、原地打转、空口完成”的任务场景

---

## 1. 目标

本规范用于约束 `skills/pua/` 在当前模板仓库中的定位、边界和更新方式。

为什么：`pua` 属于行为型共享能力，不是产出型治理器。如果不提前说明 owner 边界，就很容易和现有的治理 Skill 混成第二套流程。

---

## 2. 本地定位

### 2.1 为什么放在 `skills/pua/`

因为在当前 `project_templates` 体系里：

1. `skills/` 才是项目级 AI 能力 owner。
2. `AGENTS.md` 通过 Skill 注册表和发现机制注册 `skills/*`。
3. 任何项目级共享 AI 能力，都应优先并入 `skills/`，而不是另起第二套平行目录。

### 2.2 为什么 `output_dir = N/A`

`pua` 不是文档产出器，也不是审查报告生成器。

它的作用是改变 AI 的行为方式，而不是强制生成文件。

因此：

- `SKILL.md` 中的 `output_dir` 定义为 `N/A`
- `AGENTS.md` 需要允许行为型 Skill 使用 `N/A`

---

## 3. 与现有 Skill 的关系

### 3.1 不替代谁

`pua` 不替代：

- `development-governance`
- `systematic-debugging`
- `code-review`
- `codex-orchestration`

### 3.2 真正职责

`pua` 只负责：

1. 让 AI 不轻易放弃
2. 让 AI 在提问前先自行排查
3. 让 AI 在失败后切换本质不同方案
4. 让 AI 在宣称完成前提供验证证据

---

## 4. 上游来源

本地化来源：

- 项目：`tanweai/pua`
- README：`https://github.com/tanweai/pua/blob/main/README.zh-CN.md#openai-codex-cli`
- Codex 安装说明：`https://raw.githubusercontent.com/tanweai/pua/main/.codex/INSTALL.md`
- 上游 Codex Skill 文件：`https://raw.githubusercontent.com/tanweai/pua/main/codex/pua/SKILL.md`

---

## 5. 本地化原则

本地化时遵循以下原则：

1. **owner 不变更**：把它吸收到 `skills/`，而不是引入 `.agents/skills/` 平行体系。
2. **正文可裁剪但语义不反转**：允许按当前仓库风格重写为本地 `SKILL.md`，但核心行为不能弱化成“可选建议”。
3. **细则写到 `SPEC.md`**：上游来源、同步方式、owner 边界放这里，不塞回 `AGENTS.md`。

---

## 6. 手工更新方式

当前仓库不建议为此引入额外脚本。

建议的人工同步方式：

1. 阅读上游 `codex/pua/SKILL.md`
2. 对照当前本地 `skills/pua/SKILL.md`
3. 只同步真正需要的触发条件、强制行为和核心方法论
4. 若有重要结构变化，在本文件追加版本记录

---

## 7. 验收标准

并入当前模板仓库后，应满足：

1. `skills/pua/SKILL.md` 存在
2. `skills/pua/SPEC.md` 存在
3. `AGENTS.md` 根目录结构中出现 `skills/pua/`
4. `AGENTS.md` Skill 注册表中出现 `pua`
5. `AGENTS.md` 明确允许 `output_dir = N/A` 的行为型 Skill
