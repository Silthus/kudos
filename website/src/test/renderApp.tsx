import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App } from "../App";
import type { BoardRead } from "../boardRead";
import type { BookRead } from "../bookRead";
import type { QuestsRead } from "../questsRead";
import type { SkillTreeRead } from "../skillTreeRead";
import { ShellBoundary } from "../Root";
import type { ShellActions, ShellState } from "../shell";

const noBoard: BoardRead = (period) => (period === undefined ? undefined : { kind: "not-found" });

const noQuests: QuestsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noBook: BookRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noSkillTree: SkillTreeRead = (asking) => (asking ? { kind: "not-found" } : undefined);

type Commands = Partial<Pick<ShellActions, "openFeature" | "openQuestCrate" | "buyPerk" | "setBoardVisibility" | "swapQuest">>;

export function renderApp(visitor: ShellState, readLeaderboard: BoardRead = noBoard, commands: Commands = {}, readQuests: QuestsRead = noQuests, readBook: BookRead = noBook, readSkillTree: SkillTreeRead = noSkillTree) {
  const actions = { signIn: vi.fn(), signOut: vi.fn(), openFeature: vi.fn(commands.openFeature ?? (async () => ({ kind: "refused" }) as const)),
    openQuestCrate: vi.fn(commands.openQuestCrate ?? (async () => ({ kind: "refused" }) as const)),
    buyPerk: vi.fn(commands.buyPerk ?? (async () => ({ kind: "refused", reason: null }) as const)),
    setBoardVisibility: vi.fn(commands.setBoardVisibility ?? (async () => ({ kind: "refused" }) as const)),
    swapQuest: vi.fn(commands.swapQuest ?? (async () => ({ kind: "refused" }) as const)),
  };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <ShellBoundary>
        <App visitor={state} actions={actions} useLeaderboard={readLeaderboard} useQuests={readQuests} useBook={readBook} useSkillTree={readSkillTree} />
      </ShellBoundary>
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
