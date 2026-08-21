import { describe, expect, it } from "vitest";

import { scenarioTemplates } from "./templates";

describe("scenarioTemplates", () => {
  it("provides nine published mock scenarios across the required categories", () => {
    expect(scenarioTemplates).toHaveLength(9);
    expect(
      Object.fromEntries(
        ["presale", "logistics", "damage_shortage", "complaint"].map(
          (category) => [
            category,
            scenarioTemplates.filter(
              (scenario) => scenario.category === category,
            ).length,
          ],
        ),
      ),
    ).toEqual({
      presale: 3,
      logistics: 2,
      damage_shortage: 2,
      complaint: 2,
    });
    expect(new Set(scenarioTemplates.map((scenario) => scenario.id)).size).toBe(
      9,
    );
    expect(
      scenarioTemplates.every(
        (scenario) =>
          scenario.status === "published" && scenario.mockMode === true,
      ),
    ).toBe(true);
  });

  it("defines the sensitive British Shorthair presale flow with traceable safety checks", () => {
    const scenario = scenarioTemplates.find(
      (template) => template.title === "6 个月肠胃敏感英短选粮",
    );

    expect(scenario).toBeDefined();
    expect(scenario).toMatchObject({
      category: "presale",
      status: "published",
      mockMode: true,
    });
    expect(scenario?.hiddenFacts.join(" ")).toMatch(
      /6个月.*英短.*体重.*当前主粮.*软便.*精神.*食欲.*呕吐.*便血/,
    );
    expect(scenario?.customerTurns.join(" ")).toMatch(
      /体重.*当前.*软便.*精神.*食欲.*呕吐.*便血/,
    );
    expect(scenario?.referenceFlow.join(" ")).toMatch(
      /年龄.*体重.*当前主粮.*软便持续时间.*精神食欲.*伴随症状.*7天.*少量多餐.*观察.*持续软便.*呕吐.*便血.*精神差.*就医.*后续跟进/,
    );
    expect(scenario?.referenceReply).toMatch(
      /霸弗烘焙粮.*鸡肉.*7天.*少量多餐.*观察.*持续软便.*呕吐.*便血.*精神.*就医/,
    );
    expect(scenario?.referenceReply).not.toMatch(
      /保证|治愈|一定改善|7天改善软便/,
    );
    expect(scenario?.criticalRisks.flatMap((risk) => risk.patterns)).toEqual(
      expect.arrayContaining(["保证不软便", "7天治好", "不用就医"]),
    );
    expect(scenario?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourcePath: "销售场景.md", anchor: "霸弗烘焙软便" }),
        expect.objectContaining({ sourcePath: "销售场景.md", anchor: "7天过渡法" }),
        expect.objectContaining({ sourcePath: "客服服务流程.md", anchor: "软便便血" }),
        expect.objectContaining({ sourcePath: "售前_客诉接待问题划分.xlsx", anchor: "严重症状升级" }),
      ]),
    );
  });

  it("keeps hidden facts, dialogue, scoring and sources complete", () => {
    for (const scenario of scenarioTemplates) {
      expect(scenario.hiddenFacts.length).toBeGreaterThanOrEqual(3);
      expect(scenario.customerTurns.length).toBeGreaterThanOrEqual(3);
      expect(scenario.scoringDimensions).toHaveLength(5);
      expect(
        scenario.scoringDimensions.reduce(
          (total, dimension) => total + dimension.weight,
          0,
        ),
      ).toBe(100);
      expect(
        scenario.scoringDimensions.every(
          (dimension) => dimension.signals.length >= 2,
        ),
      ).toBe(true);
      expect(scenario.criticalRisks.length).toBeGreaterThanOrEqual(2);
      expect(scenario.referenceFlow.length).toBeGreaterThanOrEqual(4);
      expect(scenario.sources.length).toBeGreaterThanOrEqual(1);
      expect(scenario.maxTurns).toBeGreaterThanOrEqual(8);
      expect(scenario.maxTurns).toBeLessThanOrEqual(16);
    }
  });
});
