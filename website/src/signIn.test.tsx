import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "./shell";
import { albumFixtures, fixedAlbum, fixedPeople } from "./album/albumFixtures";
import type { Album } from "./album/answer";
import { boardsFixtures, fixedBoards } from "./album/boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./album/hoggiesFixtures";
import { fixedPlayerCards } from "./album/playerCardFixtures";
import { fixedProfile, profileFixtures } from "./album/profileFixtures";
import { fixedQuests, questsFixtures } from "./album/questsFixtures";
import { fixtureWeeks } from "./album/weekFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { findTheAlbum, renderAlbum, renderApp, renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let presses = 0; presses < 20 && document.activeElement !== target; presses++) await user.tab();
  expect(target).toHaveFocus();
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

async function startSignInFromKeyboard() {
  const app = renderApp(shellFixtures.signedOut);
  await tabTo(app.user, screen.getByRole("button", { name: "Sign in with Slack" }));
  await app.user.keyboard("{Enter}");
  return app;
}

function returnFromSlack() {
  return renderApp(shellFixtures.loading);
}

describe("WS6 WS24: signing in with Slack from the keyboard", () => {
  it("starts Slack's sign-in once when Enter is pressed on Sign in with Slack", async () => {
    const { actions } = await startSignInFromKeyboard();
    expect(actions.signIn).toHaveBeenCalledOnce();
  });

  it("keeps the sign-in page while the browser leaves for Slack", async () => {
    const { showVisitor } = await startSignInFromKeyboard();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
  });

  it("shows Sign-in didn't finish when a sign-in started in this browser comes back signed out", async () => {
    const { unmount } = await startSignInFromKeyboard();
    unmount();
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
  });

  it("still shows Sign-in didn't finish when the socket took too long and the answer came after Can't reach HedgeHug", async () => {
    const { unmount } = await startSignInFromKeyboard();
    unmount();
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.connecting);
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
  });

  it("shows the plain sign-in page to a signed-out visitor who never started a sign-in here", () => {
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
  });

  it("tells about an unfinished sign-in only once", async () => {
    (await startSignInFromKeyboard()).unmount();
    const firstReturn = returnFromSlack();
    firstReturn.showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
    firstReturn.unmount();

    returnFromSlack().showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
  });

  it("forgets an unfinished sign-in once a later one finishes, so signing out shows the plain sign-in page", async () => {
    (await startSignInFromKeyboard()).unmount();
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");

    showVisitor(shellFixtures.member);
    showVisitor(shellFixtures.signedOut);

    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
  });

  it("forgets a sign-in that finished, so signing out later shows the plain sign-in page", async () => {
    (await startSignInFromKeyboard()).unmount();
    const { showVisitor } = renderAlbum(shellFixtures.loading, fixedAlbum(albumFixtures.midway));
    showVisitor(shellFixtures.member);
    await findTheAlbum();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
  });

  it("starts Slack's sign-in again from Try again on the didn't-finish page", async () => {
    const { user, actions } = renderApp(shellFixtures.signInUnfinished);
    await tabTo(user, screen.getByRole("button", { name: "Try again" }));
    await user.keyboard("{Enter}");
    expect(actions.signIn).toHaveBeenCalledOnce();
  });

  it("starts a fresh membership check by signing in again from the unverified page", async () => {
    const { user, actions } = renderApp(shellFixtures.unverified);
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(actions.signIn).toHaveBeenCalledOnce();
  });
});

describe("WS9 WS16 WS24: signing out", () => {
  it("signs out from Settings' own Sign out button with the keyboard", async () => {
    window.history.replaceState(null, "", "/settings");
    const { user, actions } = await renderSettingsPage(fixedSettings(settingsFixtures.everything));
    await tabTo(user, within(screen.getByRole("main")).getByRole("button", { name: "Sign out" }));
    await user.keyboard("{Enter}");
    expect(actions.signOut).toHaveBeenCalledOnce();
  });

  it("signs out from the pages of a signed-in person who isn't a member", async () => {
    for (const visitor of [shellFixtures.verifying, shellFixtures.unverified, shellFixtures.notAMember]) {
      const { user, actions, unmount } = renderApp(visitor);
      await tabTo(user, screen.getByRole("button", { name: "Sign out" }));
      await user.keyboard("{Enter}");
      expect(actions.signOut).toHaveBeenCalledOnce();
      unmount();
    }
  });
});

describe("F28: a link from Slack that asks to sign in", () => {
  function arriveAt(address: string) {
    window.history.replaceState(null, "", address);
  }

  function currentAddress() {
    return window.location.pathname + window.location.search;
  }

  it.each([
    { address: "/sign-in/", destination: "/" },
    { address: "/sign-in/quests", destination: "/quests" },
    { address: "/sign-in/leaderboard?period=month", destination: "/leaderboard?period=month" },
    { address: "/sign-in/leaderboard?period=last-week", destination: "/leaderboard?period=last-week" },
    { address: "/sign-in/activity?week=2026-09-28", destination: "/activity?week=2026-09-28" },
  ])("on the closed website, $address starts Slack's sign-in once, returning to $destination", async ({ address, destination }) => {
    arriveAt(address);
    const { actions, showVisitor } = renderApp(shellFixtures.loading);
    showVisitor(shellFixtures.closed);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledOnce());
    expect(actions.signIn).toHaveBeenCalledWith(destination);
    expect(currentAddress()).toBe(destination);
  });

  it("shows no closed page while it takes the visitor to Slack", async () => {
    arriveAt("/sign-in/quests");
    const { actions } = renderApp(shellFixtures.closed);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("keeps a doubled slash behind the entry on this site, returning to the home", async () => {
    arriveAt("/sign-in//example.org/quests");
    const { actions } = renderApp(shellFixtures.closed);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledWith("/"));
  });

  it("starts Slack's sign-in for a signed-out visitor too", async () => {
    arriveAt("/sign-in/quests");
    const { actions } = renderApp(shellFixtures.signedOut);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledWith("/quests"));
  });

  it("leaves a signed-in member on the page and drops the ask from the address", async () => {
    arriveAt("/sign-in/");
    const { actions } = renderAlbum(shellFixtures.member, fixedAlbum(albumFixtures.midway));

    await waitFor(() => expect(currentAddress() + window.location.hash).toBe("/book#me"), { timeout: 10_000 });
    expect(actions.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Your emojis/ })).toBeInTheDocument();
  });

  it.each([
    { later: shellFixtures.closed, title: "Not open yet" },
    { later: shellFixtures.signedOut, title: /^HedgeHug$/ },
  ])("shows a member who arrived with the ask the page their later $later.kind answer calls for", async ({ later, title }) => {
    arriveAt("/sign-in/");
    const { actions, showVisitor } = renderAlbum(shellFixtures.member, fixedAlbum(albumFixtures.midway));
    await waitFor(() => expect(currentAddress() + window.location.hash).toBe("/book#me"), { timeout: 10_000 });

    showVisitor(later);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(actions.signIn).not.toHaveBeenCalled();
  });

  it("never starts a sign-in again after one that didn't finish", async () => {
    arriveAt("/sign-in/");
    const { actions } = renderApp(shellFixtures.signInUnfinished);

    await waitFor(() => expect(currentAddress()).toBe("/"));
    expect(actions.signIn).not.toHaveBeenCalled();
  });

  it("starts nothing on a page without the ask", async () => {
    arriveAt("/quests");
    const { actions } = renderApp(shellFixtures.closed);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(actions.signIn).not.toHaveBeenCalled();
  });
});

describe("MQ22 MQ28: a DM link keeps its quests through sign-in", { timeout: 30_000 }, () => {
  const arrival = { timeout: 10_000 };

  function openAsAMember(address: string) {
    window.history.replaceState(null, "", address);
    const album: Album = { ...albumFixtures.midway, personPageD: true, linkPreviews: true };
    return renderAlbum(shellFixtures.member, fixedAlbum(album), {
      quests: fixedQuests(questsFixtures.newcomer),
      playerCards: fixedPlayerCards(),
      weeks: fixtureWeeks(),
      people: fixedPeople(album),
      boards: fixedBoards(boardsFixtures.week),
      profile: fixedProfile(profileFixtures.noted),
      hoggies: fixedHoggies(hoggiesFixtures.glance),
    });
  }

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { visitor: shellFixtures.signedOut, address: "/book#me/quests" },
    { visitor: shellFixtures.signedOut, address: "/book#me/quests/someone-new" },
    { visitor: shellFixtures.closed, address: "/book#me/quests" },
  ])("a $visitor.kind visitor opening /sign-in$address goes to Slack to come back to $address", async ({ visitor, address }) => {
    window.history.replaceState(null, "", `/sign-in${address}`);
    const { actions } = renderApp(visitor);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledWith(address));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(address);
  });

  it.each([
    { address: "/sign-in/book#me/quests", page: "/book" },
    { address: "/book#me/quests", page: "/book" },
    { address: "/book?code=12345678#me/quests", page: "/book?code=12345678" },
  ])("a member opening $address lands with the quests panel open, at $page", async ({ address, page }) => {
    const { actions } = openAsAMember(address);

    expect(await screen.findByRole("complementary", { name: "Quests" }, arrival)).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(page);
    expect(actions.signIn).not.toHaveBeenCalled();
  });

  it("a member back from Slack with /book#me/quests/someone-new lands with the step's how-to open", async () => {
    openAsAMember("/book?code=12345678#me/quests/someone-new");

    const panel = within(await screen.findByRole("complementary", { name: "Quests" }, arrival));
    const step = within(panel.getByRole("listitem", { name: /^Thank someone you haven't thanked before:/ }));
    expect(await step.findByText("Someone from another team counts, and so does a new joiner.")).toBeInTheDocument();
  });
});

describe("WS6: a sign-in the album asks for is remembered", () => {
  it("remembers a sign-in started from the album's own signed-out answer, so a failed return says it didn't finish", async () => {
    const { user, actions, unmount } = renderAlbum(shellFixtures.member, (asking) => (asking ? { kind: "signed-out" } : undefined));
    await user.click(await screen.findByRole("button", { name: "Sign in with Slack" }, { timeout: 10_000 }));
    expect(actions.signIn).toHaveBeenCalledOnce();
    unmount();

    returnFromSlack().showVisitor(shellFixtures.signedOut);

    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
  });
});
