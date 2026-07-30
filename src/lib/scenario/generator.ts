import { createHash } from "node:crypto";

import type OpenAI from "openai";

import { categoryRules } from "./templates";
import {
  scenarioTemplateSchema,
  type ScenarioCategory,
  type ScenarioTemplate,
} from "./schema";
import type { KnowledgeUnit, SourceLocator } from "@/lib/knowledge/schema";

type GeneratedDraft = {
  title?: unknown;
  summary?: unknown;
  openingMessage?: unknown;
  hiddenFacts?: unknown;
  customerTurns?: unknown;
  referenceReply?: unknown;
};

type GeneratedResponse = {
  scenarios?: unknown;
};

export type ScenarioGenerationInput = {
  client: OpenAI;
  model: string;
  knowledgeUnits: KnowledgeUnit[];
  category: ScenarioCategory;
  count: number;
};

export async function generateScenarioDrafts(
  input: ScenarioGenerationInput,
): Promise<ScenarioTemplate[]> {
  const count = Math.max(1, Math.min(5, input.count));
  const knowledgeContents = input.knowledgeUnits.map(
    (unit) => `- ${unit.title}：${unit.content}`,
  );
  const systemPrompt = buildGenerationSystemPrompt(
    input.category,
    count,
    knowledgeContents,
  );
  const completion = await input.client.chat.completions.create({
    model: input.model,
    messages: [{ role: "system", content: systemPrompt }],
    response_format: { type: "json_object" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  let parsed: GeneratedResponse;
  try {
    parsed = JSON.parse(content) as GeneratedResponse;
  } catch {
    throw new Error("AI 场景生成结果解析失败，请稍后重试。");
  }
  const drafts = Array.isArray(parsed.scenarios)
    ? (parsed.scenarios as GeneratedDraft[])
    : [];
  if (drafts.length === 0) {
    throw new Error("AI 未生成有效场景，请稍后重试。");
  }
  const sources = collectSources(input.knowledgeUnits);
  const rules = categoryRules[input.category];

  return drafts.slice(0, count).map((draft) => {
    const hiddenFacts = toStringArray(draft.hiddenFacts, 3);
    const customerTurns = toStringArray(draft.customerTurns, 3);
    const template = {
      id: generateKey("st", draft),
      versionId: generateKey("sv", draft),
      title: String(draft.title ?? "").trim() || "未命名场景",
      category: input.category,
      summary: String(draft.summary ?? "").trim() || "AI 生成的训练场景",
      openingMessage:
        String(draft.openingMessage ?? "").trim() || "你好，我想咨询一下。",
      hiddenFacts,
      customerTurns,
      scoringDimensions: rules.scoringDimensions,
      criticalRisks: rules.criticalRisks,
      referenceFlow: rules.referenceFlow,
      referenceReply:
        String(draft.referenceReply ?? "").trim() || rules.referenceFlow[0],
      sources,
      maxTurns: 12,
      status: "published" as const,
      mockMode: false,
    };
    return scenarioTemplateSchema.parse(template);
  });
}

function buildGenerationSystemPrompt(
  category: ScenarioCategory,
  count: number,
  knowledgeContents: string[],
): string {
  const categoryLabel: Record<ScenarioCategory, string> = {
    presale: "售前咨询（需求挖掘、产品推荐、价格异议）",
    logistics: "物流问题（在途异常、改址拦截、签收问题）",
    damage_shortage: "破损少货（凭证收集、责任判断、售后方案）",
    complaint: "客诉处理（适口性、健康风险、升级处理）",
  };
  return [
    "你是一位宠物食品电商客服培训内容设计专家，需要根据知识库内容生成客服训练场景。",
    "",
    `场景类别：${categoryLabel[category]}`,
    `生成数量：${count} 个`,
    "",
    "知识库参考内容：",
    ...knowledgeContents,
    "",
    "每个场景需要输出以下字段：",
    "- title: 场景标题（简洁，10-20字）",
    "- summary: 场景背景摘要（20-40字）",
    "- openingMessage: 顾客开场白（口语化，10-30字）",
    "- hiddenFacts: 顾客已知的隐藏事实数组（至少3条，客服需通过对话挖掘）",
    "- customerTurns: 顾客可能的回复数组（至少3条，符合真实顾客口吻）",
    "- referenceReply: 参考客服回复（完整话术，体现专业和同理心）",
    "",
    "要求：",
    "1. 场景必须基于知识库内容，真实可信，符合该类别常见情况",
    "2. hiddenFacts 要具体（如品种、年龄、症状、订单状态等）",
    "3. customerTurns 要符合真实顾客口吻，不使用客服术语",
    "4. referenceReply 要体现正确处理流程，不虚构优惠或绝对化承诺",
    "5. 每个场景独立，不重复",
    "",
    '请以 JSON 输出：{"scenarios":[{...}]}',
  ].join("\n");
}

function collectSources(units: KnowledgeUnit[]): SourceLocator[] {
  const sources: SourceLocator[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    for (const source of unit.sources) {
      const key = `${source.sourcePath}\u0000${source.anchor}`;
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(source);
      }
    }
  }
  return sources.slice(0, 3);
}

function toStringArray(value: unknown, min: number): string[] {
  if (!Array.isArray(value)) {
    return Array.from({ length: min }, (_, index) => `默认项 ${index + 1}`);
  }
  const result = value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  while (result.length < min) {
    result.push(`补充项 ${result.length + 1}`);
  }
  return result;
}

function generateKey(prefix: string, draft: GeneratedDraft): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(draft) + prefix)
    .digest("hex");
  return `${prefix}_${hash.slice(0, 24)}`;
}
