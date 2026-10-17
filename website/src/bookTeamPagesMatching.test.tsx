import { cleanup, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures } from "./collectionFixtures";
import { settingsFixtures } from "./settingsFixtures";
import type { SettingsRead } from "./settingsRead";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const reader: MemberProfile = { ...shellFixtures.memberWithTheBookOpened, bookSpread: true };

const settings = { kind: "settings" as const, board: null, messages: null, group: null };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  localStorage.clear();
});

function showTeam(path: string, readSettings: SettingsRead) {
  window.history.replaceState(null, "", path);
  return renderApp(reader, undefined, {}, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, readSettings, (asking) => (asking ? collectionFixtures.withTeamPages : undefined));
}

function rightPage() {
  return screen.getByRole("main").querySelector<HTMLElement>('[data-spread] [data-page="right"]')!;
}

describe("#607: an admin is linked from the unmatched line to the matching settings through the route list's company-profile section", () => {
  it("links an admin, lands on the section, asks the settings only on a team with people to match, and links nobody else", async () => {
    const asked: boolean[] = [];
    const admin: SettingsRead = (asking) => {
      asked.push(asking);
      return asking ? settingsFixtures.forAnAdmin : undefined;
    };
    const app = showTeam("/book#teams/workflows", admin);
    const link = within(rightPage()).getByRole("link", { name: "Match them in Settings" });
    expect(link).toHaveAttribute("href", "/settings?section=company-profile");
    expect(asked.some((asking) => asking)).toBe(true);
    await app.user.click(link);
    expect(window.location.pathname + window.location.search).toBe("/settings?section=company-profile");
    expect(within(screen.getByRole("main")).getByRole("region", { name: "This is me on posthog.com" })).toBeInTheDocument();
    cleanup();
    asked.length = 0;
    showTeam("/book#teams/platform-features", admin);
    expect(asked.every((asking) => !asking)).toBe(true);
    cleanup();
    showTeam("/book#teams/workflows", (asking) => (asking ? settings : undefined));
    expect(within(rightPage()).queryByRole("link", { name: "Match them in Settings" })).toBeNull();
    expect(rightPage()).toHaveTextContent("1 person on this team isn't linked to a teammate yet: Quill Harper.");
  });
});
