import OpenAI from "openai";

import type { ScenarioMode } from "./schema";

type Environment = Record<string, string | undefined>;

export function resolveScenarioAiMode(
  environment: Environment = process.env,
): ScenarioMode {
  const mode = environment.SCENARIO_AI_MODE?.trim().toLowerCase();
  return mode === "real" ? "real" : "mock";
}

export function createOpenAIClient(
  environment: Environment = process.env,
): OpenAI {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const baseURL = environment.OPENAI_BASE_URL?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置，无法启用真实 AI 模式。");
  }
  if (!baseURL) {
    throw new Error("OPENAI_BASE_URL 未配置，无法启用真实 AI 模式。");
  }
  return new OpenAI({ apiKey, baseURL });
}

export function resolveOpenAiModel(
  environment: Environment = process.env,
): string {
  const model = environment.OPENAI_MODEL?.trim();
  if (!model) {
    throw new Error("OPENAI_MODEL 未配置，无法启用真实 AI 模式。");
  }
  return model;
}
