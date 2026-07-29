import { XMLParser } from "fast-xml-parser";

import { normalizeKnowledgeText } from "../normalize";
import type { ParseIssue, RawKnowledgeUnit } from "../schema";

interface MindmapSourceInput {
  sourcePath: string;
  text: string;
}

interface MindmapParseResult {
  units: RawKnowledgeUnit[];
  issues: ParseIssue[];
  stats: {
    nodesSeen: number;
    unitsEmitted: number;
    emptyItemsSkipped: number;
    urlReferences: number;
  };
}

export function parseMindmapSource(
  input: MindmapSourceInput,
): MindmapParseResult {
  const parser = new XMLParser({
    attributeNamePrefix: "",
    ignoreAttributes: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: false,
  });
  const document = parser.parse(input.text) as MindmapDocument;
  const rootNodes = toArray(document.map?.node);
  const units: RawKnowledgeUnit[] = [];
  const issues: ParseIssue[] = [];
  let nodesSeen = 0;
  let urlReferences = 0;

  const walk = (
    node: MindmapNode,
    parentPath: string[],
    positionPath: number[],
  ) => {
    nodesSeen += 1;

    const content = normalizeKnowledgeText(
      decodeNumericEntities(String(node.TEXT ?? "")),
    );
    const title = content.split("\n")[0] ?? "";
    const nodeId =
      normalizeKnowledgeText(String(node.ID ?? "")) ||
      `path-${positionPath.join("-")}`;
    const path = title ? [...parentPath, title] : parentPath;
    const source = {
      sourcePath: input.sourcePath,
      kind: "mindmap" as const,
      anchor: `node:${nodeId}`,
      nodeId,
      path,
    };

    if (!content) {
      issues.push({
        code: "empty_item",
        severity: "info",
        message: `Mind-map node "${nodeId}" has no text content.`,
        sources: [source],
      });
    } else {
      urlReferences += content.match(/https?:\/\/[^\s<>"']+/g)?.length ?? 0;
      units.push({
        title,
        content,
        categoryPath: parentPath,
        source,
      });
    }

    toArray(node.node).forEach((child, index) => {
      walk(child, path, [...positionPath, index + 1]);
    });
  };

  rootNodes.forEach((node, index) => {
    walk(node, [], [index + 1]);
  });

  return {
    units,
    issues,
    stats: {
      nodesSeen,
      unitsEmitted: units.length,
      emptyItemsSkipped: issues.length,
      urlReferences,
    },
  };
}

interface MindmapDocument {
  map?: {
    node?: MindmapNode | MindmapNode[];
  };
}

interface MindmapNode {
  ID?: string;
  TEXT?: string;
  node?: MindmapNode | MindmapNode[];
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    );
}
