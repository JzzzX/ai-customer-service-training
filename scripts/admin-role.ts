import { config } from "dotenv";

import { grantAdmin, requiredOption, revokeAdmin } from "./cli-support";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

try {
  const operation = process.argv[2];
  const email = requiredOption("--email");
  const changed =
    operation === "grant"
      ? grantAdmin(email)
      : operation === "revoke"
        ? revokeAdmin(email)
        : (() => {
            throw new Error("命令必须为 grant 或 revoke。");
          })();
  if (!changed) {
    throw new Error("找不到对应账号。");
  }
  console.log(operation === "grant" ? "管理员权限已授予。" : "管理员权限已撤销，账号已降级为学员。");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
