# AI 客服训练

面向宠物食品客服新人的 Web 培训应用。MVP 将提供知识小测与文字情景实战，
帮助新人先学习固定知识，再在不接触真实顾客的情况下练习接待。

## 当前进度

项目按 [Roadmap](docs/ROADMAP.md) 分 Part 交付。当前版本已经建立 Next.js
工程基线、简洁的双入口首页、版本化本地知识编译器、PostgreSQL数据模型和临时
账号认证，并已进入知识小测闭环开发。

## 本地运行

要求 Node.js 20.9 或更高版本，并使用 pnpm。

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
```

也可以一次运行全部质量门禁：

```bash
pnpm check
```

## 数据库与测试账号

复制 `.env.example` 为不进入 Git 的 `.env.local`，填写 Neon 连接串、
`AUTH_SECRET` 以及管理员和学员的测试密码，然后运行：

```bash
pnpm db:migrate
pnpm db:seed
```

迁移采用代码优先方式保存在 `drizzle/`。预置账号不开放注册，真实密码不会写入
仓库。当前Credentials登录仅用于MVP开发和试用；后续接入飞书账号时替换认证
Provider与用户映射层，不引入Supabase，现有角色和训练数据模型继续复用。

Neon尚未配置时，可以在不进入Git的 `.env.local` 中显式设置
`LOCAL_TEST_AUTH_ENABLED=true`，并填写 `SEED_ADMIN_*` 与
`SEED_LEARNER_*`。该回退只在非生产环境且没有 `DATABASE_URL` 时生效；生产环境
或数据库已配置时会自动停用。

## 知识编译

真实知识源保留在本地 `TOC售前客服知识库` 文件夹中。检查源文件覆盖情况：

```bash
pnpm knowledge:check
```

门禁通过后，可生成不进入 Git 的不可变本地知识包和覆盖报告：

```bash
pnpm knowledge:publish
```

Neon迁移和账号种子完成后，可以把同一知识版本以事务方式发布到数据库：

```bash
pnpm knowledge:publish:db
```

## 小测草稿

知识包发布后，可从有效、无冲突且适合出题的知识单元生成40道本地小测草稿：

```bash
pnpm quiz:build
pnpm quiz:publish:db
```

该命令默认生成20道单选题和20道判断题，绑定知识版本、知识单元和来源定位。产物
保存在不进入Git的 `artifacts/quiz`，状态固定为 `draft`；管理员审核前不会作为
正式培训题发布。`quiz:publish:db` 只接受恰好40题、当前活动知识版本中无冲突且
允许出题的知识单元；相同草稿Hash可安全重复执行，不会重复写入。本地测试账号
模式下，管理员可从 `/admin/questions` 逐题编辑与审核；40题全部通过后才能发布
不可变正式题组。学员端在发布前提供5道明确标识的交互演示题，发布后每组从正式
题库选取10题，并平衡单选题和判断题。

正式小测完成后，服务端会基于发布题库重新判分，并按当前账号保存结果。学员可在
`/practice/history` 查看自己的练习记录；本地测试记录保存在不进入Git的
`artifacts/quiz`，后续可在不改变页面接口的前提下替换为企业正式存储。

## Mock情景实战

学员可从 `/practice/scenario` 进入8个固定场景，覆盖售前、物流、破损少货和客诉。
当前使用确定性 `MockConversationProvider` 与 `MockEvaluationProvider`，支持连续
文字对话、分块显示顾客回复、刷新恢复、最大12轮、五维演示评分、关键风险判定和
原场景重练。

数据库迁移、账号种子和知识版本发布完成后，可将8个固定场景及其完整来源、评分
维度和风险规则幂等发布到数据库：

```bash
pnpm scenario:publish:db
```

发布器要求每个来源定位都能命中当前活动知识版本，且对应知识不得存在冲突或被
禁止用于场景；相同场景版本键如果出现不同内容会拒绝覆盖。

所有页面和报告均明确标识“演示模式”或“演示评分”，不把Mock结果计入真实AI可信度
验收。会话保存在不进入Git的 `artifacts/scenario`；未来接入真实模型和企业存储时，
替换Provider与服务适配层即可，页面流程和会话契约保持不变。

## 资料边界

原始客服知识库、会议记录、环境变量和本地生成报告均不进入 Git。知识编译器会从
本地源文件生成可审计的规范化知识，再把通过门禁的版本发布到 Neon。
