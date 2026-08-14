import {
  sourceLocatorSchema,
  type SourceLocator,
} from "./schema";

/**
 * 兼容旧数据库中由历史 PostgreSQL / Phase3 数据迁移留下的
 * snake_case SourceLocator。
 *
 * 数据库内容本身不改写，统一在读取边界转换成当前应用使用的
 * camelCase SourceLocator。
 */
export function normalizeSourceLocators(
  value: unknown,
): SourceLocator[] {
  if (!Array.isArray(value)) {
    return sourceLocatorSchema.array().parse(value);
  }

  return value.map((raw) => normalizeSourceLocator(raw));
}

function normalizeSourceLocator(value: unknown): SourceLocator {
  if (!value || typeof value !== "object") {
    return sourceLocatorSchema.parse(value);
  }

  const input = value as Record<string, unknown>;

  return sourceLocatorSchema.parse({
    sourcePath:
      input.sourcePath ??
      input.source_path,
    kind: input.kind,
    anchor: input.anchor,
    ...(input.line !== undefined
      ? { line: input.line }
      : {}),
    ...(input.sheet !== undefined
      ? { sheet: input.sheet }
      : {}),
    ...(input.row !== undefined
      ? { row: input.row }
      : {}),
    ...(input.nodeId !== undefined ||
    input.node_id !== undefined
      ? {
          nodeId:
            input.nodeId ??
            input.node_id,
        }
      : {}),
    path: input.path,
  });
}
