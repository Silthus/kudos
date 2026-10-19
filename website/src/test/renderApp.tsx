import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App, type AppReads } from "../App";
import type { ActivityRead, ActivityWatch } from "../activityRead";
import type { AlbumRead, BoardsRead, WeekRead } from "../album/answer";
import type { BoardRead } from "../boardRead";
import type { BookRead } from "../bookRead";
import type { CollectionRead } from "../collectionRead";
import type { ProfileCardRead } from "../profileCardRead";
import type { QuestsRead } from "../questsRead";
import type { RecentKudosRead } from "../recentKudosRead";
import type { SettingsRead } from "../settingsRead";
import type { SkillTreeRead } from "../skillTreeRead";
import type { SpotlightDraw } from "../spotlightRead";
import { ShellBoundary } from "../ShellBoundary";
import type { ShellActions, ShellState } from "../shell";

const noBoard: BoardRead = (period) => (period === undefined ? undefined : { kind: "not-found" });

const noQuests: QuestsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noBook: BookRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noCollection: CollectionRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noSkillTree: SkillTreeRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noRecentKudos: RecentKudosRead = () => ({ kind: "not-found" });

const noSpotlight: SpotlightDraw = async () => ({ kind: "not-found" });

const noActivity: ActivityReads = { watch: (filter) => (filter === undefined ? undefined : { kind: "not-found" }), read: async () => ({ kind: "not-found" }) };

type ActivityReads = { watch: ActivityWatch; read: ActivityRead };

const noSettings: SettingsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noProfileCard: ProfileCardRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noAlbum: AlbumRead = (asking) => (asking ? { kind: "off" } : undefined);

const noBoards: BoardsRead = (asking) => (asking ? { kind: "off" } : undefined);

const noWeeks: WeekRead = (asking) => (asking ? { kind: "off" } : undefined);

type Commands = Partial<Pick<ShellActions, "openFeature" | "openQuestCrate" | "buyPerk" | "buyItem" | "buyCrate" | "openCrate" | "setBoardVisibility" | "setMessageSetting" | "pickPrimaryGroup" | "linkMyCompanyProfile" | "linkCompanyProfile" | "setWorkspaceSettings" | "setAvatar" | "swapQuest" | "openThoughtfulPack" | "putIn" | "putAllIn">>;

const noReads: AppReads = { useLeaderboard: noBoard, useQuests: noQuests, useBook: noBook, useCollection: noCollection, useSkillTree: noSkillTree, useProfileCard: noProfileCard, useRecentKudos: noRecentKudos, useActivityWatch: noActivity.watch, readActivity: noActivity.read, drawSpotlight: noSpotlight, useSettings: noSettings, useAlbum: noAlbum, useThoughtfulBoards: noBoards, useAlbumWeek: noWeeks };

export function renderApp(visitor: ShellState, readLeaderboard: BoardRead = noBoard, commands: Commands = {}, readQuests: QuestsRead = noQuests, readBook: BookRead = noBook, readSkillTree: SkillTreeRead = noSkillTree, readProfileCard: ProfileCardRead = noProfileCard, readRecentKudos: RecentKudosRead = noRecentKudos, activity: ActivityReads = noActivity, drawSpotlight: SpotlightDraw = noSpotlight, readSettings: SettingsRead = noSettings, readCollection: CollectionRead = noCollection) {
  return renderAppWith(visitor, { useLeaderboard: readLeaderboard, useQuests: readQuests, useBook: readBook, useSkillTree: readSkillTree, useProfileCard: readProfileCard, useRecentKudos: readRecentKudos, useActivityWatch: activity.watch, readActivity: activity.read, drawSpotlight, useSettings: readSettings, useCollection: readCollection, useAlbum: noAlbum, useThoughtfulBoards: noBoards, useAlbumWeek: noWeeks }, commands);
}

export function renderAlbum(visitor: ShellState, readAlbum: AlbumRead, { settings = noSettings, boards = noBoards, weeks = noWeeks, commands = {} }: { settings?: SettingsRead; boards?: BoardsRead; weeks?: WeekRead; commands?: Commands } = {}) {
  return renderAppWith(visitor, { ...noReads, useAlbum: readAlbum, useSettings: settings, useThoughtfulBoards: boards, useAlbumWeek: weeks }, commands);
}

function renderAppWith(visitor: ShellState, reads: AppReads, commands: Commands) {
  const actions = { signIn: vi.fn(), signOut: vi.fn(), openFeature: vi.fn(commands.openFeature ?? (async () => ({ kind: "refused" }) as const)),
    openQuestCrate: vi.fn(commands.openQuestCrate ?? (async () => ({ kind: "refused" }) as const)),
    buyPerk: vi.fn(commands.buyPerk ?? (async () => ({ kind: "refused", reason: null }) as const)),
    buyItem: vi.fn(commands.buyItem ?? (async () => ({ kind: "refused", reason: null }) as const)),
    buyCrate: vi.fn(commands.buyCrate ?? (async () => null)),
    openCrate: vi.fn(commands.openCrate ?? (async () => ({ kind: "refused" }) as const)),
    setBoardVisibility: vi.fn(commands.setBoardVisibility ?? (async () => ({ kind: "refused" }) as const)),
    setMessageSetting: vi.fn(commands.setMessageSetting ?? (async () => ({ kind: "refused" }) as const)),
    pickPrimaryGroup: vi.fn(commands.pickPrimaryGroup ?? (async () => ({ kind: "refused" }) as const)),
    linkMyCompanyProfile: vi.fn(commands.linkMyCompanyProfile ?? (async () => ({ kind: "refused", reason: null }) as const)),
    linkCompanyProfile: vi.fn(commands.linkCompanyProfile ?? (async () => ({ kind: "refused", reason: null }) as const)),
    setWorkspaceSettings: vi.fn(commands.setWorkspaceSettings ?? (async () => ({ kind: "refused", reason: null }) as const)),
    setAvatar: vi.fn(commands.setAvatar ?? (async () => ({ kind: "refused" }) as const)),
    swapQuest: vi.fn(commands.swapQuest ?? (async () => ({ kind: "refused" }) as const)),
    openThoughtfulPack: vi.fn(commands.openThoughtfulPack ?? (async () => ({ kind: "refused" }) as const)),
    putIn: vi.fn(commands.putIn ?? (async () => ({ kind: "refused" }) as const)),
    putAllIn: vi.fn(commands.putAllIn ?? (async () => ({ kind: "refused" }) as const)),
  };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <ShellBoundary>
        <App visitor={state} actions={actions} {...reads} />
      </ShellBoundary>
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
