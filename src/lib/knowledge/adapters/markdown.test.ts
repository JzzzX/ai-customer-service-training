import { describe, expect, it } from "vitest";

import { parseMarkdownSource } from "./markdown";

describe("parseMarkdownSource", () => {
  it("turns heading sections into traceable knowledge units", () => {
    const markdown = [
      "# 售前接待",
      "先确认顾客需求。",
      "",
      "![流程图](image.png)",
      "",
      "## 价格异议",
      "先理解顾客，再提供替代方案。",
    ].join("\n");

    const result = parseMarkdownSource({
      sourcePath: "销售场景.md",
      text: markdown,
    });

    expect(result.units).toEqual([
      {
        title: "售前接待",
        content: "先确认顾客需求。",
        categoryPath: [],
        source: {
          sourcePath: "销售场景.md",
          kind: "markdown",
          anchor: "h:售前接待",
          line: 1,
          path: ["售前接待"],
        },
      },
      {
        title: "价格异议",
        content: "先理解顾客，再提供替代方案。",
        categoryPath: ["售前接待"],
        source: {
          sourcePath: "销售场景.md",
          kind: "markdown",
          anchor: "h:售前接待/价格异议",
          line: 6,
          path: ["售前接待", "价格异议"],
        },
      },
    ]);
  });

  it("counts image references and filters empty sections", () => {
    const result = parseMarkdownSource({
      sourcePath: "客服侧提转化.md",
      text: "# 空章节\n![截图](private.png)\n## 有内容\n跟进顾客。",
    });

    expect(result.stats).toEqual({
      sectionsSeen: 2,
      unitsEmitted: 1,
      emptyItemsSkipped: 1,
      skippedImages: 1,
    });
    expect(result.units[0]?.title).toBe("有内容");
  });
});
