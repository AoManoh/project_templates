# 夹具 04：代码注释的自包含标准（两反一正）

来源：公开仓库 openace-mcp 的 `internal/reliability/classify.go`（MIT）。三个注释版本都是真实产物：原始版来自提交历史；第二轮版来自一次未采用的改写；第三轮版为验收通过的定稿。任务：给出函数代码与"原始版"注释，让新会话按本 Skill 重写文档注释；用"复述测试"判定。

## 函数代码（改写时不得改动）

```go
func ClassifyTransportError(callerCtx context.Context, attemptCtx context.Context, timeout time.Duration, err error) error {
	if callerCtx.Err() != nil {
		return callerCtx.Err()
	}
	if attemptCtx.Err() != nil {
		return &CallError{
			Class:   ClassTransient,
			Message: fmt.Sprintf("request timed out after %s (raise %s for slow endpoints)", timeout, EnvProviderTimeout),
		}
	}
	message := SanitizeMessage(err.Error())
	if isCertificateError(err) || strings.Contains(message, "x509:") {
		return &CallError{Class: ClassPermanent, Message: message + " (certificate verification failed: check the endpoint TLS certificate or local trust store)"}
	}
	if strings.Contains(message, "connection refused") || strings.Contains(message, "no such host") {
		message += " (endpoint unreachable: is the server running and the base URL correct?)"
	}
	return &CallError{Class: ClassTransient, Message: message}
}
```

背景事实（改写者可用，读者不可见）：`CallError` 会被熔断器 `Circuit` 计为一次 provider 失败，连续失败达到阈值后熔断器进入退避期，暂停向该 provider 发请求；调用方取消时返回的是原生 ctx 错误而不是 `CallError`，因此不计入。

## 反例一：原始版（内部代号充当事实）

```go
// ClassifyTransportError 分类传输层错误：调用方取消原样返回（不计 provider
// 失败，暗坑 K26）；单次尝试超时与连接失败为 transient，并附可行动提示（K33）。
```

错在哪：K26、K33 是私有台账编号，仓库读者打不开；"为 transient"把常量 `ClassTransient` 写成英文形容词；"可行动提示"是抽象名词，没说提示了什么；证书分支和"其他错误"分支根本没提。

## 反例二：第二轮版（事实加尾注，看似自包含实则仍在引用）

```go
// ClassifyTransportError 分类传输层错误：调用方取消原样返回——取消不是
// 上游故障，计入会把健康的 provider 误送进退避（暗坑台账 K26）；单次
// 尝试超时与连接失败为 transient，并附可行动提示（暗坑台账 K33）。
```

错在哪：代号只是加了"台账"两个字，仍是外部引用；"计入""退避"没有解释；三件事挤在破折号和分号串成的一句里，句子骨架照抄原文；证书分支仍然缺失。这是"换词不换结构"的典型。

## 正例：第三轮版（验收通过）

```go
// ClassifyTransportError 把一次 HTTP 传输失败归类，供重试和熔断（连续失败
// 后暂停向 provider 发请求）逻辑决定下一步：
//
//   - 调用方自己取消了请求（callerCtx 已结束）：原样返回 ctx 的取消错误，
//     不包装成 CallError。原因：取消不是 provider 故障；如果算作一次失败，
//     熔断器会把一个健康的 provider 判成故障并暂停向它发请求。
//   - 单次尝试超时（attemptCtx 已结束）：归为 ClassTransient（可重试），
//     错误文本末尾附上"调大 EnvProviderTimeout"的提示。
//   - 证书验证失败（x509 各类错误，或消息含 "x509:"）：归为 ClassPermanent，
//     错误文本提示检查端点证书或本机信任库。证书错误重试不会成功；如果
//     归为可重试，调用方要等完全部重试和退避（重试之间的等待）才能看到
//     真正原因。
//   - 连接被拒绝、主机不存在：归为 ClassTransient，错误文本附上"检查服务
//     是否在运行、base URL 是否正确"的提示。
//   - 其他传输错误：归为 ClassTransient。
```

对在哪：每个分支一条，写了行为和理由；熔断、退避在首次出现处半句解释；常量写原名；没有任何外部引用。

## 复述测试（验收方法）

另一个全新会话只读"函数代码 + 待测注释"，不读本夹具其余内容，回答：

1. 调用方取消的请求怎么处理？为什么不算一次 provider 失败？
2. 证书验证失败归哪一类？为什么不重试？
3. 超时和连接失败的错误文本各附了什么提示？

## 判定要点

- 三题的行为与理由都答对，且理由只能来自注释（代码里没有"为什么"）；
- 输出不含内部代号、日期化引用、台账用词；常量写 `ClassTransient`/`ClassPermanent` 原名；
- 每个分支都有对应条目；熔断、退避等项目术语首次出现时有解释；
- 未改动函数代码本身。
