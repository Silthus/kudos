import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
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
    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
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
    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
  });

  it("tells about an unfinished sign-in only once", async () => {
    (await startSignInFromKeyboard()).unmount();
    const firstReturn = returnFromSlack();
    firstReturn.showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
    firstReturn.unmount();

    returnFromSlack().showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
  });

  it("forgets an unfinished sign-in once a later one finishes, so signing out shows the plain sign-in page", async () => {
    (await startSignInFromKeyboard()).unmount();
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");

    showVisitor(shellFixtures.member);
    showVisitor(shellFixtures.signedOut);

    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
  });

  it("forgets a sign-in that finished, so signing out later shows the plain sign-in page", async () => {
    (await startSignInFromKeyboard()).unmount();
    const { showVisitor } = returnFromSlack();
    showVisitor(shellFixtures.member);
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
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
  it("signs out from the avatar menu with the keyboard: Enter opens it on Sign out, Enter signs out", async () => {
    const { user, actions } = renderApp(shellFixtures.member);
    const menuButton = screen.getByRole("button", { name: "Account menu for Sam Example" });
    await tabTo(user, menuButton);
    await user.keyboard("{Enter}");
    const signOut = await screen.findByRole("menuitem", { name: "Sign out" });
    await waitFor(() => expect(signOut).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(actions.signOut).toHaveBeenCalledOnce();
  });

  it("opens the avatar menu with ArrowDown and closes it with Escape, returning focus to the avatar", async () => {
    const { user, actions } = renderApp(shellFixtures.member);
    const menuButton = screen.getByRole("button", { name: "Account menu for Sam Example" });
    await tabTo(user, menuButton);
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(menuButton).toHaveFocus();
    expect(actions.signOut).not.toHaveBeenCalled();
  });

  it("closes the avatar menu when Tab moves focus out of it", async () => {
    const { user } = renderApp(shellFixtures.member);
    await tabTo(user, screen.getByRole("button", { name: "Account menu for Sam Example" }));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus());
    await user.tab();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
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
    { address: "/?sign-in", destination: "/" },
    { address: "/quests?sign-in", destination: "/quests" },
    { address: "/leaderboard?period=month&sign-in", destination: "/leaderboard?period=month" },
  ])("on the closed website, $address starts Slack's sign-in once, returning to $destination", async ({ address, destination }) => {
    arriveAt(address);
    const { actions, showVisitor } = renderApp(shellFixtures.loading);
    showVisitor(shellFixtures.closed);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledOnce());
    expect(actions.signIn).toHaveBeenCalledWith(destination);
    expect(currentAddress()).toBe(destination);
  });

  it("shows no closed page while it takes the visitor to Slack", async () => {
    arriveAt("/quests?sign-in");
    const { actions } = renderApp(shellFixtures.closed);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("starts Slack's sign-in for a signed-out visitor too", async () => {
    arriveAt("/quests?sign-in");
    const { actions } = renderApp(shellFixtures.signedOut);

    await waitFor(() => expect(actions.signIn).toHaveBeenCalledWith("/quests"));
  });

  it("leaves a signed-in member on the page and drops the ask from the address", async () => {
    arriveAt("/?sign-in");
    const { actions } = renderApp(shellFixtures.member);

    await waitFor(() => expect(currentAddress()).toBe("/"));
    expect(actions.signIn).not.toHaveBeenCalled();
    expect(pageTitle()).not.toHaveTextContent(/^Sign in$/);
  });

  it("never starts a sign-in again after one that didn't finish", async () => {
    arriveAt("/?sign-in");
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
