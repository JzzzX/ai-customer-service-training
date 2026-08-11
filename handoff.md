# AI 客服训练 MVP 技术交接

最后更新：2026-08-11

## 这份文档解决什么问题

本文只记录当前项目的真实状态、已验证范围、尚未解决的问题和接手时必须注意的事项，不替接手团队决定具体部署平台或后续产品方案。

项目面向新人客服短期培训，当前已经完成学员自助训练的主要闭环，可以演示，也具备继续做真实环境验证的基础。它仍是 MVP，不是包含主管运营、组织权限和长期数据治理的完整培训平台。

## 当前代码基线

当前运行入口是仓库根目录的 Next.js 应用：

```text
Next.js 16 + React 19 + TypeScript
Auth.js Credentials + JWT Session
Drizzle ORM + SQLite
OpenAI 兼容 AI Provider + Mock Provider
Vitest + Playwright
```

开发和启动命令以根目录 [`package.json`](package.json) 为准。

以下目录不是当前运行入口：

- `backend/`：此前 FastAPI 迁移代码；
- `frontend/`：此前 Vue/Vite 迁移代码；
- `deploy/`：此前迁移路线的部署样例。

这些历史目录仍保留在仓库中，容易让接手人误判当前技术栈。不要使用其中的启动、数据库或部署说明操作当前根 Next.js 应用。

## 当前已经完成的能力

- 邮箱密码登录；
- 批量导入、停用账号和重置密码；
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

目前没有已完成验收的正式学员环境。代码对正式运行的硬约束是：

- `DEMO_MODE` 必须关闭；
- `SQLITE_PATH` 必须指向持久、可写的文件；
- 当前 SQLite 方案要求单个应用实例；
- `AUTH_SECRET` 至少 32 位；
- 真实 AI 必须从实际运行环境访问公司网关；
- 环境变量、数据库和备份文件不能进入 Git。

具体部署平台、域名、HTTPS、进程守护、备份位置和网络接入方式尚未由本项目确定。

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
- 没有验证飞书 OAuth；
- 没有验证主管、组织权限或管理后台，因为当前版本没有这些能力。

本轮验证机器是 Node.js 26.6.0，而 [`package.json`](package.json) 声明 Node.js 24.x。测试和构建虽然通过，接手团队仍需要在实际 Node.js 24 运行环境复验。

## 当前已知问题

### 1. 正式数据尚未落地

当前 Vercel 使用内存 SQLite，数据会重置。仓库已经支持持久文件 SQLite、migration、数据校验和备份命令，但正式数据文件、备份位置、保留周期、恢复责任人和恢复演练都尚未确定。

Neon 到 SQLite 的导入工具只迁移有效学员、活动知识、正式题组和已发布场景，不迁移历史答题、对话和报告。不能把基础数据导入理解为完整历史迁移。

### 2. 真实 AI 只在本地网络路径确认可用

代码支持 `SCENARIO_AI_MODE=real`，但 Vercel 到公司网关的请求仍会超时。目标部署环境的网络、凭据、模型名、超时和调用额度尚未验收。

Mock 对话和 Mock 报告只能用于开发、演示和流程验证，不能作为真实 AI 质量或员工成绩的依据。

### 3. 当前认证是轻量实现

- 只有邮箱密码登录，没有飞书 OAuth；
- 没有专门的登录频率限制或连续失败锁定；
- 密码使用 bcrypt cost 12；
- 停用账号不能重新登录；
- Session 使用 JWT，账号停用或改密不会立即撤销已经签发的 Session；
- 当前没有管理员和主管角色。

### 4. 飞书 OAuth 尚未实现

当前代码中没有飞书 Provider、OAuth 回调、身份绑定表或组织同步逻辑。

接入前需要由接手团队明确：

- 使用 `open_id`、`union_id`、`user_id` 还是公司统一 SSO subject 作为稳定身份；
- 是否继续保留邮箱密码登录；
- 首次登录如何绑定已有学员；
- 换邮箱、重复身份、离职和停用如何处理；
- 是否需要部门、主管或其他组织信息；
- 飞书应用可见范围与项目内部权限如何分工。

当前 `users.passwordHash` 为必填，用户通过 email 唯一识别。直接把飞书邮箱当永久身份键会留下换邮箱和重复绑定问题；如果接飞书，需要先调整用户与登录身份的数据模型。

App Secret、OAuth token 和 `AUTH_SECRET` 必须保存在服务端环境中。飞书应用可见范围只控制谁能看到入口，不等于项目已经完成业务授权。

### 5. 依赖安全告警尚未处理

最近一次 `pnpm audit --prod --audit-level moderate` 报告 7 个 high、3 个 moderate 告警，主要来自 Next 的 `sharp`、`postcss` 传递依赖和 Excel 处理依赖链。

当前没有在本次交接中升级这些依赖，也没有形成正式安全豁免。接手团队需要根据实际网络暴露范围、输入来源和部署周期决定处理方式。

### 6. 运维能力仍是手工级别

- 账号和内容通过 CLI 维护；
- 备份命令已存在，但没有定时任务；
- 运行时错误只有基础结构化 `console.error`；
- 没有正式健康/就绪接口、集中日志、监控或告警；
- 没有自动恢复流程；
- SQLite 并发验证是约 3 秒的短时烟测，不是长期容量证明。

### 7. 文档和历史代码存在干扰

- `docs/MVP-ACCEPTANCE.md` 仍包含旧 Neon、管理员版本和历史 Vercel 验收内容，不能作为当前 SQLite MVP 的依据；
- `docs/PROJECT_TECH_STACK.md` 主要记录历史公司技术栈迁移背景；
- `backend/`、`frontend/`、`deploy/` 不是当前运行入口；
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
- [ ] 不把 `backend/`、`frontend/`、`deploy/` 当作当前入口；
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
- [ ] 确认网关凭据、Base URL、模型名、超时和额度；
- [ ] 区分 Mock 验收与真实 AI 验收；
- [ ] 真实 AI 至少检查多轮对话、刷新恢复、报告生成和错误脱敏；
- [ ] 确认训练内容和学员输入是否允许发送到网关及其日志留存要求。

### 飞书 OAuth

- [ ] 确认飞书应用类型、租户范围和回调域名；
- [ ] 确认稳定用户标识和现有账号绑定规则；
- [ ] 确认离职、停用、换邮箱和重复绑定处理；
- [ ] 确认是否需要组织、部门或主管数据；
- [ ] 确认 App Secret 和 token 的托管位置；
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
