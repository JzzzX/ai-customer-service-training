import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { hashSync } from "bcryptjs";

import type { DatabaseClient } from "./client";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USER_NAME,
} from "@/lib/runtime/demo-identity";

const DEMO_KNOWLEDGE_VERSION_ID =
  "00000000-0000-4000-8000-000000000002";
const DEMO_KNOWLEDGE_UNIT_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_SCENARIO_ID = "00000000-0000-4000-8000-000000000004";
const DEMO_SCENARIO_VERSION_ID =
  "00000000-0000-4000-8000-000000000005";
const DEMO_SCENARIO_KEY = "st_000000000000000000000001";
const DEMO_SCENARIO_VERSION_KEY = "sv_000000000000000000000001";

const demoSource = JSON.stringify([
  {
    sourcePath: "演示知识（临时）",
    kind: "markdown",
    anchor: "demo",
    path: ["演示", "售前"],
  },
]);

const scoringDimensions = JSON.stringify([
  { name: "需求确认", weight: 20, signals: ["年龄", "需求"] },
  { name: "信息收集", weight: 20, signals: ["了解", "情况"] },
  { name: "专业表达", weight: 20, signals: ["建议", "方案"] },
  { name: "风险提示", weight: 20, signals: ["注意", "确认"] },
  { name: "跟进邀请", weight: 20, signals: ["继续", "后续"] },
]);

const criticalRisks = JSON.stringify([
  { label: "疗效承诺", patterns: ["保证治愈"] },
  { label: "忽略需求", patterns: ["不用了解"] },
]);

export function initializeDemoDatabase(
  database: DatabaseClient,
  projectRoot = process.cwd(),
): void {
  applyMigrations(database, projectRoot);
  const client = database.$client;
  const now = Date.now();

  client.transaction(() => {
    client
      .prepare(
        "INSERT INTO users (id, email, name, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      )
      .run(
        DEMO_USER_ID,
        DEMO_USER_EMAIL,
        DEMO_USER_NAME,
        hashSync("demo-only", 4),
        now,
        now,
      );

    client
      .prepare(
        "INSERT INTO knowledge_versions (id, version_hash, content_hash, schema_version, source_root, publication_source, status, is_active, coverage, published_at, created_at) VALUES (?, ?, ?, 1, ?, 'cli', 'published', 1, ?, ?, ?)",
      )
      .run(
        DEMO_KNOWLEDGE_VERSION_ID,
        "demo-knowledge-v1",
        "demo-knowledge-content",
        "demo",
        JSON.stringify({ units: 1, scenarios: 1 }),
        now,
        now,
      );

    client
      .prepare(
        "INSERT INTO knowledge_units (id, knowledge_version_id, unit_key, title, content, category_path, content_hash, sources, has_conflict, can_use_for_quiz, can_use_for_scenario, can_use_for_evaluation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 1, ?)",
      )
      .run(
        DEMO_KNOWLEDGE_UNIT_ID,
        DEMO_KNOWLEDGE_VERSION_ID,
        "demo-presale-unit",
        "幼宠主粮需求确认",
        "演示知识：先确认宠物年龄、体重、当前饮食和顾客的核心顾虑，再给出产品建议。",
        JSON.stringify(["售前", "需求确认"]),
        "demo-unit-content",
        demoSource,
        now,
      );

    client
      .prepare(
        "INSERT INTO scenarios (id, scenario_key, title, category, status, created_at, updated_at) VALUES (?, ?, ?, 'presale', 'published', ?, ?)",
      )
      .run(
        DEMO_SCENARIO_ID,
        DEMO_SCENARIO_KEY,
        "演示：幼宠主粮咨询",
        now,
        now,
      );

    client
      .prepare(
        "INSERT INTO scenario_versions (id, scenario_id, version_key, version, knowledge_version_id, content_hash, publication_source, background, summary, first_customer_message, controlled_variables, hidden_facts, customer_turns, checkpoints, prohibitions, scoring_weights, scoring_dimensions, critical_risks, reference_flow, reference_reply, sources, max_turns, mock_mode, customer_persona, difficulty, status, published_at, created_at) VALUES (?, ?, ?, 1, ?, ?, 'cli', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 12, 1, ?, 'medium', 'published', ?, ?)",
      )
      .run(
        DEMO_SCENARIO_VERSION_ID,
        DEMO_SCENARIO_ID,
        DEMO_SCENARIO_VERSION_KEY,
        DEMO_KNOWLEDGE_VERSION_ID,
        "demo-scenario-content",
        "顾客想为刚断奶的幼宠选择一款更合适的主粮。",
        "用于验证演示环境的 Mock AI 情景训练。",
        "您好，我家宠物刚断奶，想换一款主粮，应该怎么选？",
        JSON.stringify({}),
        JSON.stringify(["宠物刚断奶", "目前还没有固定品牌", "顾客关注适口性"]),
        JSON.stringify([
          "您好，我家宠物三个月大，最近想换粮。",
          "它之前吃得比较少，我有点担心营养。",
          "好的，我还想了解一下怎么过渡。",
        ]),
        JSON.stringify(["确认年龄", "了解饮食", "说明过渡", "邀请跟进"]),
        JSON.stringify(["不要承诺疗效", "不要忽略顾客问题"]),
        JSON.stringify({
          "需求确认": 20,
          "信息收集": 20,
          "专业表达": 20,
          "风险提示": 20,
          "跟进邀请": 20,
        }),
        scoringDimensions,
        criticalRisks,
        JSON.stringify(["确认宠物信息", "了解当前饮食", "给出过渡建议", "邀请继续沟通"]),
        "我会先确认宠物信息和当前饮食，再结合实际情况给你说明过渡方法。",
        demoSource,
        JSON.stringify({
          temperament: "calm",
          knowledgeLevel: "low",
          mood: "希望得到清晰的换粮建议",
        }),
        now,
        now,
      );
  })();
}

function applyMigrations(database: DatabaseClient, projectRoot: string): void {
  const migrationDirectory = resolve(projectRoot, "drizzle");
  const migrations = readdirSync(migrationDirectory)
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort();
  if (migrations.length === 0) {
    throw new Error("演示 SQLite migration 不存在。");
  }
  for (const migration of migrations) {
    database.$client.exec(
      readFileSync(resolve(migrationDirectory, migration), "utf8"),
    );
  }
}
