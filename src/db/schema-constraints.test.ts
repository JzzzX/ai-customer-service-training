import { describe, expect, it } from "vitest";

import { createTestDatabase } from "./test-support/create-test-database";

describe("SQLite enum constraints", () => {
  it("rejects invalid persisted enum values", async () => {
    const { client } = await createTestDatabase();
    client.pragma("foreign_keys = OFF");

    try {
      for (const statement of invalidEnumInserts) {
        expect(() => client.exec(statement)).toThrow(/CHECK constraint failed/);
      }
    } finally {
      client.close();
    }
  });
});

const invalidEnumInserts = [
  `INSERT INTO knowledge_versions (id, version_hash, content_hash, schema_version, source_root, status, is_active, coverage) VALUES ('kv', 'version', 'content', 1, 'root', 'invalid', 0, '{}')`,
  `INSERT INTO knowledge_sources (id, knowledge_version_id, source_path, kind, source_hash, bytes, stats) VALUES ('source', 'kv', 'source.md', 'invalid', 'hash', 1, '{}')`,
  `INSERT INTO questions (id, knowledge_version_id, knowledge_unit_id, question_key, type, prompt, options, correct_answers, explanation, category, difficulty, status) VALUES ('question-type', 'kv', 'unit', 'type', 'invalid', 'prompt', '[]', '[]', 'explanation', 'category', 'easy', 'draft')`,
  `INSERT INTO questions (id, knowledge_version_id, knowledge_unit_id, question_key, type, prompt, options, correct_answers, explanation, category, difficulty, status) VALUES ('question-difficulty', 'kv', 'unit', 'difficulty', 'single_choice', 'prompt', '[]', '[]', 'explanation', 'category', 'invalid', 'draft')`,
  `INSERT INTO quiz_attempts (id, quiz_set_id, learner_id, knowledge_version_id, status, total_questions) VALUES ('quiz-attempt', 'quiz', 'learner', 'kv', 'invalid', 1)`,
  `INSERT INTO training_sessions (id, learner_id, knowledge_version_id, scenario_version_id, status) VALUES ('session', 'learner', 'kv', 'scenario-version', 'invalid')`,
  `INSERT INTO training_messages (id, training_session_id, position, sender, content) VALUES ('message', 'session', 0, 'invalid', 'content')`,
  `INSERT INTO evaluation_reports (id, training_session_id, knowledge_version_id, total_score, verdict, dimensions, strengths, omissions, risks, recommendations, turn_feedback, recommended_flow, sample_reply, evidence, confidence) VALUES ('report', 'session', 'kv', 100, 'invalid', '[]', '[]', '[]', '[]', '[]', '[]', '[]', 'reply', '[]', 1)`,
];
