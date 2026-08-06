import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { quizTopics, topicQuizQuestions } from "../src/lib/quiz/question-bank";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildPhase3Export() {
  const knowledgeUnitKeys = topicQuizQuestions
    .map((question) => question.knowledgeUnitId)
    .toSorted();
  const knowledgeVersionHash = digest(knowledgeUnitKeys);
  const topics = quizTopics
    .map((topic) => {
      const questions = topicQuizQuestions
        .filter((question) => question.category === topic.id)
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((question, index) => ({
          id: question.id,
          knowledge_unit_key: question.knowledgeUnitId,
          question_type: question.type,
          prompt: question.prompt,
          options: question.options,
          correct_answers: question.correctAnswers,
          explanation: question.explanation,
          category: question.category,
          difficulty: question.difficulty,
          position: index + 1,
          sources: question.sources.map((source) => ({
            source_path: source.sourcePath,
            kind: source.kind,
            anchor: source.anchor,
            path: source.path,
          })),
        }));
      const base = {
        id: topic.id,
        label: topic.label,
        description: topic.description,
        passing_score: 80,
        questions,
      };
      return { ...base, quiz_hash: digest(base) };
    })
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const base = {
    schema_version: 1 as const,
    knowledge_version_hash: knowledgeVersionHash,
    topics,
  };
  return { ...base, export_hash: digest(base) };
}

function main(): void {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: export-phase3-data.ts <output.json>");
  writeFileSync(output, `${JSON.stringify(buildPhase3Export(), null, 2)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
