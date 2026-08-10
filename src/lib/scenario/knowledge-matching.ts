import type { KnowledgeUnit } from "@/lib/knowledge/schema";
import type { ScenarioCategory } from "./schema";

const categoryKeywords: Record<ScenarioCategory, string[]> = {
  presale: [
    "售前",
    "销售",
    "推荐",
    "产品",
    "卖点",
    "价格",
    "活动",
    "换粮",
    "主粮",
    "适口性",
    "预算",
    "品种",
    "年龄",
    "零食",
    "营养",
  ],
  logistics: [
    "物流",
    "快递",
    "发货",
    "运输",
    "在途",
    "签收",
    "拦截",
    "地址",
    "订单",
    "转运",
    "时效",
    "改址",
    "节点",
  ],
  damage_shortage: [
    "破损",
    "少货",
    "漏发",
    "错发",
    "包装",
    "面单",
    "仓库",
    "补发",
    "售后",
    "外箱",
    "漏液",
    "凭证",
    "开箱",
  ],
  complaint: [
    "客诉",
    "投诉",
    "呕吐",
    "腹泻",
    "健康",
    "症状",
    "就医",
    "停喂",
    "拒食",
    "适口性",
    "肠胃",
    "精神",
    "升级",
    "过敏",
  ],
};

export function selectKnowledgeUnitsForCategory(
  units: KnowledgeUnit[],
  category: ScenarioCategory,
  limit = 5,
): KnowledgeUnit[] {
  const keywords = categoryKeywords[category];
  const scored = units.map((unit) => {
    const haystack = [
      unit.title,
      unit.content,
      unit.categoryPath.join("/"),
      unit.semanticKey ?? "",
    ].join("\n");
    const hits = keywords.reduce(
      (count, keyword) =>
        haystack.includes(keyword) ? count + 1 : count,
      0,
    );
    return { unit, hits };
  });
  return scored
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((entry) => entry.unit);
}
