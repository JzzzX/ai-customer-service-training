# AI 客服训练

面向宠物食品客服新人的 Web 培训应用。MVP 将提供知识小测与文字情景实战，
帮助新人先学习固定知识，再在不接触真实顾客的情况下练习接待。

## 当前进度

项目按 [Roadmap](docs/ROADMAP.md) 分 Part 交付。当前版本已经建立 Next.js
工程基线和简洁的双入口首页；知识编译、训练闭环和部署将在后续 Part 完成。

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
pnpm build
```

## 资料边界

原始客服知识库、会议记录、环境变量和本地生成报告均不进入 Git。后续知识编译器
会从本地源文件生成可审计的规范化知识，并直接发布到 Neon 数据库。
