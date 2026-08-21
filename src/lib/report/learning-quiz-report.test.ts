import { describe, expect, it } from "vitest";

import { resolveBeijingDateRange } from "./learning-quiz-report";

describe("resolveBeijingDateRange", () => {
  const now = new Date("2026-08-21T15:30:00.000Z");

  it("resolves today and last seven inclusive Beijing calendar days", () => {
    expect(resolveBeijingDateRange({ preset: "today" }, now)).toEqual({
      preset: "today",
      startDate: "2026-08-21",
      endDate: "2026-08-21",
      startAt: "2026-08-20T16:00:00.000Z",
      endExclusiveAt: "2026-08-21T16:00:00.000Z",
    });
    expect(resolveBeijingDateRange({ preset: "last7" }, now)).toEqual({
      preset: "last7",
      startDate: "2026-08-15",
      endDate: "2026-08-21",
      startAt: "2026-08-14T16:00:00.000Z",
      endExclusiveAt: "2026-08-21T16:00:00.000Z",
    });
  });

  it("accepts an inclusive custom range and rejects invalid calendar ranges", () => {
    expect(resolveBeijingDateRange({
      preset: "custom",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
    }, now)).toMatchObject({
      startAt: "2026-07-31T16:00:00.000Z",
      endExclusiveAt: "2026-08-03T16:00:00.000Z",
    });
    expect(() => resolveBeijingDateRange({
      preset: "custom", startDate: "2026-08-03", endDate: "2026-08-01",
    }, now)).toThrow("日期范围");
    expect(() => resolveBeijingDateRange({
      preset: "custom", startDate: "2026-02-30", endDate: "2026-03-01",
    }, now)).toThrow("日期");
  });
});
