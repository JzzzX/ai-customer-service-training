import { config } from "dotenv";

import { getDatabase } from "../src/db/client";
import { verifyProductionData } from "../src/db/production-verification";

config({ path: ".env.local", quiet: true });

async function main() {
  const formal = process.argv.includes("--formal");
  const result = await verifyProductionData(getDatabase());
  console.log(
    JSON.stringify(
      {
        mode: formal ? "formal" : "technical",
        passed: formal ? result.formalPassed : result.technicalPassed,
        snapshot: result.snapshot,
        issues: formal
          ? result.formalIssues
          : result.technicalIssues,
      },
      null,
      2,
    ),
  );
  if (formal ? !result.formalPassed : !result.technicalPassed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.constructor.name
      : "UnknownError",
  );
  process.exitCode = 1;
});
