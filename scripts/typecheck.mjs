import { mkdtemp, rename, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const generatedTypeDirectories = [
  resolve(".next/types"),
  resolve(".next/dev/types"),
];
const backupDirectory = await mkdtemp(
  join(tmpdir(), "ai-training-next-types-"),
);

try {
  for (const directory of generatedTypeDirectories) {
    const backupPath = join(
      backupDirectory,
      directory.replace(`${resolve(".")}/`, ""),
    );
    await mkdirFor(backupPath);
    try {
      await rename(directory, backupPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  run("next", ["typegen"]);
  run("tsc", ["--noEmit"]);
} finally {
  await rm(backupDirectory, { recursive: true, force: true });
}

async function mkdirFor(path) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(path), { recursive: true });
}

function run(binary, args) {
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(executable, ["exec", binary, ...args], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
