import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: mocks.useActionState,
}));

vi.mock("@/app/practice/scenario/actions", () => ({
  startScenarioAction: vi.fn(),
}));

import { ScenarioStartForm } from "./scenario-start-form";

describe("ScenarioStartForm", () => {
  beforeEach(() => {
    mocks.useActionState.mockReturnValue([{}, vi.fn(), false]);
  });

  it("shows a retry-safe error and incident id without leaving the page", () => {
    mocks.useActionState.mockReturnValue([
      {
        error: "训练会话创建失败，请重试。",
        incidentId: "00000000-0000-4000-8000-000000000099",
      },
      vi.fn(),
      false,
    ]);

    render(<ScenarioStartForm scenarioId={`st_${"4".repeat(24)}`} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "训练会话创建失败，请重试。",
    );
    expect(screen.getByText(/问题编号：00000000-/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新尝试" }),
    ).toBeEnabled();
  });

  it("prevents duplicate starts while the server action is pending", () => {
    mocks.useActionState.mockReturnValue([{}, vi.fn(), true]);

    render(<ScenarioStartForm scenarioId={`st_${"4".repeat(24)}`} />);

    expect(
      screen.getByRole("button", { name: "正在创建会话…" }),
    ).toBeDisabled();
  });
});
