import type { AdminProfileLinkAnswer, CompanyProfileLinkAnswer, GroupPickAnswer, MessageSettingAnswer, VisibilityAnswer, WeeklyPostAnswer, WeeklyPostChannelAnswer, WorkspaceSettingsAnswer } from "../../convex/website/commands";
import type { MessageKind, MessagePlace, SettingsAnswer } from "../../convex/website/settings";
import type { EmojiMappingAnswer, EmojiMappings, EmojiMappingsRead as EmojiMappingsReadAnswer, ShownTarget } from "../../convex/website/emojiMappings";
import type { AppEmojisRead as AppEmojisReadAnswer, MyEmojiMappingAnswer, SlackEmojiMatchesRead as SlackEmojiMatchesReadAnswer } from "../../convex/website/emojiWizard";
import type { TurnAnswer } from "../../convex/website/album";
import type { ShareAnswer } from "../../convex/website/itemShare";
import type { ArrivalAnswer } from "../../convex/website/lastVisit";
import type { Denial } from "../../convex/website/memberQuery";
import type { MemberProfile, MyProfile } from "../../convex/website/profile";
import { albumFixtures, fixturePackOpeningOf, fixturePutAllIn, fixturePutInOf, fixtureTurnOf, fixtureUnlockOf } from "./album/albumFixtures";
import type { PackOpenReply, PetReply, PutAllInReply, PutInReply, SeenReply, UnlockReply } from "./album/answer";

export type { Rarity } from "./crates/drops";
export type { Face } from "../../convex/website/profile";
export type { LadderCard } from "../../convex/website/book";
export type { TierId } from "../../convex/achievements/ladders";
export type { Period } from "../../convex/leaderboard/periods";
export type { AdminProfiles, CompanyProfileSetting, GroupChoice, MessageKind, MessagePlace, MessageSetting, MySettings, ProfileChoice, WeeklyPostSetting, WorkspaceSettingsPart } from "../../convex/website/settings";
export type { Message, Segment } from "../../convex/website/activity";

export type VisibilityReply = VisibilityAnswer | Denial;

export type MessageSettingReply = MessageSettingAnswer | Denial;

export type GroupPickReply = GroupPickAnswer | Denial;

export type CompanyProfileLinkReply = CompanyProfileLinkAnswer | Denial;

export type AdminProfileLinkReply = AdminProfileLinkAnswer | Denial;

export type WorkspaceSettingsReply = WorkspaceSettingsAnswer | Denial;

export type WeeklyPostReply = WeeklyPostAnswer | Denial;

export type WeeklyPostChannelReply = WeeklyPostChannelAnswer | Denial;

export type WorkspaceSettingsChange = { baseAllowance: number; kudosEmoji: string; hugBudget: number };

export type AdminLinkTarget = number | "none" | null;

export type TurnReply = TurnAnswer | Denial;

export type ShareReply = ShareAnswer | Denial;

export type ArrivalReply = ArrivalAnswer | Denial;

export type MySettingsAnswer = SettingsAnswer | Denial;

export type { EmojiMappings };

export type ShownMappingTarget = ShownTarget;

export type EmojiPlaceChoice = ShownTarget | { kind: "unmapped" };

export type EmojiMappingsAnswer = EmojiMappingsReadAnswer | Denial;

export type EmojiMappingReply = EmojiMappingAnswer | Denial;

export type SlackEmojiMatchesAnswer = SlackEmojiMatchesReadAnswer | Denial;

export type AppEmojisAnswer = AppEmojisReadAnswer | Denial;

export type MyEmojiMappingReply = MyEmojiMappingAnswer | Denial;

export type Member = { kind: "member" };

export type Visitor = Exclude<MyProfile, MemberProfile> | Member | { kind: "loading" } | { kind: "connecting" } | { kind: "sign-in-unfinished" };

export type ShellState = Visitor | { kind: "broken" };

export type ShellActions = { signIn(returnTo: string): void; signOut(): void; setBoardVisibility(visible: boolean): Promise<VisibilityReply>; setMessageSetting(kind: MessageKind, place: MessagePlace): Promise<MessageSettingReply>; pickPrimaryGroup(group: string): Promise<GroupPickReply>; linkMyCompanyProfile(profile: number | null): Promise<CompanyProfileLinkReply>; linkCompanyProfile(member: string, profile: AdminLinkTarget): Promise<AdminProfileLinkReply>; setWorkspaceSettings(settings: WorkspaceSettingsChange): Promise<WorkspaceSettingsReply>; setWeeklyPost(on: boolean): Promise<WeeklyPostReply>; pickWeeklyPostChannel(link: string): Promise<WeeklyPostChannelReply>; mapSlackEmoji(emoji: string, to: EmojiPlaceChoice): Promise<EmojiMappingReply>; mapMyEmoji(emoji: string, to: string): Promise<MyEmojiMappingReply>; openThoughtfulPack(pack: string): Promise<PackOpenReply>; putIn(item: string): Promise<PutInReply>; putAllIn(): Promise<PutAllInReply>; unlockTeamSticker(team: string): Promise<UnlockReply>; markEmojisSeen(ids: string[]): Promise<SeenReply>; turnItem(item: string): Promise<TurnReply>; shareItem(item: string): Promise<ShareReply>; makePet(hoggie: string): Promise<PetReply>; arrive(from: number | null): Promise<ArrivalReply>; endXpMoment(from: number, until: number, skipped: boolean): Promise<ArrivalReply> };

const member: Member = { kind: "member" };

export const shellFixtures = {
  loading: { kind: "loading" },
  connecting: { kind: "connecting" },
  closed: { kind: "closed" },
  signedOut: { kind: "signed-out" },
  signInUnfinished: { kind: "sign-in-unfinished" },
  verifying: { kind: "verifying" },
  unverified: { kind: "unverified" },
  notAMember: { kind: "not-a-member" },
  member,
  error: { kind: "broken" },
} as const satisfies Record<string, ShellState>;

const fixturesByName: Record<string, ShellState> = {
  loading: shellFixtures.loading,
  connecting: shellFixtures.connecting,
  closed: shellFixtures.closed,
  "signed-out": shellFixtures.signedOut,
  "sign-in-unfinished": shellFixtures.signInUnfinished,
  verifying: shellFixtures.verifying,
  unverified: shellFixtures.unverified,
  "not-a-member": shellFixtures.notAMember,
  album: shellFixtures.member,
  "album-maintainer": shellFixtures.member,
  "album-without-a-team": shellFixtures.member,
  "album-with-new-emojis": shellFixtures.member,
  "album-as-an-admin": shellFixtures.member,
  "album-emoji-wizard": shellFixtures.member,
  "album-with-items": shellFixtures.member,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {}, setBoardVisibility: async (visible) => ({ kind: "set", visible }), setMessageSetting: async (_kind, place) => ({ kind: "set", place }), pickPrimaryGroup: async (group) => ({ kind: "picked", group }), linkMyCompanyProfile: async () => ({ kind: "linked" }), linkCompanyProfile: async () => ({ kind: "linked" }), setWorkspaceSettings: async () => ({ kind: "set" }), setWeeklyPost: async () => ({ kind: "set" }), pickWeeklyPostChannel: async () => ({ kind: "checking", pick: 1 }), mapSlackEmoji: async () => ({ kind: "mapped" }), mapMyEmoji: async () => ({ kind: "mapped" }), openThoughtfulPack: async (pack) => fixturePackOpeningOf(pack), putIn: async (item) => fixturePutInOf(item), putAllIn: async () => fixturePutAllIn(), unlockTeamSticker: async (team) => fixtureUnlockOf(albumFixtures.midway, team), markEmojisSeen: async (ids) => ({ kind: "seen", ids }), turnItem: async (item) => fixtureTurnOf(item), shareItem: async () => ({ kind: "shared" }), makePet: async (hoggie) => ({ kind: "picked", pet: hoggie }), arrive: async (from) => ({ kind: "arrived", lastVisit: from }), endXpMoment: async (_from, until) => ({ kind: "arrived", lastVisit: until }) };
