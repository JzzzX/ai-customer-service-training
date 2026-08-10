import { describe, expect, it } from "vitest";

import { normalizeKnowledgeText } from "./normalize";

describe("normalizeKnowledgeText", () => {
  it("removes invisible characters and normalizes blank lines", () => {
    const input = "  亲亲\u200b，您好  \r\n\r\n\r\n  建议换粮。\u00a0 ";

    expect(normalizeKnowledgeText(input)).toBe("亲亲，您好\n\n建议换粮。");
  });
});
