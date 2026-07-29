import { join } from "node:path";

import { shouldUseLocalTestAccounts } from "@/lib/auth/local-test-accounts";

import { LocalScenarioSessionStore } from "./local-session-store";
import {
  MockConversationProvider,
  MockEvaluationProvider,
} from "./mock-providers";
import { ScenarioTrainingService } from "./training-service";

export function getLocalScenarioTrainingService(): ScenarioTrainingService {
  if (!shouldUseLocalTestAccounts()) {
    throw new Error(
      "Mock情景训练只在本地测试账号模式可用；正式存储将在飞书身份方案确定后接入。",
    );
  }
  return new ScenarioTrainingService({
    store: new LocalScenarioSessionStore(
      join(process.cwd(), "artifacts", "scenario"),
    ),
    conversationProvider: new MockConversationProvider(),
    evaluationProvider: new MockEvaluationProvider(),
  });
}
