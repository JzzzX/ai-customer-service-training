import { createHash } from "node:crypto";

import type OpenAI from "openai";

import { categoryRules } from "./templates";
import {
  customerPersonaSchema,
  difficultySchema,
  scenarioTemplateSchema,
  type CustomerPersona,
  type Difficulty,
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
  scenarioFocus?: unknown;
  difficulty?: unknown;
  customerPersona?: unknown;
  scoringDimensions?: unknown;
  criticalRisks?: unknown;
  referenceFlow?: unknown;
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
  const fallbackSources: SourceLocator[] = [
    {
      sourcePath: "AI生成",
      kind: "markdown",
      anchor: "ai-generated",
      path: ["AI生成"],
    },
  ];
  const finalSources = sources.length > 0 ? sources : fallbackSources;
  const rules = categoryRules[input.category];

  return drafts.slice(0, count).map((draft) => {
    const hiddenFacts = toStringArray(draft.hiddenFacts, 3);
    const customerTurns = toStringArray(draft.customerTurns, 3);
    const scoringDimensions = parseScoringDimensions(
      draft.scoringDimensions,
      rules.scoringDimensions,
    );
    const criticalRisks = parseCriticalRisks(
      draft.criticalRisks,
      rules.criticalRisks,
    );
    const referenceFlow = parseReferenceFlow(
      draft.referenceFlow,
      rules.referenceFlow,
    );
    const persona = parsePersona(draft.customerPersona);
    const difficulty = parseDifficulty(draft.difficulty);
    const scenarioFocus = parseScenarioFocus(draft.scenarioFocus);
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
      scoringDimensions,
      criticalRisks,
      referenceFlow,
      referenceReply:
        String(draft.referenceReply ?? "").trim() || rules.referenceFlow[0]!,
      sources: finalSources,
      maxTurns: 12,
      status: "published" as const,
      mockMode: false,
      ...(persona ? { customerPersona: persona } : {}),
      difficulty,
      ...(scenarioFocus ? { scenarioFocus } : {}),
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
  const focusExamples: Record<ScenarioCategory, string[]> = {
    presale: [
      "幼犬换粮推荐",
      "价格异议处理",
      "多产品对比",
      "新品咨询",
    ],
    logistics: [
      "在途长时间未更新",
      "改址拦截",
      "签收异常",
      "二次配送",
    ],
    damage_shortage: [
      "外箱破损漏液",
      "少货核实",
      "错发商品",
      "开箱凭证收集",
    ],
    complaint: [
      "拒食适口性问题",
      "食后呕吐腹泻",
      "过敏反应",
      "情绪升级处理",
    ],
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
    "- scenarioFocus: 本场景的聚焦点（10-20字，保证同类别场景多样性）",
    `- difficulty: 难度分级，可选值为 easy（简单）、medium（中等）、hard（困难）`,
    "- customerPersona: 顾客人设对象，包含 temperament（calm/anxious/irritable/bargain_hunting）、knowledgeLevel（low/medium/high）、mood（当前情绪描述）",
    "- scoringDimensions: 5个评分维度数组，每个包含 name（维度名）、weight（权重，5个维度权重之和必须为100）、signals（识别信号词数组，至少2个）。维度应贴合本场景的具体业务，而非通用模板。",
    "- criticalRisks: 关键风险数组（至少2条），每个包含 label（风险名）、patterns（匹配模式数组，至少1个）",
    "- referenceFlow: 参考处理流程数组（至少4条，按顺序排列）",
    "",
    "多样性要求：",
    "1. 每个场景的 scenarioFocus 必须不同，覆盖该类别的不同细分情况",
    `2. 参考聚焦点示例：${focusExamples[category].join("、")}`,
    "3. 难度分级要合理分布，覆盖 easy/medium/hard",
    "4. 顾客人设要多样化，不要所有场景都用同一性格",
    "",
    "场景特异性要求：",
    "1. scoringDimensions 必须基于知识库内容和场景具体情况设计，不能照搬通用维度",
    "2. 评分维度名称要体现业务特点（如物流场景可突出「时效承诺准确性」）",
    "3. criticalRisks 要贴合场景可能出现的真实违规行为",
    "",
    "内容要求：",
    "1. 场景必须基于知识库内容，真实可信，符合该类别常见情况",
    "2. hiddenFacts 要具体（如品种、年龄、症状、订单状态等）",
    "3. customerTurns 要符合真实顾客口吻，不使用客服术语",
    "4. referenceReply 要体现正确处理流程，不虚构优惠或绝对化承诺",
    "5. 每个场景独立，不重复",
    "",
    '请以 JSON 输出：{"scenarios":[{...}]}',
  ].join("\n");
}

type RawDimension = {
  name?: unknown;
  weight?: unknown;
  signals?: unknown;
};

type RawRisk = {
  label?: unknown;
  patterns?: unknown;
};

function parseScoringDimensions(
  raw: unknown,
  fallback: ScenarioTemplate["scoringDimensions"],
): ScenarioTemplate["scoringDimensions"] {
  if (!Array.isArray(raw) || raw.length !== 5) {
    return fallback;
  }
  const dimensions = (raw as RawDimension[]).map((item) => ({
    name: String(item?.name ?? "").trim(),
    weight: Number(item?.weight ?? 0),
    signals: Array.isArray(item?.signals)
      ? (item.signals as unknown[]).map((s) => String(s).trim()).filter((s) => s.length > 0)
      : [],
  }));
  const hasInvalid = dimensions.some(
    (d) => d.name.length === 0 || d.weight <= 0 || d.signals.length < 2,
  );
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (hasInvalid || totalWeight !== 100) {
    return fallback;
  }
  return dimensions;
}

function parseCriticalRisks(
  raw: unknown,
  fallback: ScenarioTemplate["criticalRisks"],
): ScenarioTemplate["criticalRisks"] {
  if (!Array.isArray(raw) || raw.length < 2) {
    return fallback;
  }
  const risks = (raw as RawRisk[]).map((item) => ({
    label: String(item?.label ?? "").trim(),
    patterns: Array.isArray(item?.patterns)
      ? (item.patterns as unknown[]).map((p) => String(p).trim()).filter((p) => p.length > 0)
      : [],
  }));
  const hasInvalid = risks.some(
    (r) => r.label.length === 0 || r.patterns.length < 1,
  );
  if (hasInvalid) {
    return fallback;
  }
  return risks;
}

function parseReferenceFlow(
  raw: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(raw) || raw.length < 4) {
    return fallback;
  }
  const flow = raw
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return flow.length >= 4 ? flow : fallback;
}

function parsePersona(raw: unknown): CustomerPersona | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const result = customerPersonaSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

function parseDifficulty(raw: unknown): Difficulty {
  const result = difficultySchema.safeParse(raw);
  return result.success ? result.data : "medium";
}

function parseScenarioFocus(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const focus = raw.trim();
  return focus.length > 0 ? focus : undefined;
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
