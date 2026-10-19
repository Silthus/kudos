import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { albumFixtures, fixedAlbum } from "./album/albumFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { renderAlbum, renderApp, renderSettingsPage } from "./test/renderApp";
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
    await screen.findByRole("navigation", { name: "Album" });
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

    await waitFor(() => expect(currentAddress() + window.location.hash).toBe("/book#me"));
    expect(actions.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("navigation", { name: "Album" })).toBeInTheDocument();
  });

  it.each([
    { later: shellFixtures.closed, title: "Not open yet" },
    { later: shellFixtures.signedOut, title: /^HedgeHug$/ },
  ])("shows a member who arrived with the ask the page their later $later.kind answer calls for", async ({ later, title }) => {
    arriveAt("/sign-in/");
    const { actions, showVisitor } = renderAlbum(shellFixtures.member, fixedAlbum(albumFixtures.midway));
    await waitFor(() => expect(currentAddress() + window.location.hash).toBe("/book#me"));

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
