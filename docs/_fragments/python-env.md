# Python 环境管理

本片段定义 Python 项目的环境管理规范，供 AGENTS.md 引用。

---

## 运行时要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Python | >= {{Python版本}} | 项目运行时 |
| uv | >= 0.1.0 | 包管理器，替代 pip |

---

## 虚拟环境管理

### 创建虚拟环境

使用 uv 在项目根目录下创建虚拟环境：

```bash
# 创建名为 .venv 的虚拟环境
uv venv .venv

# 如需指定 Python 版本
uv venv .venv --python 3.12
```

### 激活虚拟环境

```bash
# Windows (PowerShell)
.\.venv\Scripts\activate

# Windows (CMD)
.venv\Scripts\activate.bat

# Linux / macOS
source .venv/bin/activate
```

### 校验虚拟环境状态

在执行任何操作前，必须校验是否处于虚拟环境中：

```bash
# 方法一：检查命令行提示符是否有 (.venv) 前缀

# 方法二：检查 VIRTUAL_ENV 环境变量
# PowerShell
echo $env:VIRTUAL_ENV

# Linux / macOS
echo $VIRTUAL_ENV
```

如果输出为空或不包含当前项目的 .venv 路径，说明未处于虚拟环境中。

---

## 依赖管理

### 镜像源配置（强制）

**为避免依赖下载失败，必须使用阿里云镜像源加速。**

```bash
# 方法一：命令行指定镜像源
uv pip install fastapi -i https://mirrors.aliyun.com/pypi/simple/

# 方法二：配置环境变量（推荐）
# PowerShell
$env:UV_INDEX_URL = "https://mirrors.aliyun.com/pypi/simple/"

# Linux / macOS
export UV_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/"

# 方法三：配置 uv 全局设置
# 创建或编辑 ~/.config/uv/uv.toml (Linux/macOS) 或 %APPDATA%\uv\uv.toml (Windows)
# [pip]
# index-url = "https://mirrors.aliyun.com/pypi/simple/"
```

### 安装依赖

```bash
# 安装单个依赖
uv pip install fastapi -i https://mirrors.aliyun.com/pypi/simple/

# 从 requirements.txt 安装
uv pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# 导出依赖
uv pip freeze > requirements.txt
```

---

## 代码规范

- 使用 ruff 进行代码格式化
- 使用 mypy 进行类型检查
- 遵循 PEP 8 编码规范
- 所有函数必须有类型注解

---

## 常用命令速查

| 操作 | 命令 |
|------|------|
| 创建虚拟环境 | `uv venv .venv` |
| 激活虚拟环境 (Linux) | `source .venv/bin/activate` |
| 激活虚拟环境 (Windows) | `.\.venv\Scripts\activate` |
| 安装依赖 (阿里云源) | `uv pip install <包名> -i https://mirrors.aliyun.com/pypi/simple/` |
| 导出依赖 | `uv pip freeze > requirements.txt` |
| 校验虚拟环境 | `echo $VIRTUAL_ENV` |
| 代码格式化 | `ruff format .` |
| 类型检查 | `mypy .` |

