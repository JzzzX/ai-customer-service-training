# Phase 6 迁移对应矩阵

> 本表是 Phase 6 的执行基准。旧系统字段只用于导出和转换；`main` 清理旧栈后，真实快照由公司 DBA 按标签 `legacy-next-final-bb8d164` 对照旧 PostgreSQL 生成。

| 旧能力/表 | 新 API/页面 | 新 MySQL 表 | 验收证据 |
| --- | --- | --- | --- |
| 用户、角色、密码哈希 | `/api/v1/auth/*`、`/profile` | `users` | 用户数量、ID、邮箱、角色一致；密码哈希不导入 |
| 飞书身份 | `/api/v1/auth/feishu/*` | `feishu_identities` | 首次 OAuth 按邮箱绑定 `union_id/open_id` |
| 知识版本、来源、知识单元 | `/api/v1/admin/knowledge`、知识发布脚本 | `knowledge_versions`, `knowledge_sources`, `knowledge_units` | 版本/来源/内容哈希一致 |
| 题组和题目 | `/api/v1/catalog/topics`、管理员题目页 | `quiz_sets`, `questions`, `quiz_set_questions` | 题组顺序、题目数量、关键哈希一致 |
| 题目审核 | `/api/v1/admin/questions/{id}/review` | `question_reviews` | 审核快照和审核人可追溯 |
| 题库答题记录 | `/api/v1/quiz/*`、个人中心知识记录 | `quiz_attempts`, `quiz_answers` | 普通题组与旧专题记录合并后数量和分数一致 |
| 任务分配 | `/api/v1/me/assignments`、`/api/v1/admin/assignments` | `assignments` | 学员归属、类型、目标和状态一致 |
| 场景与场景版本 | `/api/v1/scenarios`、管理员场景页 | `scenarios`, `scenario_versions` | 版本、知识引用、发布状态一致 |
| 实战会话、消息 | `/api/v1/scenario-sessions/*`、实战页面 | `training_sessions`, `training_messages` | 消息顺序、会话状态和恢复结果一致 |
| 评测报告 | `/api/v1/scenario-sessions/{id}/report/*`、复核详情 | `evaluation_reports` | 报告、风险、分数和证据一致 |
| 报告复核 | `/api/v1/admin/reviews/{report_id}` | `review_decisions` | 决策、修正分数和评论一致 |
| 管理审计 | `/api/v1/admin/history` | `admin_audit_events` | 新系统写入链路可审计；旧系统无对应记录时明确为空 |
| 派生进度摘要 | `/api/v1/overview` | `knowledge_progress`, `scenario_progress_summaries` | 从事实表重算并与抽样用户聚合一致 |
