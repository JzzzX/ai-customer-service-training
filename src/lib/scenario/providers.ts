import type {
  ScenarioEvaluationReport,
  ScenarioMessageInput,
  ScenarioTemplate,
} from "./schema";

export interface ConversationProvider {
  streamCustomerReply(input: {
    scenario: ScenarioTemplate;
    learnerTurnCount: number;
    messages: ScenarioMessageInput[];
  }): AsyncIterable<string>;
}

export interface EvaluationProvider {
  evaluate(input: {
    scenario: ScenarioTemplate;
    learnerMessages: string[];
  }): Promise<ScenarioEvaluationReport>;
}
