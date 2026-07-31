import type OpenAI from "openai";

import {
  buildConversationSystemPrompt,
  buildConversationUserPrompt,
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  buildLiveRiskPrompt,
} from "./prompt-templates";
import type {
  ConversationProvider,
  EvaluationProvider,
  LiveRiskProvider,
} from "./providers";
import {
  scenarioEvaluationReportSchema,
  scenarioMessageInputSchema,
  type LiveRiskAlert,
  type ScenarioEvaluationReport,
} from "./schema";

type LlmDimension = {
  name?: unknown;
  score?: unknown;
  evidence?: unknown;
};

type LlmEvaluation = {
  confidence?: unknown;
  strengths?: unknown;
  missedSteps?: unknown;
  risks?: unknown;
  recommendations?: unknown;
  dimensions?: unknown;
  lowConfidence?: unknown;
};

type LlmRecommendation = {
  issue?: unknown;
  suggestedReply?: unknown;
};

function parseRecommendations(
  raw: unknown,
  fallbackFlow: string[],
): Array<{ issue: string; suggestedReply: string }> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return fallbackFlow.map((step) => ({
      issue: "参考处理流程",
      suggestedReply: step,
    }));
  }
  return raw.map((item) => {
    if (typeof item === "string") {
      return { issue: "改进建议", suggestedReply: item };
    }
    const rec = item as LlmRecommendation;
    return {
      issue: String(rec.issue ?? "改进建议").trim() || "改进建议",
      suggestedReply:
        String(rec.suggestedReply ?? "").trim() ||
        fallbackFlow[0] ||
        "请参考标准处理流程。",
    };
  });
}

export class OpenAIConversationProvider implements ConversationProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async *streamCustomerReply(
    input: Parameters<ConversationProvider["streamCustomerReply"]>[0],
  ): AsyncIterable<string> {
    input.messages.forEach((message) =>
      scenarioMessageInputSchema.parse(message),
    );
    const systemPrompt = buildConversationSystemPrompt(
      input.scenario,
      input.knowledgeUnits ?? [],
    );
    const userPrompt = buildConversationUserPrompt(
      input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    );
    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    let yielded = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yielded = true;
        yield delta;
      }
    }
    if (!yielded) {
      throw new Error("AI 未返回有效回复，请稍后重试。");
    }
  }
}

export class OpenAIEvaluationProvider implements EvaluationProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ): Promise<ScenarioEvaluationReport> {
    const systemPrompt = buildEvaluationSystemPrompt(input.scenario);
    const userPrompt = buildEvaluationUserPrompt(input.learnerMessages);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: LlmEvaluation;
    try {
      parsed = JSON.parse(content) as LlmEvaluation;
    } catch {
      throw new Error("AI 评测结果解析失败，请稍后重试。");
    }

    const dimensionWeights = new Map(
      input.scenario.scoringDimensions.map((dimension) => [
        dimension.name,
        dimension.weight,
      ]),
    );
    const llmDimensions = new Map<string, LlmDimension>();
    if (Array.isArray(parsed.dimensions)) {
      for (const dimension of parsed.dimensions) {
        const name = String(dimension?.name ?? "").trim();
        if (name) {
          llmDimensions.set(name, dimension);
        }
      }
    }
    const dimensions = input.scenario.scoringDimensions.map((dimension) => {
      const llm = llmDimensions.get(dimension.name);
      const evidence = Array.isArray(llm?.evidence)
        ? llm.evidence.map(String).filter((value) => value.trim().length > 0)
        : [];
      return {
        name: dimension.name,
        score: Math.max(0, Math.round(Number(llm?.score ?? 0))),
        maxScore: dimension.weight,
        evidence: evidence.slice(0, 2),
      };
    });
    const totalScore = Math.min(
      100,
      Math.max(0, dimensions.reduce((total, dimension) => total + dimension.score, 0)),
    );
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map(String).filter((value) => value.trim().length > 0)
      : [];
    const status = totalScore >= 80 && risks.length === 0 ? "passed" : "needs_retry";
    const strengths = dimensions
      .filter((dimension) => dimension.score / dimension.maxScore >= 0.8)
      .map((dimension) => dimension.name);
    const missedSteps = dimensions
      .filter((dimension) => dimension.score / dimension.maxScore < 0.8)
      .map((dimension) => dimension.name);
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
    const recommendations = parseRecommendations(
      parsed.recommendations,
      input.scenario.referenceFlow,
    );
    const lowConfidence =
      Boolean(parsed.lowConfidence) ||
      confidence < 0.6 ||
      input.learnerMessages.length < 3;

    return scenarioEvaluationReportSchema.parse({
      mode: "real",
      totalScore,
      status,
      confidence,
      dimensions,
      strengths,
      missedSteps,
      risks,
      recommendations,
      referenceReply: input.scenario.referenceReply,
      lowConfidence,
    });
  }
}

export function createOpenAIProviders(
  client: OpenAI,
  model: string,
): {
  conversation: OpenAIConversationProvider;
  evaluation: OpenAIEvaluationProvider;
  liveRisk: OpenAILiveRiskProvider;
} {
  return {
    conversation: new OpenAIConversationProvider(client, model),
    evaluation: new OpenAIEvaluationProvider(client, model),
    liveRisk: new OpenAILiveRiskProvider(client, model),
  };
}

export class OpenAILiveRiskProvider implements LiveRiskProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async detectRisk(
    input: Parameters<LiveRiskProvider["detectRisk"]>[0],
  ): Promise<LiveRiskAlert | null> {
    const { system, user } = buildLiveRiskPrompt(
      input.scenario,
      input.learnerMessage,
    );
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }
    const result = parsed as Partial<LiveRiskAlert>;
    if (
      typeof result.riskLabel !== "string" ||
      typeof result.suggestion !== "string" ||
      (result.severity !== "warning" && result.severity !== "danger")
    ) {
      return null;
    }
    const riskLabel = result.riskLabel.trim();
    const suggestion = result.suggestion.trim();
    if (!riskLabel || !suggestion) {
      return null;
    }
    return {
      riskLabel,
      suggestion,
      severity: result.severity,
    };
  }
}
