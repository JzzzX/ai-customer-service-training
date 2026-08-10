import { describe, expect, it } from "vitest";

import { parseMindmapSource } from "./mindmap";

describe("parseMindmapSource", () => {
  it("preserves node paths and counts embedded URL references", () => {
    const xml = [
      "<map>",
      '  <node ID="root" TEXT="客服服务流程">',
      '    <node ID="sales" TEXT="售前接待">',
      '      <node ID="welcome" TEXT="欢迎语&#10;您好 https://example.com/rule"/>',
      "    </node>",
      "  </node>",
      "</map>",
    ].join("\n");

    const result = parseMindmapSource({
      sourcePath: "客服服务流程.mm",
      text: xml,
    });

    expect(result.stats).toEqual({
      nodesSeen: 3,
      unitsEmitted: 3,
      emptyItemsSkipped: 0,
      urlReferences: 1,
    });
    expect(result.units[2]).toEqual({
      title: "欢迎语",
      content: "欢迎语\n您好 https://example.com/rule",
      categoryPath: ["客服服务流程", "售前接待"],
      source: {
        sourcePath: "客服服务流程.mm",
        kind: "mindmap",
        anchor: "node:welcome",
        nodeId: "welcome",
        path: ["客服服务流程", "售前接待", "欢迎语"],
      },
    });
  });

  it("reports nodes without usable text", () => {
    const result = parseMindmapSource({
      sourcePath: "客服服务流程.mm",
      text: '<map><node ID="root" TEXT="根"><node ID="blank" TEXT=" "/></node></map>',
    });

    expect(result.stats.emptyItemsSkipped).toBe(1);
    expect(result.issues[0]?.code).toBe("empty_item");
  });
});
