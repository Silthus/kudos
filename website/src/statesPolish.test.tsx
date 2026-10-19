import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

describe("#481 5: Max's pages share one shape for their one action", () => {
  it("styles the not-found page's way back as an outline button, like the error page's Try again", () => {
    window.history.replaceState(null, "", "/profile");
    renderApp(shellFixtures.signedOut);
    const back = screen.getByRole("link", { name: "Back to your profile" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toHaveClass("quill-button--variant-outline");
    expect(back).not.toHaveClass("underline");
  });
});
