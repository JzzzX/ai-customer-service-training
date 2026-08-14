import { describe, expect, it } from "vitest";

import { normalizeSourceLocators } from "./source-locator-compat";

describe("normalizeSourceLocators", () => {
  it("keeps current camelCase locators valid", () => {
    const value = [
      {
        sourcePath: "销售场景.md",
        kind: "markdown",
        anchor: "正确跟单",
        path: ["正确跟单"],
      },
    ];

    expect(normalizeSourceLocators(value)).toEqual(value);
  });

  it("normalizes legacy snake_case locators", () => {
    expect(
      normalizeSourceLocators([
        {
          source_path: "客服服务流程.md",
          kind: "mindmap",
          anchor: "路途中无更新",
          node_id: "node-1",
          path: [
            "售中、售后接待流程",
            "快递售中问题",
            "路途中无更新",
          ],
        },
      ]),
    ).toEqual([
      {
        sourcePath: "客服服务流程.md",
        kind: "mindmap",
        anchor: "路途中无更新",
        nodeId: "node-1",
        path: [
          "售中、售后接待流程",
          "快递售中问题",
          "路途中无更新",
        ],
      },
    ]);
  });
});
