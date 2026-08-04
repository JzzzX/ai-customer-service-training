import { and, eq } from "drizzle-orm";
import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

import { getDatabase } from "../src/db/client";
import {
  createQuizDraftPublicationStore,
  publishQuizDraftToStore,
} from "../src/db/quiz-draft-publication";
import { DbQuizReviewStore } from "../src/db/repositories/db-quiz-review-store";
import { users } from "../src/db/schema";
import { loadQuizDraftArtifact } from "../src/lib/quiz/draft-artifact";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

async function main(): Promise<void> {
  const database = getDatabase();
  const adminEmail = z
    .string()
    .email()
    .parse(process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase());
  const [admin] = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.email, adminEmail),
        eq(users.role, "admin"),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  if (!admin) {
    throw new Error("找不到已启用的种子管理员账号。");
  }

  const draft = await loadQuizDraftArtifact(
    resolve(process.cwd(), "artifacts", "quiz"),
  );
  const draftResult = await publishQuizDraftToStore(
    draft,
    admin.id,
    createQuizDraftPublicationStore(database),
  );
  const published = await new DbQuizReviewStore(database).publish();

  console.log(
    [
      `题库草稿：${draftResult.quizHash}`,
      `题目数：${draft.questions.length}`,
      `草稿：${draftResult.created ? "已创建" : "已存在（幂等）"}`,
      `正式题组：${published.quizHash}`,
      "状态：已自动发布（人工复核可选）",
    ].join("\n"),
  );
}

main().catch(() => {
  console.error(
    "题库草稿发布失败。请检查数据库连接、迁移、管理员种子和知识版本状态。",
  );
  process.exitCode = 1;
});
