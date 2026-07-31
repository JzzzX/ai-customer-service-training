import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import OpenAI from "openai";

import type { ScenarioMode } from "./schema";

type Environment = Record<string, string | undefined>;

/**
 * 豆包模型 thinking 参数：disabled 关闭深度思考（更快），enabled 开启（质量更好），auto 模型自决。
 * 火山方舟 OpenAI 兼容 SDK 会把请求体原样发送，通过类型断言透传。
 * 参考: https://www.volcengine.com/docs/82379/1330626
 */
export type DoubaoThinking = { type: "disabled" | "enabled" | "auto" };

export type DoubaoStreamingChatParams = ChatCompletionCreateParamsStreaming & {
  thinking?: DoubaoThinking;
};

export type DoubaoNonStreamingChatParams = ChatCompletionCreateParamsNonStreaming & {
  thinking?: DoubaoThinking;
};

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
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 60_000,
    maxRetries: 1,
  });
}

let cachedClient: OpenAI | null = null;
let cachedClientEnvKey: string | null = null;

/**
 * 模块级单例工厂，复用 HTTP keepalive 连接池。
 * 以 apiKey+baseURL 作为缓存 key，环境变量变更时重建。
 */
export function getOpenAIClient(
  environment: Environment = process.env,
): OpenAI {
  const envKey = `${environment.OPENAI_API_KEY ?? ""}|${environment.OPENAI_BASE_URL ?? ""}`;
  if (cachedClient && cachedClientEnvKey === envKey) {
    return cachedClient;
  }
  cachedClient = createOpenAIClient(environment);
  cachedClientEnvKey = envKey;
  return cachedClient;
}

/** 报告生成保留 reasoning，需更长 timeout（思考过程耗时长）。 */
export const EVALUATION_TIMEOUT_MS = 180_000;

export function resolveOpenAiModel(
  environment: Environment = process.env,
): string {
  const model = environment.OPENAI_MODEL?.trim();
  if (!model) {
    throw new Error("OPENAI_MODEL 未配置，无法启用真实 AI 模式。");
  }
  return model;
}

