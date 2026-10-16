import type { QueryCtx } from "../_generated/server";
import { groupsShownTo } from "../groups/groups";
import { groupChoiceOf, type GroupChoice } from "../groups/pick";
import { isOnTheBoards } from "../leaderboard/visibility";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { messageSettingsOf, type MessageSetting } from "../messageSettings/messageSettings";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { settingsSections, type SettingsSection } from "./routes";
import { leaderboardStateOf, unlockPathOf, type FeaturePage } from "./unlockPath";

export type { MessageSetting } from "../messageSettings/messageSettings";
export type { MessageKind, MessagePlace } from "../messageSettings/kinds";
export type { GroupChoice } from "../groups/pick";

export type MySettings = { kind: "settings"; board: { onTheBoards: boolean } | null; messages: MessageSetting[] | null; group: GroupChoice | null };

export type SettingsAnswer = MySettings | { kind: "not-found" };

export const getSettings = memberQuery(async (ctx, me): Promise<SettingsAnswer> => {
  const settings = await settingsOf(ctx, me);
  return hasAny(settings) ? settings : { kind: "not-found" };
});

export async function settingsShownTo(ctx: QueryCtx, me: VerifiedMember, leaderboard: FeaturePage): Promise<boolean> {
  if (leaderboard.kind === "open" || (await messageSettingsOnFor(ctx, me.member))) return true;
  return (await groupPickOf(ctx, me)) !== null;
}

async function settingsOf(ctx: QueryCtx, me: VerifiedMember): Promise<MySettings> {
  return { kind: "settings", board: await boardSettingOf(ctx, me), messages: await messagesOf(ctx, me), group: await groupPickOf(ctx, me) };
}

export async function settingsSectionsShownTo(ctx: QueryCtx, me: VerifiedMember): Promise<SettingsSection[]> {
  const { board, messages, group } = await settingsOf(ctx, me);
  const shown: Record<SettingsSection, boolean> = { visibility: board !== null, messages: messages !== null, group: group !== null };
  return settingsSections.filter((section) => shown[section]);
}

function hasAny({ board, messages, group }: MySettings) {
  return board !== null || messages !== null || group !== null;
}

async function boardSettingOf(ctx: QueryCtx, me: VerifiedMember) {
  if ((await leaderboardStateOf(ctx, me, await unlockPathOf(ctx, me))).kind !== "open") return null;
  return { onTheBoards: await isOnTheBoards(ctx, me.member) };
}

async function messagesOf(ctx: QueryCtx, me: VerifiedMember) {
  if (!(await messageSettingsOnFor(ctx, me.member))) return null;
  return (await messageSettingsOf(ctx, me.member)).filter(({ applies }) => applies);
}

async function groupPickOf(ctx: QueryCtx, me: VerifiedMember) {
  if (!(await groupsShownTo(ctx, me.member))) return null;
  const choice = await groupChoiceOf(ctx, me.member);
  return choice !== null && choice.groups.length > 1 ? choice : null;
}
