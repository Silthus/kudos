import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App } from "../App";
import type { LeaderboardRead } from "../leaderboardFixtures";
import { ShellBoundary } from "../Root";
import type { ShellState } from "../shell";

const noBoard: LeaderboardRead = (period) => (period === undefined ? undefined : { kind: "not-found" });

export function renderApp(visitor: ShellState, readLeaderboard: LeaderboardRead = noBoard) {
  const actions = { signIn: vi.fn(), signOut: vi.fn() };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <ShellBoundary>
        <App visitor={state} actions={actions} useLeaderboard={readLeaderboard} />
      </ShellBoundary>
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
