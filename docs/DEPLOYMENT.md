# Vercel + Neon 部署与运维

## 部署组成

- Web：Vercel Production
- 数据库：Neon PostgreSQL
- 认证：Auth.js Credentials（MVP 临时入口）
- AI：Vercel AI Gateway 或 OpenAI 兼容接口
- 本地要求：Node.js 24、pnpm 10.33

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
SCENARIO_AI_MODE=real
AI_GATEWAY_ENABLED=true
AI_GATEWAY_MODEL=bytedance/seed-1.8
```

使用公司 OpenAI 兼容网关时，将 `AI_GATEWAY_ENABLED` 设为 `false`，并配置：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

Vercel AI Gateway 当前要求项目账户具备可用账单配置；未配置时真实 AI 请求会返回 403，不能将该状态误判为应用已通过 AI 验收。

## 空数据库初始化

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

正式题完成审核后，再运行：

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

- `403 AI Gateway ... credit card`：检查 Vercel AI 账单配置，再重新部署和运行 `pnpm test:e2e:live`。
- AI 服务失败：页面应展示通用中文提示，不展示网关、密钥、URL 或内部错误细节。
- 题库为空：先确认活动知识版本和 `quiz:publish:db` 是否完成，再检查正式题审核状态。
- 生产数据异常：先运行 `pnpm production:verify:data`，不要直接修改数据库中的版本指针。

## 回滚原则

优先在 Vercel 控制台将 Production 切回上一个 Ready 部署；Neon 迁移和版本发布均为不可变/幂等流程，禁止通过删除历史数据回滚。
