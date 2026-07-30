import type {
  ScenarioCategory,
  ScenarioTemplate,
} from "./schema";
import { scenarioTemplatesSchema } from "./schema";

type TemplateInput = Omit<
  ScenarioTemplate,
  | "versionId"
  | "scoringDimensions"
  | "criticalRisks"
  | "referenceFlow"
  | "maxTurns"
  | "status"
  | "mockMode"
>;

const versionIds = ["a", "b", "c", "d", "e", "f", "0", "9"];

const categoryRules: Record<
  ScenarioCategory,
  Pick<
    ScenarioTemplate,
    "scoringDimensions" | "criticalRisks" | "referenceFlow"
  >
> = {
  presale: {
    scoringDimensions: [
      {
        name: "需求与宠物信息挖掘",
        weight: 25,
        signals: ["年龄", "品种", "体重", "预算", "饮食"],
      },
      {
        name: "场景化卖点表达",
        weight: 20,
        signals: ["适合", "因为", "卖点", "需求"],
      },
      {
        name: "产品及宠物知识准确",
        weight: 20,
        signals: ["主粮", "换粮", "喂食", "肠胃"],
      },
      {
        name: "异议处理与替代价值",
        weight: 20,
        signals: ["理解", "价格", "活动", "价值"],
      },
      {
        name: "关联推荐及跟单闭环",
        weight: 15,
        signals: ["搭配", "推荐", "后续", "确认"],
      },
    ],
    criticalRisks: [
      {
        label: "虚构优惠或赠品",
        patterns: ["保证送", "随便赔", "一定赠送"],
      },
      {
        label: "绝对化产品承诺",
        patterns: ["保证不软便", "百分百有效", "一定治好"],
      },
    ],
    referenceFlow: [
      "确认宠物年龄、品种、体重和当前饮食",
      "了解健康情况、核心诉求与预算",
      "用需求对应产品卖点",
      "处理价格或活动异议",
      "完成关联推荐并确认下一步",
    ],
  },
  logistics: {
    scoringDimensions: [
      {
        name: "订单及物流信息确认",
        weight: 20,
        signals: ["订单", "单号", "地址", "物流"],
      },
      {
        name: "规则准确性",
        weight: 25,
        signals: ["核实", "规则", "签收", "拦截"],
      },
      {
        name: "处理路径正确性",
        weight: 25,
        signals: ["联系", "快递", "工单", "反馈"],
      },
      {
        name: "时效说明与沟通体验",
        weight: 15,
        signals: ["理解", "抱歉", "预计", "进度"],
      },
      {
        name: "明确下一步及闭环",
        weight: 15,
        signals: ["下一步", "跟进", "回复", "确认"],
      },
    ],
    criticalRisks: [
      {
        label: "虚构物流时效",
        patterns: ["保证今天到", "百分百明天到", "肯定能拦截"],
      },
      {
        label: "未核实直接赔付",
        patterns: ["不用核实直接赔", "马上全额赔偿"],
      },
    ],
    referenceFlow: [
      "确认订单号、收件信息和物流节点",
      "区分在途、拦截或签收异常",
      "按规则联系快递或创建工单",
      "说明合理时效而非作绝对承诺",
      "约定反馈节点并持续跟进",
    ],
  },
  damage_shortage: {
    scoringDimensions: [
      {
        name: "凭证收集",
        weight: 20,
        signals: ["照片", "视频", "面单", "订单"],
      },
      {
        name: "仓库快递及责任判断",
        weight: 20,
        signals: ["仓库", "快递", "核实", "责任"],
      },
      {
        name: "问题类型判断",
        weight: 20,
        signals: ["错发", "漏发", "破损", "外箱"],
      },
      {
        name: "解决及赔偿方案",
        weight: 25,
        signals: ["补发", "售后", "方案", "处理"],
      },
      {
        name: "情绪安抚和闭环",
        weight: 15,
        signals: ["抱歉", "理解", "跟进", "确认"],
      },
    ],
    criticalRisks: [
      {
        label: "未经核实承诺赔偿",
        patterns: ["随便赔", "直接双倍赔", "不用凭证"],
      },
      {
        label: "要求顾客承担内部核查",
        patterns: ["你自己找仓库", "你自己联系供应商"],
      },
    ],
    referenceFlow: [
      "确认订单和具体异常类型",
      "收集面单、外箱、商品及开箱凭证",
      "判断仓库、快递和问题责任路径",
      "按规则给出补发或售后方案",
      "确认顾客接受并说明跟进节点",
    ],
  },
  complaint: {
    scoringDimensions: [
      {
        name: "宠物喂食及产品信息收集",
        weight: 20,
        signals: ["年龄", "体重", "喂食", "产品"],
      },
      {
        name: "情绪接纳和同理心",
        weight: 20,
        signals: ["理解", "担心", "抱歉", "着急"],
      },
      {
        name: "健康风险识别",
        weight: 25,
        signals: ["症状", "持续", "精神", "就医"],
      },
      {
        name: "解决方案及升级判断",
        weight: 20,
        signals: ["停喂", "观察", "升级", "售后"],
      },
      {
        name: "诉求确认和明确完结",
        weight: 15,
        signals: ["诉求", "确认", "跟进", "回复"],
      },
    ],
    criticalRisks: [
      {
        label: "越界健康诊断",
        patterns: ["肯定是肠炎", "一定没问题", "不用看医生"],
      },
      {
        label: "危险喂养建议",
        patterns: ["继续加量", "强行喂", "不用停喂"],
      },
    ],
    referenceFlow: [
      "接纳情绪并确认宠物和产品信息",
      "了解喂食时间、用量和具体症状",
      "识别紧急风险并避免确定性诊断",
      "给出停喂观察、就医或升级路径",
      "确认顾客诉求和后续跟进节点",
    ],
  },
};

const inputs: TemplateInput[] = [
  {
    id: `st_${"1".repeat(24)}`,
    title: "给3个月泰迪推荐主粮",
    category: "presale",
    summary: "根据幼犬情况和预算完成主粮推荐与关联建议。",
    openingMessage: "我家泰迪刚满3个月，想换一款主粮，有推荐吗？",
    hiddenFacts: ["体重2.1kg", "当前吃泡软粮", "预算每月约200元"],
    customerTurns: [
      "体重大概2.1公斤，现在的粮会泡软再喂。",
      "肠胃还可以，但偶尔会软便，我有点担心换粮。",
      "预算一个月两百左右，还需要搭配其他东西吗？",
    ],
    referenceReply:
      "理解您担心幼犬换粮后肠胃不适。可以先确认当前主粮和软便频率，再按7天换粮法逐步过渡，并结合预算推荐适龄主粮；搭配产品只在确有需要时说明。",
    sources: [
      source("销售场景.md", "h:销售场景/正确推荐产品"),
    ],
  },
  {
    id: `st_${"2".repeat(24)}`,
    title: "处理价格和赠品异议",
    category: "presale",
    summary: "回应价格顾虑，解释价值并设置后续跟进。",
    openingMessage: "你家这个粮比别家贵，能不能便宜点再多送点？",
    hiddenFacts: ["顾客养成年猫", "重视适口性", "正在对比两家店"],
    customerTurns: [
      "是一只4岁的英短，之前买的粮它不太爱吃。",
      "我主要怕买回去又浪费，所以才想要赠品。",
      "如果没有更低价格，你能说明一下为什么值得买吗？",
    ],
    referenceReply:
      "理解您担心适口性和浪费。先确认猫咪当前饮食，再说明与需求相关的产品特点，并只介绍当前有效活动；如需考虑，可约定后续跟进。",
    sources: [
      source(
        "销售场景.md",
        "h:销售场景/客户谈价格，怎么正确回应",
      ),
    ],
  },
  {
    id: `st_${"3".repeat(24)}`,
    title: "物流长时间未更新",
    category: "logistics",
    summary: "核实在途物流节点并给出可追踪的处理路径。",
    openingMessage: "我的快递三天没动了，到底什么时候能到？",
    hiddenFacts: ["订单已发货", "最后节点为转运中心", "顾客后天出差"],
    customerTurns: [
      "订单号我可以发，物流最后显示在转运中心。",
      "我后天就出差了，能保证明天送到吗？",
      "如果明天不到，你们接下来准备怎么处理？",
    ],
    referenceReply:
      "先核实订单号和最后物流节点，再联系快递查询。不能保证具体到达时间，但会说明预计反馈节点，并在异常确认后按流程继续处理。",
    sources: [source("销售场景.md", "h:销售场景/正确跟单")],
  },
  {
    id: `st_${"4".repeat(24)}`,
    title: "修改地址与拦截",
    category: "logistics",
    summary: "判断订单状态并处理地址修改或快递拦截。",
    openingMessage: "地址填错了，马上帮我改一下，别寄到原地址。",
    hiddenFacts: ["订单已出库", "新旧地址同城", "顾客尚未联系快递"],
    customerTurns: [
      "订单已经显示出库了，新地址和原地址在同一个城市。",
      "我还没联系快递，你们这边能直接改成功吗？",
      "要是拦截失败，我还能做什么？",
    ],
    referenceReply:
      "先确认订单和物流状态，再按规则尝试联系快递拦截或改址，但不承诺一定成功；同时说明失败后的签收协调路径和跟进节点。",
    sources: [source("销售场景.md", "h:销售场景/正确跟单")],
  },
  {
    id: `st_${"5".repeat(24)}`,
    title: "错发或漏发商品",
    category: "damage_shortage",
    summary: "收集必要凭证并判断错发、漏发处理路径。",
    openingMessage: "我买了两袋猫粮，箱子里怎么只有一袋？",
    hiddenFacts: ["外箱完整", "面单重量可见", "顾客保留了开箱视频"],
    customerTurns: [
      "外箱看着是完整的，快递面单也还在。",
      "我有开箱视频，需要拍哪些位置给你？",
      "核实以后是补发还是退款？大概怎么跟进？",
    ],
    referenceReply:
      "先核对订单明细，再收集外箱、面单、箱内商品和开箱视频；完成仓库核查后按规则提供补发或售后方案，并说明反馈节点。",
    sources: [
      excelSource(
        "售前_客诉接待问题划分. xlsx",
        37,
        "缺斤少量（包装无破损，重量不足）",
      ),
    ],
  },
  {
    id: `st_${"6".repeat(24)}`,
    title: "包装和产品破损",
    category: "damage_shortage",
    summary: "区分外箱与商品破损并给出合规解决方案。",
    openingMessage: "收到的罐头箱子都压扁了，还有两罐漏液，怎么办？",
    hiddenFacts: ["外箱明显受压", "两罐漏液", "其余罐头外观正常"],
    customerTurns: [
      "外箱有明显挤压，两罐在漏液，其他看起来正常。",
      "我应该拍外箱、面单还是每一罐都拍？",
      "没漏的那些还能不能留，漏的两罐怎么处理？",
    ],
    referenceReply:
      "先安抚并确认破损范围，收集外箱、面单和商品照片；提醒不要喂食漏液产品，再按核实结果提供补发或售后方案。",
    sources: [
      excelSource(
        "售前_客诉接待问题划分. xlsx",
        22,
        "包装破损/包装变形/包装不规则",
      ),
    ],
  },
  {
    id: `st_${"7".repeat(24)}`,
    title: "宠物突然拒食",
    category: "complaint",
    summary: "了解拒食背景，区分适口性与潜在健康风险。",
    openingMessage: "新粮吃了两天，今天突然一口都不吃，是不是粮有问题？",
    hiddenFacts: ["成年猫", "换粮未过渡", "精神状态暂时正常"],
    customerTurns: [
      "是3岁的猫，换粮时直接全换了，没有慢慢过渡。",
      "目前精神还正常，也会喝水，就是不肯吃这个粮。",
      "那我现在是换回旧粮，还是继续让它适应？",
    ],
    referenceReply:
      "理解您担心猫咪突然拒食。先确认换粮方式、精神状态和其他症状，避免直接判断产品问题；可按情况调整过渡，并在持续拒食或状态异常时及时就医。",
    sources: [
      excelSource(
        "售前_客诉接待问题划分. xlsx",
        1,
        "不吃（退货运费）",
      ),
    ],
  },
  {
    id: `st_${"8".repeat(24)}`,
    title: "食用后呕吐软便",
    category: "complaint",
    summary: "识别健康风险，避免越界诊断并完成客诉升级。",
    openingMessage: "狗狗吃完你们的粮又吐又拉，是不是中毒了？",
    hiddenFacts: ["幼犬", "首次喂食量较大", "已连续呕吐两次"],
    customerTurns: [
      "是5个月幼犬，第一次喂就给了满满一碗。",
      "已经吐了两次，还有点没精神，我现在很着急。",
      "你能不能直接告诉我是不是这个粮导致的？",
    ],
    referenceReply:
      "先接纳顾客情绪并确认宠物、喂食量、症状和持续时间。不能做确定性诊断；出现连续呕吐和精神不佳时应建议停止喂食并及时就医，同时按客诉流程升级跟进。",
    sources: [
      excelSource(
        "售前_客诉接待问题划分. xlsx",
        5,
        "食后呕吐腹泻",
      ),
    ],
  },
];

export const scenarioTemplates = scenarioTemplatesSchema.parse(
  inputs.map((input, index) => ({
    ...input,
    versionId: `sv_${versionIds[index].repeat(24)}`,
    ...categoryRules[input.category],
    maxTurns: 12,
    status: "published",
    mockMode: true,
  })),
);

export function getScenarioTemplate(
  scenarioId: string,
): ScenarioTemplate | undefined {
  return scenarioTemplates.find((scenario) => scenario.id === scenarioId);
}

function source(sourcePath: string, anchor: string) {
  return {
    sourcePath,
    kind: "markdown" as const,
    anchor,
    path: anchor.replace(/^h:/u, "").split("/"),
  };
}

function excelSource(
  sourcePath: string,
  row: number,
  title: string,
) {
  return {
    sourcePath,
    kind: "excel" as const,
    anchor: `sheet:Sheet1/row:${row}`,
    sheet: "Sheet1",
    row,
    path: ["Sheet1", title],
  };
}
