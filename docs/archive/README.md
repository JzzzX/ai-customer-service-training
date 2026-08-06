# 历史迁移资料归档

本目录只用于审计、决策追溯和旧阶段验收取证，**不是当前运行、部署或验收说明**。

当前权威入口：

- [项目 README](../../README.md)
- [开发交接说明](../AGENT-HANDOFF.md)
- [统一验收标准](../ACCEPTANCE.md)
- [Roadmap](../ROADMAP.md)
- [部署与切换说明](../DEPLOYMENT.md)

## 归档结构

| 目录 | 内容 | 数量 |
| --- | --- | ---: |
| `legacy-migration/plans/` | Phase 1–5 与相关切片的历史实施计划 | 7 |
| `legacy-migration/reports/` | Phase 4–6 的原始阶段验收报告 | 3 |
| `legacy-migration/specs/` | 场景解耦与公司技术栈迁移前设计 | 2 |

归档文件保留当时的范围、命令、路径和技术语境，其中可能出现已经退役的 Next.js、React、Drizzle、Neon、Vercel、TypeScript 或旧目录名；这些内容仅描述历史，不应作为 `main` 的实现依据。

Phase 6 原始报告中的当前有效结论已经合并到 [统一验收标准](../ACCEPTANCE.md)。后续状态只更新活跃文档，不改写历史证据；如需恢复旧源码，应从双远程标签 `legacy-next-final-bb8d164` 检出到隔离目录，不重新合并回 `main`。
