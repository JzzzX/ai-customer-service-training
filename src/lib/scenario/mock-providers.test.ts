import { describe, expect, it } from "vitest";

import {
  MockConversationProvider,
  MockEvaluationProvider,
} from "./mock-providers";
import { scenarioTemplates } from "./templates";

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("MockConversationProvider", () => {
  it("streams the scripted customer turn deterministically", async () => {
    const scenario = scenarioTemplates[0];
    const provider = new MockConversationProvider();

    const first = await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 0,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          {
            role: "learner",
            content: "想先了解一下狗狗的体重和现在怎么喂。",
          },
        ],
      }),
    );
    const second = await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 0,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          {
            role: "learner",
            content: "完全不同的学员回复也不改变Mock脚本。",
          },
        ],
      }),
    );

    expect(first.length).toBeGreaterThan(1);
    expect(first.join("")).toBe(scenario.customerTurns[0]);
    expect(second).toEqual(first);
  });
});

describe("MockEvaluationProvider", () => {
  it("awards literal signal evidence across all five dimensions", async () => {
    const scenario = scenarioTemplates[0];
    const report = await new MockEvaluationProvider().evaluate({
      scenario,
      learnerMessages: [
        "我理解您的价格顾虑。想先确认年龄和预算，因为要选择适合的主粮；换粮需要逐步过渡。我会按需求推荐，并在后续继续跟进。",
      ],
    });

    expect(report.mode).toBe("mock");
    expect(report.totalScore).toBe(100);
    expect(report.status).toBe("passed");
    expect(report.dimensions).toEqual([
      {
        name: "需求与宠物信息挖掘",
        score: 25,
        maxScore: 25,
        evidence: ["年龄", "预算"],
      },
      {
        name: "场景化卖点表达",
        score: 20,
        maxScore: 20,
        evidence: ["适合", "因为"],
      },
      {
        name: "产品及宠物知识准确",
        score: 20,
        maxScore: 20,
        evidence: ["主粮", "换粮"],
      },
      {
        name: "异议处理与替代价值",
        score: 20,
        maxScore: 20,
        evidence: ["理解", "价格"],
      },
      {
        name: "关联推荐及跟单闭环",
        score: 15,
        maxScore: 15,
        evidence: ["推荐", "后续"],
      },
    ]);
    expect(report.risks).toEqual([]);
  });

  it("forces needs_retry when a critical risk phrase appears", async () => {
    const scenario = scenarioTemplates[0];
    const report = await new MockEvaluationProvider().evaluate({
      scenario,
      learnerMessages: ["这款粮保证不软便，您放心买就行。"],
    });

    expect(report.status).toBe("needs_retry");
    expect(report.risks).toEqual(["绝对化产品承诺"]);
  });
});
