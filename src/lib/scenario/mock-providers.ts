import type {
  ConversationProvider,
  EvaluationProvider,
  EvaluationStreamChunk,
  LiveRiskProvider,
} from "./providers";
import {
  scenarioEvaluationReportSchema,
  scenarioMessageInputSchema,
  type LiveRiskAlert,
} from "./schema";

const DANGER_KEYWORDS = [
  "傻逼",
  "滚",
  "笨蛋",
  "白痴",
  "废物",
  "脑子有病",
  "神经病",
];

export class MockConversationProvider implements ConversationProvider {
  async *streamCustomerReply(
    input: Parameters<ConversationProvider["streamCustomerReply"]>[0],
  ): AsyncIterable<string> {
    input.messages.forEach((message) =>
      scenarioMessageInputSchema.parse(message),
    );
    const turnIndex = Math.min(
      Math.max(0, input.learnerTurnCount),
      input.scenario.customerTurns.length - 1,
    );
    const reply = input.scenario.customerTurns[turnIndex];
    const characters = Array.from(reply);

    for (let index = 0; index < characters.length; index += 6) {
      yield characters.slice(index, index + 6).join("");
    }
  }
}

export class MockEvaluationProvider implements EvaluationProvider {
  async evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ) {
    const learnerText = input.learnerMessages.join("\n");
    const dimensions = input.scenario.scoringDimensions.map((dimension) => {
      const evidence = dimension.signals
        .filter((signal) => learnerText.includes(signal))
        .slice(0, 2);
      const score = Math.round(
        dimension.weight * Math.min(1, evidence.length / 2),
      );
      return {
        name: dimension.name,
        score,
        maxScore: dimension.weight,
        evidence,
      };
    });
    const risks = input.scenario.criticalRisks
      .filter((risk) =>
        risk.patterns.some((pattern) => learnerText.includes(pattern)),
      )
      .map((risk) => risk.label);
    const totalScore = dimensions.reduce(
      (total, dimension) => total + dimension.score,
      0,
    );
    const strengths = dimensions
      .filter(
        (dimension) =>
          dimension.score / dimension.maxScore >= 0.8,
      )
      .map((dimension) => dimension.name);
    const missedSteps = dimensions
      .filter(
        (dimension) =>
          dimension.score / dimension.maxScore < 0.8,
      )
      .map((dimension) => dimension.name);

    return scenarioEvaluationReportSchema.parse({
      mode: "mock",
      totalScore,
      status:
        totalScore >= 80 && risks.length === 0
          ? "passed"
          : "needs_retry",
      confidence: 0.92,
      dimensions,
      strengths,
      missedSteps,
      risks,
      recommendations: input.scenario.referenceFlow.map((step, index) => ({
        issue: missedSteps[index % Math.max(missedSteps.length, 1)] ?? step,
        suggestedReply: step,
      })),
      referenceReply: input.scenario.referenceReply,
      lowConfidence: input.learnerMessages.length < 3,
    });
  }

  async *evaluateStream(
    input: Parameters<EvaluationProvider["evaluateStream"]>[0],
  ): AsyncIterable<EvaluationStreamChunk> {
    const report = await this.evaluate(input);
    yield { report };
  }
}

export class MockLiveRiskProvider implements LiveRiskProvider {
  async detectRisk(
    input: Parameters<LiveRiskProvider["detectRisk"]>[0],
  ): Promise<LiveRiskAlert | null> {
    const message = input.learnerMessage;
    for (const keyword of DANGER_KEYWORDS) {
      if (message.includes(keyword)) {
        return {
          riskLabel: "攻击性语言",
          suggestion:
            "请使用专业、礼貌的表达，避免对顾客使用贬低或攻击性词汇。",
          severity: "danger",
        };
      }
    }
    for (const risk of input.scenario.criticalRisks) {
      for (const pattern of risk.patterns) {
        if (message.includes(pattern)) {
          return {
            riskLabel: risk.label,
            suggestion: `避免使用「${pattern}」类表述，建议改为更稳妥、可兑现的说法。`,
            severity: "warning",
          };
        }
      }
    }
    return null;
  }
}
