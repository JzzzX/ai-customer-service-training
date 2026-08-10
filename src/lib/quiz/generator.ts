import { createHash } from "node:crypto";

import type {
  KnowledgePack,
  KnowledgeUnit,
  SourceLocator,
} from "@/lib/knowledge/schema";

import { quizDraftPackSchema } from "./schema";
import type { QuizDraftPack, QuizQuestionDraft } from "./schema";

const QUESTION_CATEGORIES = [
  "产品属性及卖点",
  "宠物生理和喂养",
  "日常问答",
  "活动促销",
  "服务流程与规则",
] as const;

interface GenerateQuizDraftPackInput {
  knowledge: KnowledgePack;
  count?: number;
  title?: string;
  passingScore?: number;
}

export function generateQuizDraftPack(
  input: GenerateQuizDraftPackInput,
): QuizDraftPack {
  const count = input.count ?? 40;
  if (!Number.isInteger(count) || count < 2 || count % 2 !== 0) {
    throw new Error("题目数量必须是大于等于 2 的偶数。");
  }
  if (!input.knowledge.gate.passed) {
    throw new Error("知识覆盖门禁未通过，不能生成小测题。");
  }

  const conflictLocators = collectConflictLocators(input.knowledge);
  const eligible = input.knowledge.units
    .filter((unit) => isReviewable(unit, conflictLocators))
    .toSorted(compareCandidates);

  if (eligible.length < count) {
    throw new Error(
      `至少需要 ${count} 个可出题知识单元，当前只有 ${eligible.length} 个。`,
    );
  }

  const selected = selectAcrossCategories(eligible, count);
  const half = count / 2;
  const questions = selected.map((unit, index) =>
    index < half
      ? createSingleChoice(unit, eligible, input.knowledge.packHash)
      : createTrueFalse(
          unit,
          eligible,
          input.knowledge.packHash,
          index - half,
        ),
  );
  const payload = {
    schemaVersion: 1 as const,
    knowledgePackHash: input.knowledge.packHash,
    title: input.title ?? "客服新人知识基础小测",
    passingScore: input.passingScore ?? 80,
    status: "draft" as const,
    questions,
  };

  return quizDraftPackSchema.parse({
    ...payload,
    quizHash: digest(payload),
  });
}

function createSingleChoice(
  unit: KnowledgeUnit,
  pool: KnowledgeUnit[],
  packHash: string,
): QuizQuestionDraft {
  const correct = cleanText(unit.content);
  const distractors = pickDistractors(unit, pool, 3).map((item) =>
    cleanText(item.content),
  );
  const options = stableShuffle(
    [correct, ...distractors],
    `${packHash}:${unit.id}:options`,
  );

  return {
    id: questionId(packHash, unit.id, "single_choice"),
    knowledgeUnitId: unit.id,
    type: "single_choice",
    prompt: buildChoicePrompt(unit),
    options,
    correctAnswers: [correct],
    explanation: correct,
    category: mapCategory(unit),
    difficulty: "easy",
    status: "draft",
    sources: unit.sources,
  };
}

function createTrueFalse(
  unit: KnowledgeUnit,
  pool: KnowledgeUnit[],
  packHash: string,
  position: number,
): QuizQuestionDraft {
  const isTrue = position % 2 === 0;
  const statement = isTrue
    ? cleanText(unit.content)
    : cleanText(pickDistractors(unit, pool, 1)[0]?.content ?? "");

  return {
    id: questionId(packHash, unit.id, "true_false"),
    knowledgeUnitId: unit.id,
    type: "true_false",
    prompt: `判断下列说法是否正确：关于“${cleanText(unit.title)}”，${statement}`,
    options: ["正确", "错误"],
    correctAnswers: [isTrue ? "正确" : "错误"],
    explanation: cleanText(unit.content),
    category: mapCategory(unit),
    difficulty: "easy",
    status: "draft",
    sources: unit.sources,
  };
}

function buildChoicePrompt(unit: KnowledgeUnit): string {
  const title = cleanText(unit.title).replace(/[？?，,。；;：:]+$/u, "");
  const context = unit.categoryPath.at(-1);
  const prefix =
    context && context !== title && !/^sheet\d*$/iu.test(context)
      ? `关于“${cleanText(context)}”，`
      : "";

  return `${prefix}${title}的正确答案是什么？`;
}

function pickDistractors(
  unit: KnowledgeUnit,
  pool: KnowledgeUnit[],
  count: number,
): KnowledgeUnit[] {
  const correct = cleanText(unit.content);
  const candidates = uniqueByContent(
    pool
    .filter(
      (candidate) =>
        candidate.id !== unit.id && cleanText(candidate.content) !== correct,
    )
    .toSorted((left, right) => {
      const leftMatch = mapCategory(left) === mapCategory(unit) ? 0 : 1;
      const rightMatch = mapCategory(right) === mapCategory(unit) ? 0 : 1;
      return leftMatch - rightMatch || left.id.localeCompare(right.id);
    }),
  );

  if (candidates.length < count) {
    throw new Error(`知识单元 ${unit.id} 缺少可用干扰项。`);
  }

  const offset = Number.parseInt(digest(`${unit.id}:distractors`).slice(0, 8), 16);
  return Array.from(
    { length: count },
    (_, index) => candidates[(offset + index) % candidates.length]!,
  );
}

function uniqueByContent(units: KnowledgeUnit[]): KnowledgeUnit[] {
  const seen = new Set<string>();
  return units.filter((unit) => {
    const content = cleanText(unit.content);
    if (seen.has(content)) {
      return false;
    }
    seen.add(content);
    return true;
  });
}

function selectAcrossCategories(
  units: KnowledgeUnit[],
  count: number,
): KnowledgeUnit[] {
  const buckets = new Map<string, KnowledgeUnit[]>();
  for (const category of QUESTION_CATEGORIES) {
    buckets.set(category, []);
  }
  for (const unit of units) {
    buckets.get(mapCategory(unit))?.push(unit);
  }

  const selected: KnowledgeUnit[] = [];
  while (selected.length < count) {
    let added = false;
    for (const category of QUESTION_CATEGORIES) {
      const candidate = buckets.get(category)?.shift();
      if (candidate) {
        selected.push(candidate);
        added = true;
        if (selected.length === count) {
          break;
        }
      }
    }
    if (!added) {
      break;
    }
  }
  return selected;
}

function isReviewable(
  unit: KnowledgeUnit,
  conflictLocators: Set<string>,
): boolean {
  const title = cleanText(unit.title);
  const content = cleanText(unit.content);
  return (
    title.length >= 3 &&
    title.length <= 100 &&
    content.length >= 2 &&
    content.length <= 220 &&
    title !== content &&
    !/^https?:\/\//iu.test(title) &&
    !unit.sources.some((source) =>
      conflictLocators.has(locatorKey(source)),
    )
  );
}

function collectConflictLocators(knowledge: KnowledgePack): Set<string> {
  return new Set(
    knowledge.issues
      .filter((issue) => issue.code === "conflict")
      .flatMap((issue) => issue.sources)
      .map(locatorKey),
  );
}

function locatorKey(source: SourceLocator): string {
  return [
    source.sourcePath,
    source.anchor,
    source.sheet ?? "",
    source.row ?? "",
    source.line ?? "",
    source.nodeId ?? "",
  ].join("|");
}

function compareCandidates(left: KnowledgeUnit, right: KnowledgeUnit): number {
  const semanticPriority =
    Number(Boolean(right.semanticKey)) - Number(Boolean(left.semanticKey));
  return (
    semanticPriority ||
    mapCategory(left).localeCompare(mapCategory(right), "zh-CN") ||
    left.id.localeCompare(right.id)
  );
}

export function mapCategory(unit: KnowledgeUnit): string {
  const value = `${unit.categoryPath.join(" ")} ${unit.title}`;
  if (/病理|生理|喂养|年龄|幼猫|幼犬|肠胃|软便|换粮/u.test(value)) {
    return "宠物生理和喂养";
  }
  if (/活动|优惠|价格|赠品|促销|议价/u.test(value)) {
    return "活动促销";
  }
  if (/客服|服务|流程|售后|客诉|物流|破损|道歉|接待|场景/u.test(value)) {
    return "服务流程与规则";
  }
  if (/产品|主粮|猫粮|狗粮|犬粮|冻干|罐头|零食|成分|含量|口味/u.test(value)) {
    return "产品属性及卖点";
  }
  return "日常问答";
}

function stableShuffle<T>(items: T[], seed: string): T[] {
  return items.toSorted((left, right) =>
    digest(`${seed}:${String(left)}`).localeCompare(
      digest(`${seed}:${String(right)}`),
    ),
  );
}

function questionId(
  packHash: string,
  unitId: string,
  type: QuizQuestionDraft["type"],
): string {
  return `qq_${digest(`${packHash}:${unitId}:${type}`).slice(0, 24)}`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function digest(value: unknown): string {
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(serialized).digest("hex");
}
