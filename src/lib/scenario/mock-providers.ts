import type {
  ConversationProvider,
  EvaluationProvider,
} from "./providers";
import {
  scenarioEvaluationReportSchema,
  scenarioMessageInputSchema,
} from "./schema";

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
      recommendations: input.scenario.referenceFlow,
      referenceReply: input.scenario.referenceReply,
    });
  }
}
