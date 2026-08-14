# AI 客服训练 MVP 技术交接

最后更新：2026-08-14

## 这份文档解决什么问题

本文只记录当前项目的真实状态、已验证范围、尚未解决的问题和接手时必须注意的事项，不替接手团队决定具体部署平台或后续产品方案。

项目面向新人客服短期培训，当前已经完成学员自助训练的主要闭环，可以演示，也具备继续做真实环境验证的基础。它仍是 MVP，不是包含主管运营、组织权限和长期数据治理的完整培训平台。

## 当前代码基线

当前运行入口是仓库根目录的 Next.js 应用：

```text
Next.js 16 + React 19 + TypeScript
Auth.js 飞书 OAuth + JWT Session
Drizzle ORM + SQLite
OpenAI 兼容 AI Provider + Mock Provider
Vitest + Playwright
```

开发和启动命令以根目录 [`package.json`](package.json) 为准。

以下目录不是当前运行入口：

- `backend/`：此前 FastAPI 迁移代码；
- `frontend/`：此前 Vue/Vite 迁移代码；
- `deploy/nextjs/`：当前根 Next.js 的 systemd、Nginx 和环境模板；
- `deploy/` 根目录中的 systemd/Nginx：此前迁移路线的历史样例。

历史目录仍保留在仓库中，容易让接手人误判当前技术栈。当前部署只使用 `deploy/nextjs/` 和 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)。

## 当前已经完成的能力

- 飞书 OAuth 登录，正式环境只开放飞书登录，演示模式保留演示入口；
- 有效学员导入、停用账号和飞书身份绑定；
- 专题练习、正式题和服务端判分；
- 答题结果按学员保存；
- AI 或 Mock 情景对话；
- 对话刷新恢复、风险提示和评分报告；
- 学员查看自己的答题与情景历史；
- 知识、题组和场景的版本化发布；
- SQLite Schema、完整性和外键启动检查；
- SQLite 手工备份命令；
- 单元、组件、Repository、浏览器和并发测试。

当前只有学员端。没有网页管理后台、主管任务分配、团队统计和人工复核页面。账号和内容均由技术人员通过 `scripts/` 和 `package.json` 中的 CLI 命令维护。

## 各运行环境的真实状态

### 本地开发环境

- 文件 SQLite 和内存演示 SQLite 均可运行；
- Mock AI 可用；
- 用户确认公司 OpenAI 兼容网关在 `localhost` 可用；
- 本轮交接没有重新运行真实 AI E2E，没有产生公司模型调用。

### 当前 Vercel 环境

地址：<https://ai-customer-service-training.vercel.app/login>

当前配置为：

```text
DEMO_MODE=true
SCENARIO_AI_MODE=mock
```

因此该环境的实际含义是：

- 登录页提供固定“演示学员”入口；
- 数据保存在当前函数实例的内存 SQLite 中；
- 冷启动、实例切换或重新部署后数据会重置；
- AI 回复和评分来自 Mock Provider；
- 它只能证明页面和流程可演示，不能证明正式数据持久化或真实 AI 可用。

此前实测中，Vercel `hkg1` 函数访问公司 AI 网关会超时。本地可以访问而 Vercel 不可以，现有证据指向部署环境无法进入公司网络或 VPN 路径，不是前端对话代码缺失。

### 正式学员环境

当前公司内网正式学员环境已经部署并完成基础验收：

- 访问入口：`http://10.100.22.118:35769`；
- Nginx `35769` 反向代理至根 Next.js 应用 `127.0.0.1:3001`；
- 运行环境使用 Node.js 24.x；
- `DEMO_MODE=false`，生产认证只开放飞书 OAuth；
- `SQLITE_PATH` 指向服务器持久文件 SQLite；
- 当前 SQLite 方案仍要求单个应用实例；
- 当前正式库已包含有效学员、活动知识、正式题库和 8 个已发布情景；
- 环境变量、数据库和备份文件均不进入 Git；
- 仓库已提供根 Next.js 专用 systemd/Nginx 模板；服务器是否已从 `nohup` 切换仍须现场确认。

生产环境仍需继续完善进程守护、自动备份、恢复演练、监控告警以及真实 AI 网络与质量验收。

## 已验证结果

### 自动化验证

- `pnpm check`
  - ESLint 通过；
  - TypeScript 通过；
  - Vitest：64 个文件、191 个测试通过；
  - Drizzle migration check 通过；
  - Next.js production build 通过。
- `pnpm test:e2e`
  - 3 个 Mock 浏览器测试通过；
  - 覆盖正常登录、停用账号、跨学员隔离、三轮情景、刷新恢复和报告生成。
- `pnpm e2e:prepare && pnpm test:sqlite:concurrency`
  - 30 workers、1500 条短时并发写入通过；
  - 无锁失败、重复记录或外键损坏。

### 这些结果不能证明什么

- 没有证明目标部署环境可以访问真实 AI；
- 没有证明 Vercel 可以保存正式 SQLite 数据；
- 没有做长时间混合业务压力测试；
- 没有完成自动备份和恢复演练；
- 已在当前公司内网正式环境验证飞书 OAuth 登录、回调和账号绑定；
- 没有验证主管、组织权限或管理后台，因为当前版本没有这些能力。

本轮验证机器是 Node.js 26.6.0，而 [`package.json`](package.json) 声明 Node.js 24.x。测试和构建虽然通过，接手团队仍需要在实际 Node.js 24 运行环境复验。

## 当前已知问题

### 1. 正式数据已经落地，自动化运维仍待完善

当前公司内网正式环境已经使用持久文件 SQLite。基础数据已经迁移并完成完整性检查，当前包含有效学员、活动知识、5 个正式题组、350 道题以及 8 个已发布情景。

基础数据导入工具只迁移有效学员、活动知识、正式题组和已发布场景，不迁移历史答题、对话和报告，因此仍不能把基础数据导入理解为完整历史迁移。当前已经具备手工 SQLite 备份能力，但自动备份、保留周期和恢复演练仍需完善。

### 2. 真实 AI 只在本地网络路径确认可用

代码支持 `SCENARIO_AI_MODE=real`，但 Vercel 到公司网关的请求仍会超时。目标部署环境的网络、凭据、模型名、超时和调用额度尚未验收。

Mock 对话和 Mock 报告只能用于开发、演示和流程验证，不能作为真实 AI 质量或员工成绩的依据。

### 3. 当前认证为飞书 OAuth + JWT Session

- 正式环境只开放飞书 OAuth，不再提供邮箱密码登录；
- `DEMO_MODE=true` 时才允许演示 Credentials Provider；
- 已有学员通过飞书身份表与业务账号绑定；
- 停用账号不能通过飞书重新登录；
- Session 使用 JWT，账号停用不会自动撤销已经签发的 Session；
- 当前没有管理员和主管角色；
- 尚未实现专门的登录频率限制、连续失败锁定和组织权限同步。

### 4. 飞书 OAuth 已实现

当前根 Next.js 应用已经实现：

- 飞书 OAuth Provider 和回调；
- 独立的飞书身份绑定表；
- 以 `union_id` 为主要稳定身份，保留并更新 `open_id`；
- 已绑定身份再次登录时不依赖邮箱；
- 未绑定身份首次登录时可通过已有学员邮箱完成绑定；
- 正式环境移除邮箱密码 Credentials Provider；
- 演示 Credentials Provider 只在 `DEMO_MODE=true` 时启用；
- 停用业务账号不能通过飞书重新进入系统。

当前尚未实现飞书组织、部门、主管等组织架构同步，也没有完整的主管和管理员权限体系。

`users.passwordHash` 仍保留用于历史 Schema / 数据兼容，但正式生产登录不再使用用户密码。

App Secret、OAuth token 和 `AUTH_SECRET` 必须只保存在服务端环境中，不能提交到 Git。飞书应用可见范围只控制入口可见性，不等于项目内部业务授权。生产 App Secret 应按公司凭证管理要求定期轮换。

### 5. 依赖安全告警尚未处理

最近一次 `pnpm audit --prod --audit-level moderate` 报告 7 个 high、3 个 moderate 告警，主要来自 Next 的 `sharp`、`postcss` 传递依赖和 Excel 处理依赖链。

当前没有在本次交接中升级这些依赖，也没有形成正式安全豁免。接手团队需要根据实际网络暴露范围、输入来源和部署周期决定处理方式。

### 6. 运维能力已补齐代码侧基线，服务器切换仍待现场执行

- 账号和内容通过 CLI 维护；
- 备份命令已存在，但没有定时任务；
- 开始训练失败会返回关联 ID，并记录不含凭据、提示词和学员消息的结构化日志；
- 已提供 `/api/health`、`/api/ready`、systemd/journald 和 Nginx 模板；
- 已提供 `pnpm ai:verify`，可在目标服务器用最小非业务提示预检公司网关；
- systemd 替换现有 `nohup`、监控和告警仍需服务器管理员执行并验收；
- 没有自动恢复流程；
- SQLite 并发验证是约 3 秒的短时烟测，不是长期容量证明。

### 7. 历史代码仍可能干扰判断

- `backend/`、`frontend/` 和 `deploy/` 根目录旧配置不是当前运行入口；当前运维入口是 `deploy/nextjs/`；
- 旧 Neon、Vue/FastAPI 迁移、验收和过程设计文档已从当前工作树移除，需要时只能从 Git 历史追溯；
- 当前架构和开发入口以 [`README.md`](README.md)、本文件、根 `package.json` 和 `src/` 为准。

## 交接时不要误判

| 容易误判的情况 | 实际情况 |
|---|---|
| Vercel 页面能打开 | 只证明内存 Mock 演示可用，不代表正式数据和真实 AI 可用 |
| Mock E2E 全部通过 | 不代表公司 AI 网关已经打通 |
| 本地真实 AI 可用 | 不代表目标服务器也有同样的公司网络路径 |
| 仓库里存在 FastAPI/Vue | 它们是历史迁移代码，不是当前应用入口 |
| `DEMO_MODE=true` 可以免登录 | 只能用于演示，不能带入正式学员环境 |
| SQLite 并发烟测通过 | 只证明当前短时测试没有立即出现锁和数据错误 |
| 飞书应用设置了可见范围 | 只控制入口可见性，不替代项目内部账号和权限 |
| 基础数据导入成功 | 不代表历史答题、对话和报告已经迁移 |

## 接手检查清单

### 仓库与代码

- [ ] 确认当前分支和需要接手的提交；
- [ ] 从根目录 `package.json` 启动和构建；
- [ ] 不把 `backend/`、`frontend/` 和 `deploy/` 根目录旧配置当作当前入口；
- [ ] 确认 `next-env.d.ts` 等自动生成文件没有被手工修改或误提交；
- [ ] 先阅读 [`README.md`](README.md) 的架构、代码导航和运行模式。

### 环境与数据

- [ ] 确认实际 Node.js 和 pnpm 版本；
- [ ] 确认 `DEMO_MODE`、`SQLITE_PATH`、`AUTH_SECRET` 和 `SCENARIO_AI_MODE`；
- [ ] 确认 SQLite 文件是否持久、可写，且不会被多个应用实例共享；
- [ ] 确认当前数据库是否已经执行最新 migration；
- [ ] 确认正式账号、知识、题组和场景的数据来源；
- [ ] 确认备份位置、保留周期、恢复方式和负责人。

### AI

- [ ] 确认目标运行环境能访问公司 AI 网关；
- [ ] 在服务器执行 `pnpm ai:verify`，确认安全预检通过；
- [ ] 确认网关凭据、Base URL、模型名、超时和额度；
- [ ] 区分 Mock 验收与真实 AI 验收；
- [ ] 真实 AI 至少检查多轮对话、刷新恢复、报告生成和错误脱敏；
- [ ] 确认训练内容和学员输入是否允许发送到网关及其日志留存要求。

### 飞书 OAuth

- [x] 飞书 Provider、OAuth 回调和身份绑定已经实现；
- [x] 已确定稳定身份和现有账号绑定规则；
- [x] 正式环境只开放飞书登录，演示 Credentials 仅限 Demo 模式；
- [ ] 完善离职、停用账号后的已签发 Session 撤销策略；
- [ ] 根据业务需要决定是否同步组织、部门和主管数据；
- [ ] 完成 App Secret 的长期托管与轮换机制；
- [ ] 不把应用可见范围当作项目内部权限。

### 验证与风险

- [ ] 在实际 Node.js 24 环境执行 `pnpm check`；
- [ ] 执行 Mock E2E 并确认使用隔离测试数据库；
- [ ] 如获授权，再执行真实 AI 冒烟；
- [ ] 评估依赖安全告警；
- [ ] 记录仍未完成的验证项，不用本地或 Mock 结果代替正式验收。

## 主要入口

| 关注内容 | 文件或目录 |
|---|---|
| 架构、技术栈、开发导航 | `README.md` |
| 当前部署与交接边界 | `handoff.md`、`docs/DEPLOYMENT.md` |
| 启动和验证命令 | `package.json` |
| 环境变量 | `.env.example`、`src/lib/runtime/env.ts` |
| 登录和 Session | `src/auth.ts`、`src/lib/auth/` |
| SQLite Schema 和 Repository | `src/db/schema.ts`、`src/db/repositories/` |
| 题库与判分 | `src/lib/quiz/`、`src/app/practice/quiz/` |
| AI 对话与报告 | `src/lib/scenario/`、`src/app/practice/scenario/` |
| 账号和内容维护 | `scripts/` |
| 自动化测试 | `src/**/*.test.*`、`tests/e2e/`、`tests/load/` |
