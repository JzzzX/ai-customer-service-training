import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalScenarioSessionStore } from "./local-session-store";
import {
  MockConversationProvider,
  MockEvaluationProvider,
} from "./mock-providers";
import type {
  ScenarioSessionStore,
} from "./session-store";
import type {
  ScenarioTemplateStore,
} from "./template-store";
import { ScenarioTrainingService } from "./training-service";
import { scenarioTemplates } from "./templates";

const learnerId = "00000000-0000-4000-8000-000000000002";

describe("scenario persistence ports", () => {
  it("starts a scenario supplied by an injected template store", async () => {
    const [existing] = scenarioTemplates;
    const scenario = {
      ...existing,
      id: `st_${"f".repeat(24)}`,
      versionId: `sv_${"e".repeat(24)}`,
      title: "注入的生产场景",
    };
    const templates: ScenarioTemplateStore = {
      async listPublished() {
        return [scenario];
      },
      async getPublishedById(scenarioId) {
        return scenarioId === scenario.id ? scenario : null;
      },
    };
    const outputDir = await mkdtemp(join(tmpdir(), "scenario-port-"));
    const store: ScenarioSessionStore =
      new LocalScenarioSessionStore(outputDir);
    const service = new ScenarioTrainingService({
      store,
      templates,
      conversationProvider: new MockConversationProvider(),
      evaluationProvider: new MockEvaluationProvider(),
    });

    const session = await service.start({
      learnerId,
      scenarioId: scenario.id,
    });

    expect(session.scenarioId).toBe(scenario.id);
    expect(session.scenarioVersionId).toBe(scenario.versionId);
  });
});
