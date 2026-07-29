# AI 客服训练

面向宠物食品客服新人的 Web 培训应用。MVP 将提供知识小测与文字情景实战，
帮助新人先学习固定知识，再在不接触真实顾客的情况下练习接待。

## 当前进度

项目按 [Roadmap](docs/ROADMAP.md) 分 Part 交付。当前版本已经建立 Next.js
工程基线、简洁的双入口首页、版本化本地知识编译器、PostgreSQL数据模型和预置
账号认证；训练闭环和部署将在后续 Part 完成。

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
仓库。

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

## 资料边界

原始客服知识库、会议记录、环境变量和本地生成报告均不进入 Git。知识编译器会从
本地源文件生成可审计的规范化知识；Part 3 再把通过门禁的版本发布到 Neon。
