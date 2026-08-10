import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { normalizeKnowledgeText } from "../normalize";
import type { ParseIssue, RawKnowledgeUnit } from "../schema";

interface MarkdownSourceInput {
  sourcePath: string;
  text: string;
}

interface MarkdownParseResult {
  units: RawKnowledgeUnit[];
  issues: ParseIssue[];
  stats: {
    sectionsSeen: number;
    unitsEmitted: number;
    emptyItemsSkipped: number;
    skippedImages: number;
  };
}

export function parseMarkdownSource(
  input: MarkdownSourceInput,
): MarkdownParseResult {
  const tree = unified().use(remarkParse).parse(input.text);
  const lines = input.text.replace(/\r\n?/g, "\n").split("\n");
  const headings = tree.children.filter((node) => node.type === "heading");
  const units: RawKnowledgeUnit[] = [];
  const issues: ParseIssue[] = [];
  const pathStack: string[] = [];
  const anchorOccurrences = new Map<string, number>();
  let skippedImages = 0;

  visit(tree, "image", () => {
    skippedImages += 1;
  });

  for (const [index, heading] of headings.entries()) {
    const title = normalizeKnowledgeText(readNodeText(heading));
    const depth = heading.depth;

    pathStack.length = depth - 1;
    pathStack[depth - 1] = title;

    const path = pathStack.filter(Boolean);
    const baseAnchor = `h:${path.map(toAnchorSegment).join("/")}`;
    const occurrence = (anchorOccurrences.get(baseAnchor) ?? 0) + 1;
    const anchor =
      occurrence === 1 ? baseAnchor : `${baseAnchor}#${occurrence}`;
    anchorOccurrences.set(baseAnchor, occurrence);

    const nextHeading = headings[index + 1];
    const bodyStart = heading.position?.end.line ?? 1;
    const bodyEnd = nextHeading?.position?.start.line
      ? nextHeading.position.start.line - 1
      : lines.length;
    const content = normalizeKnowledgeText(
      stripMarkdownImages(lines.slice(bodyStart, bodyEnd).join("\n")),
    );
    const source = {
      sourcePath: input.sourcePath,
      kind: "markdown" as const,
      anchor,
      line: heading.position?.start.line ?? 1,
      path,
    };

    if (!content) {
      issues.push({
        code: "empty_item",
        severity: "info",
        message: `Markdown section "${title}" has no text content.`,
        sources: [source],
      });
      continue;
    }

    units.push({
      title,
      content,
      categoryPath: path.slice(0, -1),
      source,
    });
  }

  return {
    units,
    issues,
    stats: {
      sectionsSeen: headings.length,
      unitsEmitted: units.length,
      emptyItemsSkipped: issues.length,
      skippedImages,
    },
  };
}

function readNodeText(node: unknown): string {
  if (!node || typeof node !== "object") {
    return "";
  }

  const textNode = node as {
    value?: unknown;
    alt?: unknown;
    children?: unknown[];
  };

  if (typeof textNode.value === "string") {
    return textNode.value;
  }

  if (typeof textNode.alt === "string") {
    return textNode.alt;
  }

  return textNode.children?.map(readNodeText).join("") ?? "";
}

function stripMarkdownImages(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<img\b[^>]*>/gi, "");
}

function toAnchorSegment(value: string): string {
  return value.replaceAll("/", "／");
}
