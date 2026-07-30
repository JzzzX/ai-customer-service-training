import type { ExpectedCoverage } from "./schema";

export const projectKnowledgeSourceDirectory = "TOC售前客服知识库";
export const projectKnowledgeOutputDirectory = "artifacts/knowledge";

export const projectExpectedCoverage: ExpectedCoverage = {
  sourceFiles: 8,
  markdownFiles: 4,
  workbookFiles: 4,
  mindmapFiles: 0,
  workbookSheets: 11,
  mindmapNodes: 0,
  skippedImages: 133,
};
