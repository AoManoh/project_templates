# Node.js 环境管理

本片段定义 Node.js 项目的环境管理规范，供 AGENTS.md 引用。

---

## 运行时要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | >= {{Node版本}} | 项目运行时 |
| npm | >= 9.0.0 | 包管理器 |

---

## 环境校验

在执行任何操作前，必须校验 Node.js 环境：

```bash
node -v   # 确认版本满足要求
npm -v    # 确认 >= 9.0.0
```

---

## 依赖管理

### 镜像源配置（强制）

**为避免依赖下载失败，必须使用国内镜像源加速。**

```bash
# 方法一：命令行指定镜像源
npm install --registry=https://registry.npmmirror.com

# 方法二：配置 .npmrc 文件（推荐）
# 在项目根目录或用户目录创建 .npmrc 文件
registry=https://registry.npmmirror.com
```

### 安装依赖

```bash
# 安装全部依赖
npm install

# 安装运行时依赖
npm install <package-name>

# 安装开发依赖
npm install -D <package-name>
```

---

## 常用命令速查

| 操作 | 命令 |
|------|------|
| 安装依赖 | `npm install` |
| 开发运行 | `npm run dev` |
| 构建 | `npm run build` |
| 类型检查 | `npm run typecheck` |
| 生产运行 | `npm run start` |

