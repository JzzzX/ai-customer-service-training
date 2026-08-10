import { describe, expect, it } from "vitest";

import {
  summarizeScenarioProgress,
  type ScenarioSessionSummary,
} from "./session-store";

describe("summarizeScenarioProgress", () => {
  it("counts unique completed scenarios and averages only the latest five scores", () => {
    const sessions = [
      session({
        id: "00000000-0000-4000-8000-000000000001",
        scenarioId: "st_aaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        score: 60,
        completedAt: "2026-07-28T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000002",
        scenarioId: "st_aaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        score: 80,
        completedAt: "2026-07-29T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000003",
        scenarioId: "st_bbbbbbbbbbbbbbbbbbbbbbbb",
        status: "completed",
        score: 90,
        completedAt: "2026-07-30T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000004",
        scenarioId: "st_cccccccccccccccccccccccc",
        status: "completed",
        score: 70,
        completedAt: "2026-07-31T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000005",
        scenarioId: "st_dddddddddddddddddddddddd",
        status: "completed",
        score: 100,
        completedAt: "2026-08-01T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000006",
        scenarioId: "st_eeeeeeeeeeeeeeeeeeeeeeee",
        status: "completed",
        score: 80,
        completedAt: "2026-08-02T08:00:00.000Z",
      }),
      session({
        id: "00000000-0000-4000-8000-000000000007",
        scenarioId: "st_ffffffffffffffffffffffff",
        status: "active",
        completedAt: undefined,
      }),
    ];

    const summary = summarizeScenarioProgress(sessions, 8, 20);

    expect(summary).toMatchObject({
      publishedScenarioCount: 8,
      completedScenarioCount: 5,
      completedSessionCount: 6,
      recentAverageScore: 84,
    });
    expect(summary.activeSessions.map((item) => item.id)).toEqual([
      "00000000-0000-4000-8000-000000000007",
    ]);
    expect(summary.completedSessions).toHaveLength(6);
  });

  it("keeps all active sessions and limits only completed recap rows", () => {
    const sessions = Array.from({ length: 4 }, (_, index) =>
      session({
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        status: "active",
        completedAt: undefined,
      }),
    );
    sessions.push(
      ...Array.from({ length: 3 }, (_, index) =>
        session({
          id: `00000000-0000-4000-8000-00000000001${index + 1}`,
          scenarioId: `st_${(index + 1).toString(16).repeat(24)}`,
          status: "completed",
          score: 70 + index,
          completedAt: `2026-08-0${index + 1}T08:00:00.000Z`,
        }),
      ),
    );

    const summary = summarizeScenarioProgress(sessions, 4, 2);

    expect(summary.activeSessions).toHaveLength(4);
    expect(summary.completedSessions).toHaveLength(2);
  });

  it("does not count completed sessions for unpublished scenarios", () => {
    const summary = summarizeScenarioProgress(
      [
        session({
          scenarioId: "st_aaaaaaaaaaaaaaaaaaaaaaaa",
          status: "completed",
        }),
        session({
          id: "00000000-0000-4000-8000-000000000098",
          scenarioId: "st_bbbbbbbbbbbbbbbbbbbbbbbb",
          status: "completed",
        }),
      ],
      1,
      20,
      new Set(["st_aaaaaaaaaaaaaaaaaaaaaaaa"]),
    );

    expect(summary.completedScenarioCount).toBe(1);
  });
});

function session(
  overrides: Partial<ScenarioSessionSummary> = {},
): ScenarioSessionSummary {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    learnerId: "00000000-0000-4000-8000-000000000002",
    scenarioId: "st_aaaaaaaaaaaaaaaaaaaaaaaa",
    scenarioVersionId: "sv_aaaaaaaaaaaaaaaaaaaaaaaa",
    title: "测试场景",
    category: "presale",
    status: "completed",
    mode: "mock",
    learnerTurnCount: 8,
    maxTurns: 8,
    startedAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:10:00.000Z",
    completedAt: "2026-08-01T08:10:00.000Z",
    score: 80,
    verdict: "passed",
    ...overrides,
  };
}
