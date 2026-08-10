import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const KB_DIR = path.join(process.cwd(), "TOC售前客服知识库");
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface ParsedSheet {
  name: string;
  rows: string[][];
}

async function parseXlsx(filePath: string): Promise<ParsedSheet[]> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  // Parse shared strings
  const sharedStrings: string[] = [];
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (sharedStringsFile) {
    const xml = await sharedStringsFile.async("string");
    const parsed = xmlParser.parse(xml);
    const sst = parsed.sst;
    if (sst && sst.si) {
      const items = Array.isArray(sst.si) ? sst.si : [sst.si];
      for (const item of items) {
        sharedStrings.push(extractText(item));
      }
    }
  }

  // Parse workbook to get sheet names and relationships
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) return [];

  const workbookXml = await workbookFile.async("string");
  const workbook = xmlParser.parse(workbookXml);
  const sheetEntries: { name: string; rId: string }[] = [];
  if (workbook.workbook?.sheets?.sheet) {
    const sheets = Array.isArray(workbook.workbook.sheets.sheet)
      ? workbook.workbook.sheets.sheet
      : [workbook.workbook.sheets.sheet];
    for (const sheet of sheets) {
      sheetEntries.push({
        name: sheet["@_name"] ?? "Unknown",
        rId: sheet["@_r:id"] ?? "",
      });
    }
  }

  // Parse workbook relationships to map rId -> sheet file
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  const rIdToTarget: Record<string, string> = {};
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    const rels = xmlParser.parse(relsXml);
    if (rels.Relationships?.Relationship) {
      const relationships = Array.isArray(rels.Relationships.Relationship)
        ? rels.Relationships.Relationship
        : [rels.Relationships.Relationship];
      for (const rel of relationships) {
        rIdToTarget[rel["@_Id"]] = rel["@_Target"];
      }
    }
  }

  // Parse each sheet
  const sheets: ParsedSheet[] = [];
  for (const entry of sheetEntries) {
    const target = rIdToTarget[entry.rId];
    if (!target) continue;
    const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async("string");
    const sheetData = xmlParser.parse(sheetXml);

    const rows: string[][] = [];
    const sheetRows = sheetData.worksheet?.sheetData?.row;
    if (sheetRows) {
      const rowArray = Array.isArray(sheetRows) ? sheetRows : [sheetRows];
      for (const row of rowArray) {
        const cells: string[] = [];
        const cellArray = row.c ? (Array.isArray(row.c) ? row.c : [row.c]) : [];
        for (const cell of cellArray) {
          const cellType = cell["@_t"];
          const value = cell.v;
          if (cellType === "s" && value !== undefined) {
            const idx = typeof value === "number" ? value : parseInt(String(value), 10);
            cells.push(sharedStrings[idx] ?? "");
          } else if (cellType === "inlineStr" && cell.is) {
            cells.push(extractText(cell.is));
          } else if (value !== undefined) {
            cells.push(String(value));
          } else {
            cells.push("");
          }
        }
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }
    }
    sheets.push({ name: entry.name, rows });
  }

  return sheets;
}

function extractText(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item === "number") return String(item);
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.t === "string") return obj.t;
    if (typeof obj.t === "number") return String(obj.t);
    if (Array.isArray(obj.t)) {
      return obj.t.map((t) => (typeof t === "string" ? t : extractText(t))).join("");
    }
    if (obj.r && Array.isArray(obj.r)) {
      return obj.r.map((r) => extractText(r)).join("");
    }
  }
  return "";
}

async function main() {
  const files = (await readdir(KB_DIR)).filter((f) => f.endsWith(".xlsx"));
  for (const file of files.sort()) {
    console.log(`\n${"=".repeat(80)}\n# ${file}\n${"=".repeat(80)}`);
    try {
      const sheets = await parseXlsx(path.join(KB_DIR, file));
      for (const sheet of sheets) {
        console.log(`\n## Sheet: ${sheet.name} (${sheet.rows.length} rows)\n`);
        for (const row of sheet.rows) {
          console.log(row.join(" | "));
        }
      }
    } catch (err) {
      console.error(`ERROR parsing ${file}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
