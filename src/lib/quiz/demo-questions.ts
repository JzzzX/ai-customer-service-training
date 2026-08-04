import type { QuizQuestionDraft } from "./schema";

const demoSource = {
  sourcePath: "交互演示题（非正式知识）",
  kind: "markdown" as const,
  anchor: "demo",
  path: ["交互演示"],
};

export const demoQuizQuestions: QuizQuestionDraft[] = [
  {
    id: "qq_111111111111111111111111",
    knowledgeUnitId: "ku_111111111111111111111111",
    type: "single_choice",
    prompt: "顾客首次咨询幼宠主粮时，客服应优先确认什么？",
    options: [
      "宠物年龄和当前饮食情况",
      "顾客常用的快递公司",
      "顾客手机的品牌",
      "顾客上次登录时间",
    ],
    correctAnswers: ["宠物年龄和当前饮食情况"],
    explanation:
      "先了解宠物年龄、品种、健康与当前饮食，才能做有依据的产品建议。",
    category: "宠物生理和喂养",
    difficulty: "easy",
    status: "draft",
    sources: [demoSource],
  },
  {
    id: "qq_222222222222222222222222",
    knowledgeUnitId: "ku_222222222222222222222222",
    type: "true_false",
    prompt: "顾客提出价格异议时，只回复“这是最低价”即可结束沟通。",
    options: ["正确", "错误"],
    correctAnswers: ["错误"],
    explanation:
      "应先理解预算顾虑，再解释产品价值，并在规则内提供活动、赠品或后续跟进方案。",
    category: "活动促销",
    difficulty: "easy",
    status: "draft",
    sources: [demoSource],
  },
  {
    id: "qq_333333333333333333333333",
    knowledgeUnitId: "ku_333333333333333333333333",
    type: "single_choice",
    prompt: "处理破损或少货问题时，第一步更合适的是？",
    options: [
      "确认订单与问题并收集必要凭证",
      "立即承诺任意金额赔偿",
      "让顾客自行联系仓库",
      "不核实直接结束会话",
    ],
    correctAnswers: ["确认订单与问题并收集必要凭证"],
    explanation:
      "先确认具体问题、订单和必要凭证，再按对应流程判断补寄或售后方案。",
    category: "服务流程与规则",
    difficulty: "easy",
    status: "draft",
    sources: [demoSource],
  },
  {
    id: "qq_444444444444444444444444",
    knowledgeUnitId: "ku_444444444444444444444444",
    type: "true_false",
    prompt: "推荐产品时，应把产品卖点与顾客已经表达的需求联系起来。",
    options: ["正确", "错误"],
    correctAnswers: ["正确"],
    explanation:
      "卖点只有对应顾客的宠物情况和顾虑，才容易被理解并产生实际价值。",
    category: "产品属性及卖点",
    difficulty: "easy",
    status: "draft",
    sources: [demoSource],
  },
  {
    id: "qq_555555555555555555555555",
    knowledgeUnitId: "ku_555555555555555555555555",
    type: "single_choice",
    prompt: "顾客反馈宠物食用后出现明显不适时，更稳妥的处理方式是？",
    options: [
      "先了解症状和时间，必要时建议及时就医并按客诉流程处理",
      "直接判断一定与产品无关",
      "仅重复发送产品卖点",
      "建议继续加量观察",
    ],
    correctAnswers: [
      "先了解症状和时间，必要时建议及时就医并按客诉流程处理",
    ],
    explanation:
      "健康风险场景应优先收集关键信息、避免武断诊断，并在需要时建议专业医疗帮助。",
    category: "日常问答",
    difficulty: "easy",
    status: "draft",
    sources: [demoSource],
  },
];
