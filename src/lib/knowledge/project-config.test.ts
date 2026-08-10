import { describe, expect, it } from "vitest";

import { projectExpectedCoverage } from "./project-config";

describe("projectExpectedCoverage", () => {
  it("matches the current local TOC presales knowledge source set", () => {
    expect(projectExpectedCoverage).toEqual({
      sourceFiles: 8,
      markdownFiles: 4,
      workbookFiles: 4,
      mindmapFiles: 0,
      workbookSheets: 11,
      mindmapNodes: 0,
      skippedImages: 133,
    });
  });
});
