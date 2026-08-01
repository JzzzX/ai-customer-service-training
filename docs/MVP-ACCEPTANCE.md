# MVP 验收矩阵

最后更新：2026-08-01

## 结论

### Web MVP：题库已可自动发布，线上真实 AI 待模型服务配置

本地代码、数据库、UI、权限、题库和 Mock 情景闭环已通过自动化验证。Vercel Production 登录与页面可达，但真实 AI 请求返回：

`403 AI Gateway requires a valid credit card on file to service requests.`

该问题属于 Vercel AI Gateway 账户配置，不是应用代码或 SSE 流式报告实现错误。Vercel 免费版足够承载 Web；要完成线上真实 AI，还需要 Gateway 账单或一个可用的外部 OpenAI 兼容模型服务。

### 正式培训内容版：题库技术门禁已达标

40 道可追溯题已取消人工审核阻塞，改为通过知识版本、数量、来源和冲突校验后自动发布；管理员逐题复核保留为可选质量工具。350 道专题练习题可用于日常训练。

## 三项重点任务

| 验收项 | 验收口径 | 当前证据 | 结论 |
|---|---|---|---|
| 现代化前端 UI 重构 | 学员端、管理端、登录、测验、场景、报告统一视觉；桌面与 390px 无溢出 | 共享 UI 组件、现有响应式 E2E、页面测试 | 技术达标 |
| 知识库测验题重新设置 | 5 个专题共 350 题；40 道正式题通过知识/来源门禁自动发布；10 题抽取满足题型和难度配额；服务端判分 | `question-bank.test.ts`、`select-question-group.test.ts`、题库发布测试、练习历史 E2E | 技术达标 |
| AI 模拟对话修复 | 完整上下文；回答最新客服消息；重复/空回复保护；刷新恢复；报告生成；真实 AI 线上复验 | Provider、训练服务、聊天组件测试；Mock 场景 E2E；Vercel 真实 AI 冒烟 | 代码达标，线上被模型服务配置阻塞 |

## 功能验收清单

- [x] 未登录访问学员区和管理区会被拦截。
- [x] 学员不能访问管理端。
- [x] 管理员可以进入题目审核、场景和训练记录管理页面。
- [x] 5 个专题各有足够题量，题目和知识单元标识全局唯一。
- [x] 专题练习每次抽取 10 题且不重复。
- [x] 正确答案不直接序列化到学员浏览器作为判分依据。
- [x] 练习结果按学员账号保存并可在历史记录查看。
- [x] 8 个情景可开始、发送消息、刷新恢复、结束并查看报告。
- [x] AI 模式和演示模式在页面与报告中明确标识。
- [x] AI 基础设施错误不会向学员暴露网关、密钥或账单内部信息。
- [ ] Vercel Production 完成至少 3 轮真实 AI 对话并生成 AI 评分报告。
- [x] 40 道正式题通过技术门禁并支持自动发布；人工复核不作为 MVP 阻塞项。

## 自动化验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
pnpm test:e2e
pnpm test:e2e:live
pnpm production:verify:data
pnpm production:verify:data --formal
```

其中 `pnpm test:e2e` 固定使用 Mock 模式；`pnpm test:e2e:live` 才会访问线上真实 AI 并产生少量测试会话与模型调用。生产数据命令可通过 `DOTENV_CONFIG_PATH=.env.production.local` 指定 Vercel 拉取的环境文件。

## 2026-08-01 实测记录

- `pnpm lint`、`pnpm typecheck`、`pnpm test`：通过；70 个测试文件、200 个测试通过，Drizzle 检查和 Next.js 生产构建通过。
- `pnpm test:e2e`：6 个 Mock 测试通过，1 个真实 AI 测试按条件跳过。
- Neon 正式数据校验：通过；活动知识版本 1 个、题目 40 道、正式题组 1 个、已发布场景 8 个、管理员 1 个、学员 1 个、跨版本引用 0 个，当前人工复核记录 0/40 但不阻塞 MVP。
- Neon `production:verify:data --formal`：通过；只要求存在 1 个与活动知识版本一致的正式题组。
- Vercel Production AI 冒烟：未通过；第一轮请求返回 Vercel AI Gateway 账单未配置的 403。

## 交付判定

- Web MVP：自动题库发布、权限、知识小测和 Mock 情景闭环通过后可交付试用；线上真实 AI 冒烟是完整 AI 交付的剩余条件。
- 完整 AI MVP：还需满足线上真实 AI 3 轮对话、报告生成和 `production:verify:data --formal` 通过。
