import type OpenAI from "openai";

import {
  createOpenAIClient,
  resolveOpenAiModel,
} from "./ai-client";

type Environment = Record<string, string | undefined>;

type PreflightDependencies = {
  createClient?: (environment: Environment) => OpenAI;
  now?: () => number;
};

export type CompanyAiGatewayPreflight = {
  endpoint: string;
  latencyMs: number;
  model: string;
};

export async function verifyCompanyAiGateway(
  environment: Environment = process.env,
  dependencies: PreflightDependencies = {},
): Promise<CompanyAiGatewayPreflight> {
  if (environment.SCENARIO_AI_MODE?.trim().toLowerCase() !== "real") {
    throw new Error("SCENARIO_AI_MODE 必须设置为 real。");
  }
  if (environment.AI_GATEWAY_ENABLED?.trim().toLowerCase() === "true") {
    throw new Error("AI_GATEWAY_ENABLED 必须设置为 false。");
  }

  const baseUrl = environment.OPENAI_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("OPENAI_BASE_URL 未配置。");
  }
  const endpoint = new URL(baseUrl).host;
  const model = resolveOpenAiModel(environment);
  const client = (dependencies.createClient ?? createOpenAIClient)(environment);
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const completion = await client.chat.completions.create({
    model,
    stream: false,
    max_tokens: 8,
    messages: [
      {
        role: "system",
        content: "这是连通性检查，不包含业务或用户数据。",
      },
      { role: "user", content: "只回复 OK" },
    ],
  });
  const latencyMs = Math.max(0, now() - startedAt);
  const choice = completion.choices[0];
  if (!choice?.message) {
    throw Object.assign(new Error("AI 网关响应格式异常。"), {
      code: "AI_INVALID_RESPONSE",
    });
  }
  const content = choice.message.content?.trim();
  if (!content) {
    throw Object.assign(new Error("AI 网关未返回有效内容。"), {
      code: "AI_EMPTY_RESPONSE",
    });
  }
  return { endpoint, latencyMs, model };
}
