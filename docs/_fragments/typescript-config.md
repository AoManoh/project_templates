# TypeScript 配置约束

本片段定义 TypeScript 项目的配置约束和代码规范，供 AGENTS.md 引用。

---

## tsconfig.json 强制配置

以下选项**禁止关闭**，它们是类型安全的底线：

| 选项 | 值 | 为什么不能关闭 |
|------|----|----------------|
| strict | true | 包含 strictNullChecks 等一系列严格检查，关闭会导致空指针等运行时错误 |
| noUnusedLocals | true | 未使用的变量是代码腐化的信号，必须及时清理 |
| noUnusedParameters | true | 未使用的参数说明接口设计有问题或实现不完整 |
| noFallthroughCasesInSwitch | true | switch 穿透是常见 bug 来源 |

---

## 代码规范

### 类型约束

- 所有函数必须有明确的参数类型和返回类型
- 禁止使用 `any` 类型，必须使用 `unknown` 并进行类型收窄
- 接口命名不加 `I` 前缀（如 `ParseResult` 而非 `IParseResult`）

### 模块系统

- 使用 ESM 模块系统（`import/export`），禁止 `require`
- 文件扩展名使用 `.ts`，入口文件使用 `.ts`

### 命名规范

- 文件命名使用 kebab-case（如 `my-module.ts`）
- 类名使用 PascalCase
- 函数和变量使用 camelCase
- 常量使用 UPPER_SNAKE_CASE

---

## 推荐的 tsconfig.json 模板

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 开发依赖说明

| 依赖 | 用途 | 为什么选择 |
|------|------|------------|
| typescript | 类型系统 | 严格类型检查保障代码质量 |
| tsup | 构建工具 | 基于 esbuild，零配置打包 ESM |
| tsx | 开发运行时 | 直接运行 .ts 文件，无需预编译 |
| @types/node | Node.js 类型定义 | 为 Node.js API 提供类型支持 |

