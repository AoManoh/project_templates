# PUA Skill 规范

**版本**: 1.3.0
**适用范围**: 项目级共享激励技能，面向所有需要提升主动性、执行强度、失败恢复、证据验证和反偷懒能力的任务场景

---

## 1. 目标

本规范用于约束 `skills/pua/` 在当前模板仓库中的定位、边界和更新方式。

为什么：`pua` 属于行为型 Overlay Skill，不是产出型治理器。如果不提前说明 owner 边界，就很容易和现有的治理 Skill 混成第二套流程；如果弱化其压力机制，又会失去它提升 AI power effort 的核心价值。

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
- `git-governance`
- `requirements-governance`

### 3.2 真正职责

`pua` 只负责：

1. 让 AI 不轻易放弃
2. 让 AI 在提问前先自行排查
3. 让 AI 在失败后切换本质不同方案
4. 让 AI 在宣称完成前提供验证证据
5. 让 AI 在任务开始时主动评估主治理 Skill 与行为型 Overlay
6. 让 AI 在规则已经裁决时避免把执行责任退回给用户
7. 让 AI 通过强情绪话术、压力升级和失败模式识别维持高 power effort

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
2. **压力机制不弱化**：强情绪话术、压力升级、失败模式选择器、能动性鞭策和完成前证据压力属于核心机制，不能删成普通提醒或弱化为无约束建议。
3. **允许降敏但不去势**：可以根据项目公开性、表达风格和安全边界重写具体措辞，但必须保留其让 AI 主动切换方法论、搜索证据、读取源码和执行验证的强制效果。
4. **只对 AI 自身施压**：强情绪话术只能用于 AI 自我驱动、自我纠偏和提升执行强度，不得羞辱用户、开发者或第三方，不得把压力转嫁给用户。
5. **主动不等于越权**：不得为了“主动”跳过事实确认、测试验证、权限边界、公开性自检、安全限制或用户明确授权。
6. **正文可裁剪但语义不反转**：允许按当前仓库风格重写为本地 `SKILL.md`，但核心行为不能弱化成“可选建议”。
7. **细则写到 `SPEC.md`**：上游来源、同步方式、owner 边界放这里，不塞回 `AGENTS.md`。

---

## 6. 手工更新方式

当前仓库不建议为此引入额外脚本。

建议的人工同步方式：

1. 阅读上游 `codex/pua/SKILL.md`
2. 对照当前本地 `skills/pua/SKILL.md`
3. 只同步真正需要的触发条件、强制行为、强情绪话术、压力升级和核心方法论
4. 若有重要结构变化，在本文件追加版本记录

---

## 7. 验收标准

并入当前模板仓库后，应满足：

1. `skills/pua/SKILL.md` 存在
2. `skills/pua/SPEC.md` 存在
3. `AGENTS.md` 根目录结构中出现 `skills/pua/`
4. `AGENTS.md` Skill 注册表中出现 `pua`
5. `AGENTS.md` 明确允许 `output_dir = N/A` 的行为型 Skill
6. `AGENTS.md` 明确主治理 Skill 与行为型 Overlay Skill 的调度关系
7. `skills/pua/SKILL.md` 包含 `PUA-DIAGNOSIS`、压力升级、失败模式识别、能动性等级和安全边界
8. `skills/pua/SKILL.md` §3.7 直接携带大厂味话术库、失败模式→味映射与自动选择机制，不再依赖外部片段

---

## 8. 版本历史

| 版本 | 变更 |
|------|------|
| 1.3.0 | 大厂味话术库 / 失败模式→味映射 / 能动性量化锚点（3.25、3.75）/ 自动选择机制直接并入 SKILL.md §3.4 与 §3.7，对齐上游 `tanweai/pua` 单文件结构；移除独立片段 `docs/_fragments/pua-emotional-pack.md` |

1.3.0 之前的演进记录见 Git 提交历史。
