# 阶段 4：AI 实战与训练记录验收报告

日期：2026-08-06

状态：已完成

## 验收范围

本阶段将旧系统的场景目录、场景版本、训练会话、多轮消息、实时风险、报告和历史记录迁移到 Vue 3/FastAPI/SQLAlchemy。正式 Provider 使用 Ark 适配协议，自动化测试和本地开发使用显式确定性 Mock；Ark 上游失败保留会话和消息并返回可重试错误，不静默伪造结果。

## 结果总览

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 后端领域、Repository、API、Provider、迁移 | 通过 | `cd backend && .venv/bin/python -m pytest -q`：**82 passed** |
| Vue API、Pinia、路由、组件和页面 | 通过 | `npm --prefix frontend test`：**20 files / 35 tests passed** |
| Vue production build | 通过 | `npm --prefix frontend run build`：Vite build 成功 |
| 旧 Next.js 回归 | 通过 | `node_modules/.bin/vitest run --reporter=dot`：**79 files / 232 tests passed** |
| 根项目代码质量 | 通过 | `node_modules/.bin/eslint .` 无错误/警告；`node_modules/.bin/next typegen && node_modules/.bin/tsc --noEmit` 通过 |
| Drizzle schema check | 通过 | `node_modules/.bin/drizzle-kit check` 输出 `Everything's fine` |
| 旧 Next.js production build | 通过 | `node_modules/.bin/next build` 成功 |
| 公司技术栈浏览器验收 | 通过 | `npm run test:e2e:company-stack`：**4 passed**，含 Phase 3 3 项和 Phase 4 1 项 |

## Phase 4 功能对照

- 场景目录、场景版本和训练会话：六类 SQLAlchemy 记录模型、Alembic `20260806phase4`、八个规范化场景导出和来源门禁已交付。
- 多轮消息、会话恢复和实时风险：消息位置在会话内唯一，服务端按用户隔离；刷新页面后从服务端恢复，风险 Provider 失败不阻断对话。
- Ark Provider：顾客回复流、风险识别、评测三项协议已定义；Ark 超时、限流/不可用、空响应和非法 JSON 均映射为稳定错误码；生产配置缺失不会回退 Mock。
- 报告、SSE、重试和复核数据：报告流按 `analyzing` → `scoring` → `saving` → `report` 发送；报告一会话唯一，重复完成/重试返回同一报告；`ReviewDecision` 模型保留复核关系。
- Vue 时间线：状态筛选、同场景 `<details>` 折叠、最新会话继续/查看报告、组内游标分页和 320px 移动布局已交付。

## 数据迁移演练

命令流程：

```text
APP_ENV=test DATABASE_URL=sqlite+pysqlite:///one.db alembic upgrade head
APP_ENV=test DATABASE_URL=sqlite+pysqlite:///one.db python scripts/seed_phase3_e2e.py
APP_ENV=test DATABASE_URL=sqlite+pysqlite:///one.db python scripts/migrate_phase4.py tests/fixtures/phase4-export.json --report report.json
```

两次独立临时 SQLite 数据库均得到：

```json
{
  "scenario_versions": 8,
  "scenarios": 8,
  "source_locators_checked": 8,
  "source_hash": "ef725b919d6f563238f8e892f3b749c13576c0a0de2ba1d0544f2f63e3cb7812",
  "target_hash": "ef725b919d6f563238f8e892f3b749c13576c0a0de2ba1d0544f2f63e3cb7812"
}
```

两份报告文件逐字节一致，报告 SHA-256 为 `f4f3d94bb2d71a30603840771f571113fd7a97aeb96cc1d06018b4c12826d512`。导出自检 `backend/.venv/bin/python scripts/export_phase4_data.py --output tests/fixtures/phase4-export.json --check` 通过。

## 浏览器纵向验收

新增 `tests/e2e/company-stack-phase4.spec.ts` 覆盖：测试登录 → 场景目录 → 启动物流场景 → 发送三轮回复 → 触发风险提示 → 刷新恢复消息 → SSE 生成报告 → 已完成报告幂等重试 → 历史筛选/展开。与既有公司栈基础测试合计 **4/4 passed**。

## 环境说明

仓库 `pnpm check` 包装命令在当前运行环境会先执行 pnpm install，并因 `ignored build scripts` 安全策略终止；这不是代码或测试失败。为避免改变依赖授权状态，已运行并通过其实际子步骤的直接二进制命令：ESLint、TypeScript、根 Vitest、Drizzle check 和 Next build。Phase 4 自身的后端、Vue 和 Playwright 命令均按仓库脚本直接通过。

## 后续边界

Phase 5 继续处理管理端、Linux/Nginx/systemd 部署、MySQL 真实环境演练、最终全量对账和生产切换。Ark 正式联调仍需公司提供模型地址、模型名、密钥和应用权限配置；在此之前测试模式保持显式 Mock。
