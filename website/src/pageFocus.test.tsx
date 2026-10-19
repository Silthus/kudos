import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { albumFixtures, fixedAlbum } from "./album/albumFixtures";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
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

function renderTheSite(visitor: ShellState) {
  return renderAlbum(visitor, fixedAlbum(albumFixtures.midway), { profile: fixedProfile(profileFixtures.noted), boards: fixedBoards(boardsFixtures.week), hoggies: fixedHoggies(hoggiesFixtures.midway) });
}

async function theProfile() {
  return screen.findByRole("heading", { level: 1, name: "Sam Example" });
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
});
