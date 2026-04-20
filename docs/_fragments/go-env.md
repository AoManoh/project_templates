# Go 环境管理

本片段定义 Go 后端项目的环境管理规范，供 AGENTS.md 引用。

---

## 运行时要求

| 工具  | 最低版本 | 说明                             |
| ----- | -------- | -------------------------------- |
| Go    | >= 1.23  | 项目运行时（与 go.mod 保持一致） |
| MySQL | >= 8.0   | 数据库（docker-compose 中定义）  |

---

## 环境校验

在执行任何操作前，必须校验 Go 环境：

```bash
go version   # 确认版本 >= 1.21
mysql --version   # 确认 MySQL 可用（或通过 Docker）
```

---

## 依赖管理

### 镜像源配置（强制）

**为什么强制？** 因为 Go 默认的 proxy.golang.org 在国内网络环境下经常超时或不可达，会导致 `go mod download` 失败。

```bash
# 设置 Go 模块代理为国内镜像（阿里云）
go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct

# 验证配置是否生效
go env GOPROXY
```

### 安装依赖

```bash
# 下载全部依赖（在 server/ 目录下执行）
cd server
go mod download

# 整理依赖（移除未使用的、添加缺失的）
go mod tidy
```

---

## 配置管理规范

### 禁止硬编码配置

**为什么？** 因为硬编码会导致不同环境（开发/测试/生产）之间切换困难，且敏感信息（密钥、密码）泄露到代码仓库。

**强制规则**：

- 所有配置项必须通过环境变量读取，统一由 `.env` 文件管理
- 使用 `github.com/joho/godotenv` 加载 `.env` 文件
- 每个配置项必须提供合理的默认值（通过 `getEnv(key, defaultValue)` 模式）
- 新增配置项时，必须同步更新 `.env.example` 文件

### 配置读取模式

```go
// 正确：通过环境变量读取，提供默认值
port := getEnv("SERVER_PORT", "9877")

// 错误：硬编码配置值
port := "9877"
```

---

## 常用命令速查

| 操作              | 命令                              | 工作目录 |
| ----------------- | --------------------------------- | -------- |
| 下载依赖          | `go mod download`                 | server/  |
| 整理依赖          | `go mod tidy`                     | server/  |
| 编译构建          | `go build -o main ./cmd/server`   | server/  |
| 开发运行          | `go run ./cmd/server`             | server/  |
| 生成 Swagger 文档 | `swag init -g cmd/server/main.go` | server/  |
| 运行测试          | `go test ./...`                   | server/  |

---

## Docker 构建

项目使用多阶段 Docker 构建，后端构建阶段基于 `golang:1.21-alpine`：

```bash
# 构建并启动全部服务
docker-compose up -d --build

# 仅构建后端镜像
docker-compose build api

# 查看服务日志
docker-compose logs -f api
```