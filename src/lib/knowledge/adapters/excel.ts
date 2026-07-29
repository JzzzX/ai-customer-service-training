import ExcelJS from "exceljs";
import JSZip from "jszip";

import { normalizeKnowledgeText } from "../normalize";
import type { ParseIssue, RawKnowledgeUnit } from "../schema";

interface ExcelSourceInput {
  sourcePath: string;
  buffer: Buffer;
}

interface ExcelParseResult {
  units: RawKnowledgeUnit[];
  issues: ParseIssue[];
  stats: {
    sheetsSeen: number;
    rowsSeen: number;
    unitsEmitted: number;
    emptyItemsSkipped: number;
    emptySheets: number;
    skippedImages: number;
  };
}

export async function parseExcelBuffer(
  input: ExcelSourceInput,
): Promise<ExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  const archive = await JSZip.loadAsync(input.buffer);
  const skippedImages = Object.values(archive.files).filter(
    (file) => !file.dir && /^xl\/media\/[^/]+$/.test(file.name),
  ).length;
  const normalizedBuffer = await repairMixedRichTextStrings(
    archive,
    input.buffer,
  );
  await workbook.xlsx.load(
    normalizedBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const units: RawKnowledgeUnit[] = [];
  const issues: ParseIssue[] = [];
  let rowsSeen = 0;
  let emptyItemsSkipped = 0;
  let emptySheets = 0;

  for (const worksheet of workbook.worksheets) {
    const rows = readNonEmptyRows(worksheet);
    const header = findHeaderRow(rows);

    if (rows.length === 0) {
      emptySheets += 1;
      issues.push({
        code: "empty_sheet",
        severity: "info",
        message: `Excel sheet "${worksheet.name}" has no cell content.`,
        sources: [
          {
            sourcePath: input.sourcePath,
            kind: "excel",
            anchor: `sheet:${worksheet.name}`,
            sheet: worksheet.name,
            path: [worksheet.name],
          },
        ],
      });
      continue;
    }

    const questionColumn = header
      ? findHeaderColumn(header.values, QUESTION_HEADERS)
      : undefined;
    const answerColumn = header
      ? findHeaderColumn(header.values, ANSWER_HEADERS)
      : undefined;
    const categoryColumn = header
      ? findHeaderColumn(header.values, CATEGORY_HEADERS)
      : undefined;

    for (const row of rows) {
      if (row.number === header?.number) {
        continue;
      }

      rowsSeen += 1;
      const usesHeader = Boolean(header && row.number > header.number);
      const sourceBase = {
        sourcePath: input.sourcePath,
        kind: "excel" as const,
        anchor: `sheet:${worksheet.name}/row:${row.number}`,
        sheet: worksheet.name,
        row: row.number,
      };

      if (usesHeader && questionColumn && answerColumn) {
        const question = row.values.get(questionColumn) ?? "";
        const answer = row.values.get(answerColumn) ?? "";
        const category = categoryColumn
          ? row.values.get(categoryColumn) ?? ""
          : "";
        const path = [
          worksheet.name,
          ...(category ? [category] : []),
          ...(question ? [toTitle(question)] : []),
        ];
        const source = { ...sourceBase, path };

        if (!question) {
          emptyItemsSkipped += 1;
          issues.push({
            code: "empty_item",
            severity: "warning",
            message: `Excel row ${worksheet.name}!${row.number} has an answer but no question.`,
            sources: [source],
          });
          continue;
        }

        if (!answer) {
          emptyItemsSkipped += 1;
          issues.push({
            code: "empty_answer",
            severity: "warning",
            message: `Excel row ${worksheet.name}!${row.number} has no answer.`,
            sources: [source],
          });
          continue;
        }

        units.push({
          title: toTitle(question),
          content: answer,
          categoryPath: [
            worksheet.name,
            ...(category ? [category] : []),
          ],
          semanticKey: `qa:${[category, question]
            .filter(Boolean)
            .map(toSemanticKey)
            .join("|")}`,
          source,
        });
        continue;
      }

      const fields = [...row.values.entries()].map(([column, value]) => ({
        label:
          usesHeader && header
            ? header.values.get(column) || toColumnLabel(column)
            : toColumnLabel(column),
        value,
      }));
      const title = chooseGenericTitle(fields);
      const category = usesHeader
        ? fields.find((field) => CATEGORY_HEADERS.has(field.label))?.value
        : undefined;
      const source = {
        ...sourceBase,
        path: [
          worksheet.name,
          ...(category && category !== title ? [category] : []),
          title,
        ],
      };
      const content =
        fields.length === 1
          ? fields[0].value
          : fields
              .map((field) => `${field.label}：${field.value}`)
              .join("\n");

      if (!title || !content) {
        emptyItemsSkipped += 1;
        issues.push({
          code: "empty_item",
          severity: "warning",
          message: `Excel row ${worksheet.name}!${row.number} has no usable text.`,
          sources: [source],
        });
        continue;
      }

      units.push({
        title,
        content,
        categoryPath: [
          worksheet.name,
          ...(category && category !== title ? [category] : []),
        ],
        source,
      });
    }
  }

  return {
    units,
    issues,
    stats: {
      sheetsSeen: workbook.worksheets.length,
      rowsSeen,
      unitsEmitted: units.length,
      emptyItemsSkipped,
      emptySheets,
      skippedImages,
    },
  };
}

interface ExcelRowData {
  number: number;
  values: Map<number, string>;
}

const HEADER_VOCABULARY = new Set([
  "分类",
  "问题",
  "回复",
  "话术",
  "答案",
  "回答",
  "产品名称",
  "货品名称",
  "品类",
  "系列",
  "规格",
  "热量",
  "单位",
  "卖点",
  "产品链接",
  "改善点",
  "改善后（负责同事填写）",
]);

const QUESTION_HEADERS = new Set(["问题"]);
const ANSWER_HEADERS = new Set(["回复", "话术", "答案", "回答"]);
const CATEGORY_HEADERS = new Set(["分类", "品类"]);
const TITLE_HEADERS = [
  "问题",
  "货品名称",
  "产品名称",
  "产品",
  "系列",
  "分类",
  "品类",
];

function readNonEmptyRows(worksheet: ExcelJS.Worksheet): ExcelRowData[] {
  const rows: ExcelRowData[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = new Map<number, string>();

    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      if (cell.isMerged && cell.master.address !== cell.address) {
        return;
      }

      const value = normalizeKnowledgeText(excelCellValueToText(cell.value));
      if (value) {
        values.set(columnNumber, value);
      }
    });

    if (values.size > 0) {
      rows.push({ number: rowNumber, values });
    }
  });

  return rows;
}

function findHeaderRow(rows: ExcelRowData[]): ExcelRowData | undefined {
  let best: { row: ExcelRowData; score: number } | undefined;

  for (const row of rows.slice(0, 10)) {
    const score = [...row.values.values()].filter((value) =>
      HEADER_VOCABULARY.has(value),
    ).length;

    if (score >= 2 && (!best || score > best.score)) {
      best = { row, score };
    }
  }

  return best?.row;
}

function findHeaderColumn(
  values: Map<number, string>,
  acceptedHeaders: Set<string>,
): number | undefined {
  for (const [column, value] of values.entries()) {
    if (acceptedHeaders.has(value)) {
      return column;
    }
  }

  return undefined;
}

export function excelCellValueToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if ("richText" in value) {
    return value.richText.map((item) => item.text).join("");
  }

  if ("formula" in value || "sharedFormula" in value) {
    if (value.result !== undefined) {
      return excelCellValueToText(value.result);
    }
    return ("formula" in value ? value.formula : value.sharedFormula) ?? "";
  }

  if ("text" in value) {
    const text = excelCellValueToText(
      value.text as unknown as ExcelJS.CellValue,
    );
    return text || String(value.hyperlink ?? "");
  }

  if ("error" in value) {
    return value.error;
  }

  return String(value);
}

function chooseGenericTitle(
  fields: Array<{ label: string; value: string }>,
): string {
  for (const header of TITLE_HEADERS) {
    const value = fields.find((field) => field.label === header)?.value;
    if (value) {
      return toTitle(value);
    }
  }

  return toTitle(fields[0]?.value ?? "");
}

function toTitle(value: string): string {
  return normalizeKnowledgeText(value).split("\n")[0]?.slice(0, 160) ?? "";
}

function toSemanticKey(value: string): string {
  return normalizeKnowledgeText(value).toLocaleLowerCase("zh-CN");
}

function toColumnLabel(column: number): string {
  let value = column;
  let label = "";

  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return `列${label}`;
}

async function repairMixedRichTextStrings(
  archive: JSZip,
  originalBuffer: Buffer,
): Promise<Buffer> {
  const sharedStringsFile = archive.file("xl/sharedStrings.xml");
  if (!sharedStringsFile) {
    return originalBuffer;
  }

  const sharedStrings = await sharedStringsFile.async("string");
  let repairedItems = 0;
  const normalized = sharedStrings.replace(
    /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g,
    (item, body: string) => {
      if (!/<r(?:\s|>)/.test(body)) {
        return item;
      }

      const repairedBody = body
        .replace(/<t(?:\s[^>]*)?>\s*<\/t>/g, "")
        .replace(/<t(?:\s[^>]*)?\/>/g, "");

      if (repairedBody === body) {
        return item;
      }

      repairedItems += 1;
      return item.replace(body, repairedBody);
    },
  );

  if (repairedItems === 0) {
    return originalBuffer;
  }

  archive.file("xl/sharedStrings.xml", normalized);
  return archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
}
