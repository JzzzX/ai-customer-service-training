import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import { compileKnowledgeDirectory } from "./directory-compiler";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function createSourceDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "knowledge-compiler-"));
  temporaryDirectories.push(directory);

  await writeFile(
    join(directory, "销售场景.md"),
    "# 售前接待\n先确认需求。![图](private.png)",
    "utf8",
  );
  await writeFile(
    join(directory, "客服流程.mm"),
    '<map><node ID="root" TEXT="客服流程"><node ID="sales" TEXT="售前接待"/></node></map>',
    "utf8",
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("问答");
  sheet.addRow(["问题", "回复"]);
  sheet.addRow(["幼猫怎么喂", "少量多餐。"]);
  await writeFile(
    join(directory, "产品问答.xlsx"),
    Buffer.from(await workbook.xlsx.writeBuffer()),
  );

  return directory;
}

const expectedCoverage = {
  sourceFiles: 3,
  markdownFiles: 1,
  workbookFiles: 1,
  mindmapFiles: 1,
  workbookSheets: 1,
  mindmapNodes: 2,
  skippedImages: 1,
};

describe("compileKnowledgeDirectory", () => {
  it("builds the same traceable pack on repeated compilation", async () => {
    const sourceDir = await createSourceDirectory();

    const first = await compileKnowledgeDirectory({
      sourceDir,
      expected: expectedCoverage,
    });
    const second = await compileKnowledgeDirectory({
      sourceDir,
      expected: expectedCoverage,
    });

    expect(first.gate.passed).toBe(true);
    expect(first.coverage).toMatchObject({
      ...expectedCoverage,
      unitsBeforeDedup: 4,
      unitsAfterDedup: 4,
      parseErrors: 0,
    });
    expect(first.packHash).toBe(second.packHash);
    expect(first.units).toEqual(second.units);
  });

  it("fails the gate when an expected coverage count changes", async () => {
    const sourceDir = await createSourceDirectory();

    const result = await compileKnowledgeDirectory({
      sourceDir,
      expected: { ...expectedCoverage, skippedImages: 2 },
    });

    expect(result.gate.passed).toBe(false);
    expect(
      result.gate.checks.find((check) => check.name === "skippedImages"),
    ).toEqual({
      name: "skippedImages",
      expected: 2,
      actual: 1,
      passed: false,
    });
  });

  it("ignores temporary Office files and accepts whitespace before an Excel extension", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "knowledge-compiler-"));
    temporaryDirectories.push(sourceDir);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("问答");
    sheet.addRow(["问题", "回复"]);
    sheet.addRow(["幼猫怎么喂", "少量多餐。"]);
    const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await writeFile(join(sourceDir, ".~产品问答.xlsx"), "temporary lock file");
    await writeFile(join(sourceDir, "产品问答. xlsx"), workbookBuffer);

    const result = await compileKnowledgeDirectory({
      sourceDir,
      expected: {
        sourceFiles: 1,
        workbookFiles: 1,
        workbookSheets: 1,
      },
    });

    expect(result.gate.passed).toBe(true);
    expect(result.coverage.parseErrors).toBe(0);
    expect(result.sources.map((source) => source.sourcePath)).toEqual([
      "产品问答. xlsx",
    ]);
  });
});
