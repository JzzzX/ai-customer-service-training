import { config } from "dotenv";

import { classifyAiGatewayError } from "../src/lib/scenario/ai-errors";
import { verifyCompanyAiGateway } from "../src/lib/scenario/ai-preflight";

config({ path: [".env.local", ".env"], quiet: true });

verifyCompanyAiGateway()
  .then((result) => {
    console.log(JSON.stringify({ event: "ai_gateway_preflight", ok: true, ...result }));
  })
  .catch((error: unknown) => {
    const classification = classifyAiGatewayError(error);
    console.error(
      JSON.stringify({
        event: "ai_gateway_preflight",
        ok: false,
        ...classification,
      }),
    );
    process.exitCode = 1;
  });
