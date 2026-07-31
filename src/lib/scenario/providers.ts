import type { KnowledgeUnit } from "@/lib/knowledge/schema";
import type {
  LiveRiskAlert,
  ScenarioEvaluationReport,
  ScenarioMessageInput,
  ScenarioTemplate,
} from "./schema";

export interface ConversationProvider {
  streamCustomerReply(input: {
    scenario: ScenarioTemplate;
    learnerTurnCount: number;
    messages: ScenarioMessageInput[];
    knowledgeUnits?: KnowledgeUnit[];
  }): AsyncIterable<string>;
}

export type EvaluationStreamChunk =
  | { delta: string }
  | { report: ScenarioEvaluationReport };

export interface EvaluationProvider {
  evaluate(input: {
    scenario: ScenarioTemplate;
    learnerMessages: string[];
  }): Promise<ScenarioEvaluationReport>;
  evaluateStream(input: {
    scenario: ScenarioTemplate;
    learnerMessages: string[];
  }): AsyncIterable<EvaluationStreamChunk>;
}

export interface LiveRiskProvider {
  detectRisk(input: {
    scenario: ScenarioTemplate;
    learnerMessage: string;
  }): Promise<LiveRiskAlert | null>;
}
