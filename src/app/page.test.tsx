import { describe, expect, it, vi } from "vitest";

import HomePage from "./page";

const redirectMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("HomePage", () => {
  it("redirects unauthenticated visitors to the login page", () => {
    HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
