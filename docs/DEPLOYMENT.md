# Vercel + Neon 部署与运维

## 部署组成

- Web：Vercel Production
- 数据库：Neon PostgreSQL
- 认证：Auth.js Credentials（MVP 临时入口）
- AI：Vercel AI Gateway 或 OpenAI 兼容接口
- 本地要求：Node.js 24、pnpm 10.33

Vercel 免费版足够承载 Web MVP。网页托管额度与模型调用费用是两条独立链路；免费
托管不等于 AI 推理免费。

生产环境禁止使用本地文件 Store 和本地测试账号回退。训练知识、题库、场景、练习记录和报告必须来自 Neon。

## 生产环境变量

在 Vercel Production 配置以下变量，不把值提交到 Git：

```text
DATABASE_URL
AUTH_SECRET
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
SEED_LEARNER_EMAIL
SEED_LEARNER_PASSWORD
```

当前免费 Web 托管的推荐生产配置是关闭 Vercel AI Gateway，直接使用从 Vercel 函数区域
可达的外部 OpenAI 兼容接口：

```text
SCENARIO_AI_MODE=real
AI_GATEWAY_ENABLED=false
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

Vercel 免费版可以运行 Web Functions，但不能替模型服务承担网络可达性或模型费用。
当前项目的外部接口使用自定义 `35772` 端口：本机调用正常，Vercel `hkg1` 调用
在 60 秒后超时。生产接入前应提供公网 HTTPS 443 入口，或将 Vercel 函数出口加入
上游白名单。

如果改用 Vercel AI Gateway，将 `AI_GATEWAY_ENABLED` 设为 `true` 并配置
`AI_GATEWAY_MODEL`；项目账户还必须具备 Gateway 可用账单/额度，当前账户曾返回 403。

## 空数据库初始化

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

其中 `quiz:publish:db` 会在40题通过知识版本、来源和冲突校验后自动发布正式题组，
人工逐题复核不是 MVP 阻塞项。若使用从 Vercel 拉取的环境文件，可运行：

```bash
DOTENV_CONFIG_PATH=.env.production.local pnpm quiz:publish:db
DOTENV_CONFIG_PATH=.env.production.local pnpm production:verify:data --formal
```

`--formal` 现在检查正式题组是否已发布且引用活动知识版本，不再要求 40/40 人工审核：

```bash
pnpm production:verify:data --formal
```

## 验收顺序

```bash
pnpm check
pnpm test:e2e
pnpm test:e2e:live
```

线上 AI 冒烟会使用现有测试学员完成 3 轮上下文对话、刷新恢复和报告生成；它不是常规 CI 测试，不应在每次提交中自动消耗模型额度。

## 故障处理

- `403 AI Gateway ... credit card`：网页托管仍可用；关闭 Gateway 改用从 Vercel 函数区域可达的外部 OpenAI 兼容接口，或配置 Gateway 账单/额度。
- `Request timed out`：先确认 `OPENAI_BASE_URL` 的公网 HTTPS、端口和上游白名单；本项目当前自定义 `35772` 端口在 Vercel `hkg1` 超时，不能只凭本机请求成功判定生产可达。
- AI 服务失败：页面应展示通用中文提示，不展示网关、密钥、URL 或内部错误细节。
- 题库为空：先确认活动知识版本和 `DOTENV_CONFIG_PATH=.env.production.local pnpm quiz:publish:db` 是否完成。
- 生产数据异常：先运行 `pnpm production:verify:data`，不要直接修改数据库中的版本指针。

## 回滚原则

优先在 Vercel 控制台将 Production 切回上一个 Ready 部署；Neon 迁移和版本发布均为不可变/幂等流程，禁止通过删除历史数据回滚。
