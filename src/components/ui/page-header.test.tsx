import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders an icon-only back link with an accessible label", () => {
    render(
      <PageHeader
        backHref="/practice"
        backIconOnly
        backLabel="返回训练中心"
        title="情景实战"
      />,
    );

    const backLink = screen.getByRole("link", { name: "返回训练中心" });
    expect(backLink).toHaveAttribute("href", "/practice");
    expect(backLink).toHaveTextContent("←");
    expect(backLink).not.toHaveTextContent("返回训练中心");
  });
});
