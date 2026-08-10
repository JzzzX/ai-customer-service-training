import { Buffer } from "node:buffer";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { excelCellValueToText, parseExcelBuffer } from "./excel";

describe("parseExcelBuffer", () => {
  it("extracts Q&A rows and reports empty answers and images", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("产品");
    sheet.addRow(["分类", "问题", "回复"]);
    sheet.addRow(["幼猫粮", "三个月幼猫怎么喂", "用温水泡软。"]);
    sheet.addRow(["幼猫粮", "没有答案", null]);
    workbook.addWorksheet("空表");

    const imageId = workbook.addImage({
      base64:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      extension: "png",
    });
    sheet.addImage(imageId, "E1:E1");

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseExcelBuffer({
      sourcePath: "企划问答.xlsx",
      buffer,
    });

    expect(result.stats).toEqual({
      sheetsSeen: 2,
      rowsSeen: 2,
      unitsEmitted: 1,
      emptyItemsSkipped: 1,
      emptySheets: 1,
      skippedImages: 1,
    });
    expect(result.units).toEqual([
      {
        title: "三个月幼猫怎么喂",
        content: "用温水泡软。",
        categoryPath: ["产品", "幼猫粮"],
        semanticKey: "qa:幼猫粮|三个月幼猫怎么喂",
        source: {
          sourcePath: "企划问答.xlsx",
          kind: "excel",
          anchor: "sheet:产品/row:2",
          sheet: "产品",
          row: 2,
          path: ["产品", "幼猫粮", "三个月幼猫怎么喂"],
        },
      },
    ]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "empty_answer",
      "empty_sheet",
    ]);
  });

  it("keeps knowledge rows that appear before a detected header", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("产品明细");
    sheet.addRow(["宠物新标准", null, "五项产品标准"]);
    sheet.addRow(["品类", "货品名称", "规格", "卖点"]);
    sheet.addRow(["狗主粮", "鲜肉犬粮", "1.5kg", "干爽不油腻"]);

    const result = await parseExcelBuffer({
      sourcePath: "企划问答.xlsx",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });

    expect(result.units.map((unit) => unit.title)).toEqual([
      "宠物新标准",
      "鲜肉犬粮",
    ]);
    expect(result.units[1]?.content).toContain("卖点：干爽不油腻");
  });

  it("repairs mixed empty and rich shared strings without changing the source file", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("问答");
    sheet.getCell("A1").value = { richText: [{ text: "问题" }] };
    sheet.getCell("B1").value = { richText: [{ text: "回复" }] };
    sheet.addRow(["幼猫怎么喂", "少量多餐。"]);

    const archive = await JSZip.loadAsync(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );
    const sharedStringsFile = archive.file("xl/sharedStrings.xml");
    const sharedStrings = await sharedStringsFile?.async("string");
    if (!sharedStrings) {
      throw new Error("Test workbook did not contain shared strings.");
    }
    archive.file(
      "xl/sharedStrings.xml",
      sharedStrings.replace(/<si>(?=<r>)/g, "<si><t></t>"),
    );
    const malformedBuffer = await archive.generateAsync({
      type: "nodebuffer",
    });

    const result = await parseExcelBuffer({
      sourcePath: "混合富文本.xlsx",
      buffer: malformedBuffer,
    });

    expect(result.units.map((item) => item.title)).toEqual(["幼猫怎么喂"]);
  });
});

describe("excelCellValueToText", () => {
  it("reads rich text used as a hyperlink label", () => {
    const value = {
      text: { richText: [{ text: "查看产品资料" }] },
      hyperlink: "https://example.com/product",
    } as unknown as ExcelJS.CellValue;

    expect(excelCellValueToText(value)).toBe("查看产品资料");
  });
});
