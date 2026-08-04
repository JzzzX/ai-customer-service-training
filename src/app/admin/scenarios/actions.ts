"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getKnowledgeQueryStore } from "@/lib/runtime/services";
import {
  createOpenAIClient,
  resolveOpenAiModel,
  resolveScenarioAiMode,
} from "@/lib/scenario/ai-client";
import { generateScenarioDrafts } from "@/lib/scenario/generator";
import type { ScenarioCategory, ScenarioTemplate } from "@/lib/scenario/schema";

export type GenerateScenarioState = {
  error?: string;
  scenarios?: ScenarioTemplate[];
};

const generateFormSchema = z.object({
  category: z.enum([
    "presale",
    "logistics",
    "damage_shortage",
    "complaint",
  ]),
  count: z.coerce.number().int().min(1).max(5),
});

export async function generateScenariosAction(
  _previousState: GenerateScenarioState,
  formData: FormData,
): Promise<GenerateScenarioState> {
  await requireAdmin();
  const parsed = generateFormSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { error: "请选择有效的场景类别和生成数量。" };
  }

  if (resolveScenarioAiMode() !== "real") {
    return {
      error: "AI 真实模式未启用，请在 .env.local 中配置 SCENARIO_AI_MODE=real。",
    };
  }

  try {
    const client = createOpenAIClient();
    const model = resolveOpenAiModel();
    const category = parsed.data.category as ScenarioCategory;
    const knowledgeUnits = await getKnowledgeQueryStore()
      .listUnitsForScenario(category, 8);
    const scenarios = await generateScenarioDrafts({
      client,
      model,
      knowledgeUnits,
      category,
      count: parsed.data.count,
    });
    return { scenarios };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "场景生成失败，请稍后重试。",
    };
  }
}
