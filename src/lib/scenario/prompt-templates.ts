import type { KnowledgeUnit } from "@/lib/knowledge/schema";
import type {
  CustomerPersona,
  ScenarioCategory,
  ScenarioTemplate,
} from "./schema";

const personaDescription: Record<
  CustomerPersona["temperament"],
  string
> = {
  calm: "性格平和，说话有条理，不会催促客服，愿意配合提问。",
  anxious: "性格焦虑，说话会重复确认，担心买错或出问题，会追问细节。",
  irritable: "性格急躁，说话简短直接，容易不耐烦，会用反问句施压。",
  bargain_hunting: "价格敏感，喜欢对比多家店铺，会讨价还价、索要赠品和优惠。",
};

const knowledgeLevelDescription: Record<
  CustomerPersona["knowledgeLevel"],
  string
> = {
  low: "对宠物食品几乎不了解，提问基础，容易被专业术语绕晕。",
  medium: "有一些养宠经验，知道基本概念但不懂深层知识。",
  high: "资深养宠人士，会问专业问题，对成分和配方有要求。",
};

const defaultPersonaByCategory: Record<ScenarioCategory, CustomerPersona> = {
  presale: {
    temperament: "calm",
    knowledgeLevel: "medium",
    mood: "想为宠物选一款合适的产品，有预算意识。",
  },
  logistics: {
    temperament: "anxious",
    knowledgeLevel: "low",
    mood: "担心包裹延误或丢失，希望尽快解决。",
  },
  damage_shortage: {
    temperament: "irritable",
    knowledgeLevel: "low",
    mood: "收到问题商品感到不满，要求明确解决方案。",
  },
  complaint: {
    temperament: "anxious",
    knowledgeLevel: "medium",
    mood: "宠物出现健康问题，焦虑且可能归咎产品。",
  },
};

function resolvePersona(scenario: ScenarioTemplate): CustomerPersona {
  return scenario.customerPersona ?? defaultPersonaByCategory[scenario.category];
}

function formatKnowledgeUnits(units: KnowledgeUnit[]): string {
  if (units.length === 0) {
    return "（本场景无附加知识库内容，顾客仅基于隐藏事实对话。）";
  }
  return units
    .map(
      (unit, index) =>
        `### 知识片段 ${index + 1}：${unit.title}\n${unit.content}`,
    )
    .join("\n\n");
}

export function buildConversationSystemPrompt(
  scenario: ScenarioTemplate,
  knowledgeUnits: KnowledgeUnit[] = [],
): string {
  const persona = resolvePersona(scenario);
  return [
    "你正在模拟一位宠物食品电商客服场景中的顾客，需要与客服（学员）进行多轮对话。",
    "",
    `## 场景信息`,
    `场景标题：${scenario.title}`,
    `场景背景：${scenario.summary}`,
    `场景类别：${scenario.category}`,
    "",
    `## 你的角色设定`,
    `性格倾向：${personaDescription[persona.temperament]}`,
    `知识水平：${knowledgeLevelDescription[persona.knowledgeLevel]}`,
    `当前情绪：${persona.mood}`,
    "",
    "## 你已知的信息（隐藏事实）",
    "客服需要通过对话挖掘以下信息。你不能主动一次性全部透露，要像真实顾客一样，只在客服问到相关问题时才回答：",
    ...scenario.hiddenFacts.map((fact, index) => `${index + 1}. ${fact}`),
    "",
    "## 你的知识背景（基于知识库）",
    "以下是你作为顾客了解到的产品/规则信息。你可以基于这些信息提出真实疑问（如对比价格、询问活动、质疑规则），但不要像客服一样复述知识：",
    formatKnowledgeUnits(knowledgeUnits),
    "",
    "## 多轮对话策略",
    `1. 当前是对话的第 N 轮（由客服回复数推算），总共约 ${scenario.maxTurns} 轮。`,
    "2. 每轮最多透露 1 条隐藏事实，不要主动倾倒所有信息。",
    "3. 客服没问到的信息不要主动说，但可以基于你的知识背景提出新的疑问或顾虑。",
    "4. 如果客服问到你不知道的信息，就说不知道或含糊回应，不要编造。",
    "5. 允许基于知识库提出真实顾客常见的疑问（如「别家更便宜」、「能不能送赠品」、「之前吃的拉肚子」等）。",
    "",
    "## 对话规则",
    "1. 每次只回复一条消息，口语化，符合真实顾客的说话方式。",
    "2. 不要使用客服术语或专业表达，保持普通顾客的口吻。",
    "3. 不要主动结束对话，除非客服明确表示对话结束。",
    "4. 不要透露你是被模拟的，始终保持在角色内。",
    `5. 根据你的性格倾向调整说话方式：${personaDescription[persona.temperament]}`,
  ].join("\n");
}

export function buildConversationUserPrompt(
  messages: Array<{ role: string; content: string }>,
): string {
  const transcript = messages
    .map((message) => `${message.role === "customer" ? "顾客" : "客服"}：${message.content}`)
    .join("\n");
  return [
    "以下是到目前为止的对话记录：",
    transcript,
    "",
    "请作为顾客回复客服的最新消息。只输出顾客的回复内容，不要包含角色前缀或解释。",
  ].join("\n");
}

function buildFewShotExamples(scenario: ScenarioTemplate): string {
  return [
    "## 评分示例（few-shot）",
    "",
    "### 好回复示例（参考回复）",
    `客服回复：${scenario.referenceReply}`,
    `特点：该回复覆盖了多个评分维度的信号词，未触发任何关键风险，体现了专业和同理心。`,
    "",
    "### 差回复示例（反面案例）",
    `客服回复：亲，放心吧，我们家粮肯定不会软便的，保证治好！现在下单就送你一堆赠品！`,
    `特点：触发"绝对化产品承诺"和"虚构优惠或赠品"等关键风险，应判为 needs_retry。`,
    "",
    "请参考以上示例校准你的评分尺度。",
  ].join("\n");
}

export function buildEvaluationSystemPrompt(
  scenario: ScenarioTemplate,
): string {
  return [
    "你是一位资深宠物食品电商客服培训专家，需要评估学员在模拟对话中的表现。",
    "",
    `## 场景信息`,
    `场景标题：${scenario.title}`,
    `场景背景：${scenario.summary}`,
    "",
    "## 评分维度（每维有权重，总分100）",
    ...scenario.scoringDimensions.map(
      (dimension) =>
        `- ${dimension.name}（权重${dimension.weight}）：识别信号 ${dimension.signals.join("、")}`,
    ),
    "",
    "## 关键风险（命中任意一项即不通过）",
    ...scenario.criticalRisks.map(
      (risk) => `- ${risk.label}：匹配模式 ${risk.patterns.join("、")}`,
    ),
    "",
    "## 参考处理流程",
    ...scenario.referenceFlow.map((step, index) => `${index + 1}. ${step}`),
    "",
    `## 参考回复`,
    scenario.referenceReply,
    "",
    buildFewShotExamples(scenario),
    "",
    "## 评分流程（请在内部逐步推理，最终输出 JSON）",
    "1. **逐轮分析**：先在内部对学员的每一轮回复做分析——命中了哪些信号词、是否触发关键风险、遗漏了什么。这一步在内部完成，不需要输出到 JSON。",
    "2. **维度评分**：基于逐轮分析，为每个评分维度打分（0到权重值）。命中信号词或表达出对应意图即给分，evidence 列出命中的信号词（最多2个）。",
    "3. **汇总**：totalScore 为各维度得分之和。status 为 passed 当且仅当 totalScore>=80 且无关键风险命中。",
    "4. **置信度**：confidence 为你对本次评分的自信程度（0到1）。信息不足、对话太短、或评分模糊时降低。",
    "5. **改进建议**：recommendations 每条必须是话术级建议，包含 issue（具体问题）和 suggestedReply（推荐的客服回复话术），而非抽象建议。",
    "",
    "## 输出 JSON 格式",
    '请以 JSON 对象输出，字段如下：',
    "- mode: 固定为 \"real\"",
    "- totalScore: 0-100 整数",
    "- status: \"passed\" 或 \"needs_retry\"",
    "- confidence: 0-1 浮点数",
    "- dimensions: [{name, score, maxScore, evidence[]}]（5个维度）",
    "- strengths[]: 得分率>=80%的维度名",
    "- missedSteps[]: 得分率<80%的维度名",
    "- risks[]: 命中的关键风险 label",
    '- recommendations: [{issue, suggestedReply}]（话术级改进建议，每条含具体问题和推荐回复）',
    "- lowConfidence: boolean（confidence<0.6 或学员消息<3轮时为 true）",
  ].join("\n");
}

export function buildEvaluationUserPrompt(
  learnerMessages: string[],
): string {
  return [
    "以下是学员在对话中的所有回复（按时间顺序）：",
    ...learnerMessages.map((message, index) => `${index + 1}. ${message}`),
    "",
    `共 ${learnerMessages.length} 轮回复。请按评分流程逐轮分析后，输出 JSON 评估结果。`,
  ].join("\n");
}

export function buildLiveRiskPrompt(
  scenario: ScenarioTemplate,
  learnerMessage: string,
): { system: string; user: string } {
  const system = [
    "你是宠物食品电商客服训练的事中风控助手。学员刚在模拟对话中发出一条回复，请快速判断是否触发关键风险。",
    "",
    "## 场景已声明的关键风险",
    ...scenario.criticalRisks.map(
      (risk) =>
        `- ${risk.label}：典型表现 ${risk.patterns.join("、")}`,
    ),
    "",
    "## 通用风险类型（任何场景都要检测）",
    "- 绝对化产品承诺：保证治愈、一定不会软便、肯定有效、绝对安全等",
    "- 虚构优惠或赠品：编造不存在的活动、价格、赠品或物流承诺",
    "- 攻击性语言：辱骂、贬低、嘲讽、威胁顾客",
    "- 泄露内部信息：透露内部考核、对顾客不利的内部规则或话术",
    "",
    "## 输出 JSON 格式",
    '- 命中风险：{"riskLabel": "<风险名，简短>", "suggestion": "<建议改用的话术或处理方式，1-2句>", "severity": "warning" | "danger"}',
    "- severity=warning：存在风险但可纠正；severity=danger：严重违规（辱骂、绝对承诺治愈、虚构优惠等）",
    '- 未命中任何风险：返回 JSON null',
    "- 只输出 JSON，不要解释。",
  ].join("\n");
  const user = `学员回复：${learnerMessage}`;
  return { system, user };
}
