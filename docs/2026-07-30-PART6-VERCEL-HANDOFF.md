# Part 6 Vercel 技术 Demo 交接说明

最后更新：2026-07-30

## 交付结论

当前版本已作为技术 Demo 部署到 Vercel：

- 生产地址：<https://ai-customer-service-training.vercel.app>
- Vercel 项目：`guinsoos-projects/ai-customer-service-training`
- 部署状态：`Ready`
- 数据设施：Neon PostgreSQL（仅作为当前 Demo 临时持久化）
- AI：确定性 Mock Provider，页面必须继续明确标注演示模式

这是“可运行、可演示、可继续开发”的技术版本，不是正式培训内容版。40 道知识题仍
需要业务负责人逐题审核，真实 AI、飞书身份和企业知识引擎均未接入。

## 已完成范围

| 维度 | 当前结果 |
|---|---|
| 学员端 | 登录、训练中心、选择/判断题、情景模拟、历史记录、任务列表 |
| 管理端 | 知识状态、题目审核、场景、任务下发、完成概览、人工复核 |
| 知识 | 8 份本地源文件编译为不可变知识版本，保留来源定位和冲突门禁 |
| 题库 | 40 道草稿题；0/40 人工审核，因此没有正式发布题组 |
| 场景 | 8 个文字场景已发布，使用 Mock 对话和 Mock 五维评分 |
| 数据 | 迁移、种子账号、知识、题库草稿、场景已写入 Neon |
| 部署 | Vercel 远程安装、TypeScript、Next.js 构建和 17 个页面生成成功 |

## 架构 Review

### 可以继续沿用的根基

1. **Next.js 全栈单体适合本周 MVP。** 页面、Server Actions、Auth.js 和数据库访问在
   一个仓库内，部署和交接成本低。
2. **领域接口与设施适配已分开。** 小测、场景、任务和复核通过 Port/Repository
   交互；页面不直接读写本地 artifacts。
3. **生产组合入口集中。** `src/lib/runtime/services.ts` 决定使用 Local Store 还是
   Database Repository，后续替换企业设施不需要重写训练页面。
4. **内容采用不可变版本。** 知识、题库和场景保留稳定标识、版本哈希和来源定位，
   适合后续审计、回滚和重新发布。
5. **生产安全门禁存在。** 生产环境要求数据库和足够长度的 Auth Secret，并拒绝启用
   本地测试账号模式。

### 当前设施不是未来承诺

| 当前 Demo 实现 | 后续企业替换点 |
|---|---|
| Auth.js Credentials + Neon 用户 | 飞书免登 Provider + 企业用户映射 |
| 本地 MD/XLSX 编译 | 企业知识引擎或文件接入 Adapter |
| MockConversationProvider | 真实对话模型 Provider |
| MockEvaluationProvider | 真实评分模型 Provider + 可信度验收 |
| Neon Repository | 公司批准的 PostgreSQL/数据服务 Adapter |
| Vercel | 备案域名后的国内托管或公司基础设施 |

因此，不需要在这个阶段继续建设独立账号系统，也不需要引入 Supabase。Neon 的作用是
让在线 Demo 能保存训练和管理数据；业务模型与它没有强绑定。

## 验收证据与边界

已确认：

- Vercel Production 状态为 `Ready`；
- 远程日志显示 Next.js 编译、TypeScript 和 17/17 静态页面生成完成；
- 数据库迁移和种子脚本可重复执行；
- 真实 Neon 上知识、题库草稿和场景重复发布保持幂等；
- 技术数据门禁通过：1 个活动知识版本、40 道题、8 个已发布场景、管理员和学员账号
  均存在；
- 代码未发现已提交的数据库连接串、密码或 Vercel Token。

尚未通过或不在本次范围：

- 40 道题的人工内容审核与正式发布；
- 真实 AI 的正确性、稳定性、成本和安全验收；
- 飞书免登、企业知识引擎和公司数据设施；
- 中国大陆 `.vercel.app` 网络稳定性。当前本机遇到 DNS 错误解析和连接重置，无法把
  大陆直连作为已通过项；海外 Vercel 控制面确认应用部署成功。

## 接手人快速入口

1. 从私有仓库 `JzzzX/ai-customer-service-training` 拉取 `main`。
2. 使用 Node 24 和 pnpm 10.33：`pnpm install --frozen-lockfile`。
3. 参考 `.env.example` 配置本地环境；不要复制、提交或在群聊中发送现有密钥。
4. 本地验证：`pnpm check`。
5. Demo 数据初始化顺序：
   `pnpm db:migrate` → `pnpm db:seed` → `pnpm knowledge:publish:db` →
   `pnpm quiz:publish:db` → `pnpm scenario:publish:db` →
   `pnpm production:verify:data`。
6. Vercel 已关联项目；后续在 `main` 上的稳定提交可继续触发生产部署。正式切换企业
   设施前，先保留现有 Port/Repository 接口，再替换 Adapter。

## 后续优先级

1. 业务负责人完成 40/40 审题并发布正式题组。
2. 接入飞书身份，建立飞书用户与内部 `userId/role` 的映射。
3. 以 Adapter 方式验证企业知识引擎；失败时继续保留当前离线编译兜底。
4. 接入真实 AI Provider，建立固定场景集、人工金标、关键风险零容忍和成本门禁。
5. 确定备案域名与国内部署方案后，再做大陆网络正式验收。
