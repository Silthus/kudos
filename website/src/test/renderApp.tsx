import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App, type AppReads } from "../App";
import type { Capturer } from "../browserAnalytics/capture";
import { CapturingContext } from "../browserAnalytics/capturing";
import { albumFixtures, fixedAlbum } from "../album/albumFixtures";
import type { AlbumRead, BoardsRead, HoggiesRead, PersonRead, ProfileRead, WeekRead } from "../album/answer";
import type { EmojiMappingsRead } from "../emojiMappingsRead";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "../emojiWizardReads";
import type { SettingsRead } from "../settingsRead";
import { ShellBoundary } from "../ShellBoundary";
import { shellFixtures, type ShellActions, type ShellState } from "../shell";

const noSettings: SettingsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

const noEmojiMappings: EmojiMappingsRead = (asking) => (asking ? { kind: "off" } : undefined);

const noSlackEmojiMatches: SlackEmojiMatchesRead = () => ({ kind: "off" });

const noAppEmojis: AppEmojisRead = (asking) => (asking ? { kind: "off" } : undefined);

const noAlbum: AlbumRead = (asking) => (asking ? { kind: "off" } : undefined);

const noBoards: BoardsRead = (asking) => (asking ? { kind: "off" } : undefined);

const noWeeks: WeekRead = (asking) => (asking ? { kind: "off" } : undefined);

const noPeople: PersonRead = (asking) => (asking ? { kind: "off" } : undefined);

const noProfile: ProfileRead = (asking) => (asking ? { kind: "off" } : undefined);

const noHoggies: HoggiesRead = (asking) => (asking ? { kind: "off" } : undefined);

type Commands = Partial<Pick<ShellActions, "setBoardVisibility" | "setMessageSetting" | "pickPrimaryGroup" | "linkMyCompanyProfile" | "linkCompanyProfile" | "setWorkspaceSettings" | "setWeeklyPost" | "mapSlackEmoji" | "mapMyEmoji" | "openThoughtfulPack" | "putIn" | "putAllIn" | "unlockTeamSticker" | "markEmojisSeen">>;

const noReads: AppReads = { useSettings: noSettings, useEmojiMappings: noEmojiMappings, useSlackEmojiMatches: noSlackEmojiMatches, useAppEmojis: noAppEmojis, useAlbum: noAlbum, useThoughtfulBoards: noBoards, useAlbumWeek: noWeeks, useAlbumPerson: noPeople, useAlbumProfile: noProfile, useAlbumHoggies: noHoggies };

export function renderApp(visitor: ShellState) {
  return renderAppWith(visitor, noReads, {});
}

export function renderAlbum(visitor: ShellState, readAlbum: AlbumRead, { settings = noSettings, emojiMappings = noEmojiMappings, slackEmojiMatches = noSlackEmojiMatches, appEmojis = noAppEmojis, boards = noBoards, weeks = noWeeks, people = noPeople, profile = noProfile, hoggies = noHoggies, commands = {}, capturer = null }: { settings?: SettingsRead; emojiMappings?: EmojiMappingsRead; slackEmojiMatches?: SlackEmojiMatchesRead; appEmojis?: AppEmojisRead; boards?: BoardsRead; weeks?: WeekRead; people?: PersonRead; profile?: ProfileRead; hoggies?: HoggiesRead; commands?: Commands; capturer?: Capturer | null } = {}) {
  return renderAppWith(visitor, { ...noReads, useAlbum: readAlbum, useSettings: settings, useEmojiMappings: emojiMappings, useSlackEmojiMatches: slackEmojiMatches, useAppEmojis: appEmojis, useThoughtfulBoards: boards, useAlbumWeek: weeks, useAlbumPerson: people, useAlbumProfile: profile, useAlbumHoggies: hoggies }, commands, capturer);
}

export async function renderSettingsPage(settings: SettingsRead, commands: Commands = {}) {
  const view = renderAlbum(shellFixtures.member, fixedAlbum(albumFixtures.midway), { settings, commands });
  await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });
  return { ...view, showSettingsAgain: () => view.showVisitor({ ...shellFixtures.member }) };
}

function renderAppWith(visitor: ShellState, reads: AppReads, commands: Commands, capturer: Capturer | null = null) {
  const actions = { signIn: vi.fn(), signOut: vi.fn(),
    setBoardVisibility: vi.fn(commands.setBoardVisibility ?? (async () => ({ kind: "refused" }) as const)),
    setMessageSetting: vi.fn(commands.setMessageSetting ?? (async () => ({ kind: "refused" }) as const)),
    pickPrimaryGroup: vi.fn(commands.pickPrimaryGroup ?? (async () => ({ kind: "refused" }) as const)),
    linkMyCompanyProfile: vi.fn(commands.linkMyCompanyProfile ?? (async () => ({ kind: "refused", reason: null }) as const)),
    linkCompanyProfile: vi.fn(commands.linkCompanyProfile ?? (async () => ({ kind: "refused", reason: null }) as const)),
    setWorkspaceSettings: vi.fn(commands.setWorkspaceSettings ?? (async () => ({ kind: "refused", reason: null }) as const)),
    setWeeklyPost: vi.fn(commands.setWeeklyPost ?? (async () => ({ kind: "refused" }) as const)),
    mapSlackEmoji: vi.fn(commands.mapSlackEmoji ?? (async () => ({ kind: "refused" }) as const)),
    mapMyEmoji: vi.fn(commands.mapMyEmoji ?? (async () => ({ kind: "refused" }) as const)),
    openThoughtfulPack: vi.fn(commands.openThoughtfulPack ?? (async () => ({ kind: "refused" }) as const)),
    unlockTeamSticker: vi.fn(commands.unlockTeamSticker ?? (async () => ({ kind: "refused" }) as const)),
    putIn: vi.fn(commands.putIn ?? (async () => ({ kind: "refused" }) as const)),
    putAllIn: vi.fn(commands.putAllIn ?? (async () => ({ kind: "refused" }) as const)),
    markEmojisSeen: vi.fn(commands.markEmojisSeen ?? (async (ids: string[]) => ({ kind: "seen", ids }) as const)),
  };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <CapturingContext value={capturer}>
        <ShellBoundary>
          <App visitor={state} actions={actions} {...reads} />
        </ShellBoundary>
      </CapturingContext>
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
