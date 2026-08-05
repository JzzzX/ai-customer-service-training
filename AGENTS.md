# Agent 协作规范

## 代码交付流程

每次完成代码改动后，必须执行以下操作：

1. 使用 `git status` 检查改动范围，确认只包含与本次任务相关的文件。
2. 不要提交用户明确保留或未授权的文件（如个人笔记、自动生成的缓存文件等）。本项目明确纳入版本管理的 README、AGENTS 和技术交接文档除外。
3. 使用符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范、且描述为中文的提交信息。格式为：

   ```text
   <type>(<scope>): <中文描述>
   ```

   例如：`docs(readme): 完善项目架构图示与开发导航`。`type` 使用标准类型（如 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`），`scope` 可选，提交标题中的实际变更描述必须使用简洁中文。
4. 执行 `git commit` 提交改动。
5. 确认当前分支和两个远程仓库均正确：
   - `origin`：GitHub 仓库
   - `gitea`：公司 Gitea 仓库
6. 同一个提交必须同时推送到 GitHub 和公司 Gitea，不要只执行无参数的 `git push`：

   ```bash
   git push origin <当前分支>
   git push gitea <当前分支>
   ```

   首次为分支设置上游时，可分别使用 `git push --set-upstream origin <当前分支>` 和 `git push --set-upstream gitea <当前分支>`。
7. 推送完成后，分别检查两个远程仓库的分支是否已包含当前提交。

> 注：`next-env.d.ts` 等框架自动生成文件不应手动编辑或提交。
