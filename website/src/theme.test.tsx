import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "./shell";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { renderApp, renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

afterEach(() => {
  vi.restoreAllMocks();
});

const isDark = () => document.documentElement.classList.contains("dark");

function settingsPage() {
  window.history.replaceState(null, "", "/settings");
  return renderSettingsPage(fixedSettings(settingsFixtures.everything));
}

function renderShell() {
  return renderApp(shellFixtures.signedOut);
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

  it("still renders and switches theme when the browser refuses storage", async () => {
    fakeSystemTheme(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is disabled", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is disabled", "SecurityError");
    });
    const { user } = renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "HedgeHug" })).toBeInTheDocument();
    expect(isDark()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(isDark()).toBe(false);
  });

  it("keeps the choice through signing out to the standalone sign-in page when the browser refuses storage", async () => {
    fakeSystemTheme(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is disabled", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is disabled", "SecurityError");
    });
    const { user, showVisitor } = await settingsPage();
    await user.click(screen.getByRole("button", { name: "Light" }));
    showVisitor(shellFixtures.signedOut);
    expect(screen.getByRole("heading", { level: 1, name: "HedgeHug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(isDark()).toBe(false);
  });

  it("keeps the choice through signing out when the browser reads its storage but refuses to write", async () => {
    fakeSystemTheme(false);
    localStorage.setItem("hedgehug.theme", "dark");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    const { user, showVisitor } = await settingsPage();
    await user.click(screen.getByRole("button", { name: "Light" }));
    showVisitor(shellFixtures.signedOut);
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(isDark()).toBe(false);
    localStorage.removeItem("hedgehug.theme");
  });

  it("marks the selected option with a visible check, not colour alone", async () => {
    fakeSystemTheme(false);
    const { user } = renderShell();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" }).querySelector("[data-selected-mark]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Light" }).querySelector("[data-selected-mark]")).toBeNull();
  });
});
