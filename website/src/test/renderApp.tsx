import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App } from "../App";
import type { BoardRead } from "../boardRead";
import type { QuestsRead } from "../questsRead";
import { ShellBoundary } from "../Root";
import type { ShellActions, ShellState } from "../shell";

const noBoard: BoardRead = (period) => (period === undefined ? undefined : { kind: "not-found" });

const noQuests: QuestsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

type Commands = Partial<Pick<ShellActions, "openFeature" | "openQuestCrate">>;

export function renderApp(visitor: ShellState, readLeaderboard: BoardRead = noBoard, commands: Commands = {}, readQuests: QuestsRead = noQuests) {
  const actions = { signIn: vi.fn(), signOut: vi.fn(), openFeature: vi.fn(commands.openFeature ?? (async () => ({ kind: "refused" }) as const)),
    openQuestCrate: vi.fn(commands.openQuestCrate ?? (async () => ({ kind: "refused" }) as const)),
  };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <ShellBoundary>
        <App visitor={state} actions={actions} useLeaderboard={readLeaderboard} useQuests={readQuests} />
      </ShellBoundary>
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
