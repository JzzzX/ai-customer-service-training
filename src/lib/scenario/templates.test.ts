import { describe, expect, it } from "vitest";

import { scenarioTemplates } from "./templates";

describe("scenarioTemplates", () => {
  it("provides two published mock scenarios for each required category", () => {
    expect(scenarioTemplates).toHaveLength(8);
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
      presale: 2,
      logistics: 2,
      damage_shortage: 2,
      complaint: 2,
    });
    expect(new Set(scenarioTemplates.map((scenario) => scenario.id)).size).toBe(
      8,
    );
    expect(
      scenarioTemplates.every(
        (scenario) =>
          scenario.status === "published" && scenario.mockMode === true,
      ),
    ).toBe(true);
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
