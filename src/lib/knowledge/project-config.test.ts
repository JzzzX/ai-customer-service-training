import { describe, expect, it } from "vitest";

import { projectExpectedCoverage } from "./project-config";

describe("projectExpectedCoverage", () => {
  it("matches the current local TOC presales knowledge source set", () => {
    expect(projectExpectedCoverage).toEqual({
      sourceFiles: 8,
      markdownFiles: 6,
      workbookFiles: 2,
      mindmapFiles: 0,
      workbookSheets: 9,
      mindmapNodes: 0,
      skippedImages: 133,
    });
  });
});
