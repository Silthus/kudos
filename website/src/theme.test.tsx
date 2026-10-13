import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { shellFixtures } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

const isDark = () => document.documentElement.classList.contains("dark");

function renderShell() {
  const { unmount } = render(<App shell={shellFixtures.signedOut} />);
  return { user: userEvent.setup(), unmount };
}

describe("V6: the theme control follows the system first, overrides it per browser, and returns to it", () => {
  it("follows the system on a first visit, including a later system change", () => {
    const system = fakeSystemTheme(true);
    renderShell();
    expect(isDark()).toBe(true);
    expect(screen.getByRole("button", { name: "Use system setting" })).toHaveAttribute("aria-pressed", "true");
    act(() => system.turnDark(false));
    expect(isDark()).toBe(false);
  });

  it("overrides the system and keeps the choice for the next visit in this browser", async () => {
    const system = fakeSystemTheme(false);
    const { user, unmount } = renderShell();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(isDark()).toBe(true);
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    act(() => system.turnDark(false));
    expect(isDark()).toBe(true);

    unmount();
    document.documentElement.classList.remove("dark");
    renderShell();
    expect(isDark()).toBe(true);
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("returns to the system when Use system setting is chosen", async () => {
    const system = fakeSystemTheme(false);
    const { user } = renderShell();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: "Use system setting" }));
    expect(isDark()).toBe(false);
    act(() => system.turnDark(true));
    expect(isDark()).toBe(true);
  });
});
