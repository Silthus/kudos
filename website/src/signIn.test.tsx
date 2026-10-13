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
