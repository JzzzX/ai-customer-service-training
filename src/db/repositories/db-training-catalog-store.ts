import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  quizSets,
  scenarios,
  scenarioVersions,
  users,
} from "../schema";
import type {
  TrainingCatalogStore,
  TrainingLearner,
  TrainingTarget,
} from "@/lib/training/catalog-store";

export class DbTrainingCatalogStore
  implements TrainingCatalogStore
{
  constructor(private readonly database: DatabaseClient) {}

  async listLearners(): Promise<TrainingLearner[]> {
    return this.database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(
        and(eq(users.role, "learner"), eq(users.isActive, true)),
      )
      .orderBy(asc(users.name), asc(users.id));
  }

  async listTargets(): Promise<TrainingTarget[]> {
    const [publishedQuizSets, publishedScenarios] = await Promise.all([
      this.database
        .select({ id: quizSets.id, label: quizSets.title })
        .from(quizSets)
        .where(eq(quizSets.status, "published"))
        .orderBy(asc(quizSets.title), asc(quizSets.id)),
      this.database
        .select({
          id: scenarioVersions.id,
          label: scenarios.title,
        })
        .from(scenarioVersions)
        .innerJoin(
          scenarios,
          eq(scenarioVersions.scenarioId, scenarios.id),
        )
        .where(
          and(
            eq(scenarioVersions.status, "published"),
            eq(scenarios.status, "published"),
          ),
        )
        .orderBy(asc(scenarios.title), asc(scenarioVersions.id)),
    ]);

    return [
      ...publishedQuizSets.map((target) => ({
        ...target,
        type: "quiz" as const,
      })),
      ...publishedScenarios.map((target) => ({
        ...target,
        type: "scenario" as const,
      })),
    ];
  }
}
