import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WS300: below sm the theme control is one button that cycles light, dark and system", () => {
  const isDark = () => document.documentElement.classList.contains("dark");

  it("names its current choice and the next, and cycles through all three", async () => {
    fakeSystemTheme(true);
    const { user } = renderApp(shellFixtures.signedOut);
    const cycle = () => screen.getByRole("button", { name: /^Theme: / });
    expect(cycle()).toHaveAccessibleName("Theme: System. Switch to Light");
    expect(isDark()).toBe(true);

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: Light. Switch to Dark");
    expect(isDark()).toBe(false);

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: Dark. Switch to System");
    expect(isDark()).toBe(true);
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: System. Switch to Light");
  });
});
