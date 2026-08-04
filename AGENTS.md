# Agent 协作规范

## 代码交付流程

每次完成代码改动后，必须执行以下操作：

1. 使用 `git status` 检查改动范围，确认只包含与本次任务相关的文件。
2. 不要提交用户明确保留或未授权的文件（如交接文档、个人笔记、自动生成的缓存文件等）。
3. 使用符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的提交信息。
4. 执行 `git commit` 提交改动。
5. 执行 `git push` 将提交推送到远程仓库。

> 注：`next-env.d.ts` 等框架自动生成文件不应手动编辑或提交。
