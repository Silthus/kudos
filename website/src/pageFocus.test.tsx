import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { albumFixtures, fixedAlbum } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
import type { MyAlbum } from "./album/answer";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { shellFixtures, type ShellState } from "./shell";
import { renderAlbum, renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function renderTheSite(visitor: ShellState, album: () => MyAlbum = () => albumFixtures.midway) {
  return renderAlbum(visitor, (asking) => (asking ? album() : undefined), { profile: fixedProfile(profileFixtures.noted), boards: fixedBoards(boardsFixtures.week), hoggies: fixedHoggies(hoggiesFixtures.midway), settings: fixedSettings(settingsFixtures.everything) });
}

async function theProfile() {
  return screen.findByRole("heading", { level: 1, name: "Sam Example" }, { timeout: 10_000 });
}

describe("WS24: focus lands on the page title after a state change, never on first load", () => {
  it("leaves focus alone on the first page shown", () => {
    renderApp(shellFixtures.signedOut);
    expect(pageTitle()).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("leaves focus alone when the first answer arrives after loading", async () => {
    const { showVisitor } = renderTheSite(shellFixtures.loading);
    showVisitor(shellFixtures.member);
    expect(await theProfile()).not.toHaveFocus();
  });

  it("moves focus to the album's title when the membership check turns into a member", async () => {
    const { showVisitor } = renderTheSite(shellFixtures.verifying);
    showVisitor(shellFixtures.member);
    expect(await theProfile()).toHaveFocus();
  });

  it("moves focus to the closed page's title when the site closes under an open page", async () => {
    const { showVisitor } = renderTheSite(shellFixtures.member);
    await theProfile();
    showVisitor(shellFixtures.closed);
    expect(pageTitle()).toHaveTextContent("Not open yet");
    expect(pageTitle()).toHaveFocus();
  });

  it("moves focus to the sign-in page's title after signing out", async () => {
    const { showVisitor } = renderTheSite(shellFixtures.member);
    await theProfile();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
    expect(pageTitle()).toHaveFocus();
  });

  it("moves focus to the sign-in page's title after signing out through a loading answer", async () => {
    const { showVisitor } = renderTheSite(shellFixtures.member);
    await theProfile();
    showVisitor(shellFixtures.loading);
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
    expect(pageTitle()).toHaveFocus();
  });

  it("lands a Settings section link on its heading when the membership check turns into a member", async () => {
    window.history.replaceState(null, "", "/settings?section=messages");
    const { showVisitor } = renderTheSite(shellFixtures.verifying);
    showVisitor(shellFixtures.member);
    const messages = await screen.findByRole("heading", { level: 2, name: "Messages" }, { timeout: 10_000 });
    await waitFor(() => expect(messages).toHaveFocus());
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(messages).toHaveFocus();
  });

  it("moves focus to the closed page's title when getAlbum turns off under an open album page", async () => {
    let album: MyAlbum = albumFixtures.midway;
    const { user, showVisitor } = renderTheSite(shellFixtures.member, () => album);
    await theProfile();
    await user.click(screen.getByRole("button", { name: /^Your emojis/ }));
    album = { kind: "off" };
    showVisitor({ ...shellFixtures.member });
    expect(await screen.findByRole("heading", { level: 1, name: "Not open yet" }, { timeout: 10_000 })).toHaveFocus();
  });
});
