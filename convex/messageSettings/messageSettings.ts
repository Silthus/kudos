import type { MutationCtx, QueryCtx } from "../_generated/server";
import { bookAppliesIn } from "../achievements/flag";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import { questsApplyTo } from "../quests/flag";
import { unlocksAppliedTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { directMessageKinds, messageKinds, type MessageKind, type MessageKindEntry } from "./kinds";

export type MessageSetting = MessageKindEntry & { applies: boolean; on: boolean };

export type NotificationSwitches = { muteNotices: boolean; dms: boolean };

type Applies = (ctx: QueryCtx, member: MemberId, workspace: string) => Promise<boolean>;

const appliesWhile: Record<MessageKind, Applies> = {
  "kudos-reply": async () => true,
  tips: async (ctx, member, workspace) => (await skillTreeAppliesIn(ctx, workspace)) || (await coinsVisibleTo(ctx, member)),
  "level-ups": (ctx, member) => xpLevelsOnFor(ctx, member),
  "new-features": async (ctx, member) => (await xpLevelsOnFor(ctx, member)) && (await unlocksAppliedTo(ctx, member)),
  quests: (ctx, member) => questsApplyTo(ctx, member),
  achievements: async (ctx, member, workspace) => (await bookAppliesIn(ctx, workspace)) && (await stateOf(ctx, member, "book")) === "open",
  celebrations: (ctx, _, workspace) => xpLevelsShownIn(ctx, workspace),
};

export async function messageSettingsOf(ctx: QueryCtx, member: MemberId): Promise<MessageSetting[]> {
  const settings: MessageSetting[] = [];
  for (const entry of messageKinds) settings.push({ ...entry, applies: await kindAppliesTo(ctx, member, entry.kind), on: await wantsMessage(ctx, member, entry.kind) });
  return settings;
}

export async function kindAppliesTo(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  return appliesWhile[kind](ctx, member, workspace);
}

export async function wantsMessage(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<boolean> {
  return (await settingRow(ctx, member, kind))?.on ?? (await todaysDefaultOf(ctx, member, kind));
}

export async function setMessageSetting(ctx: MutationCtx, member: MemberId, kind: MessageKind, on: boolean): Promise<boolean> {
  if ((await wantsMessage(ctx, member, kind)) === on) return false;
  const row = await settingRow(ctx, member, kind);
  if (row === null) await ctx.db.insert("messageSettings", { member, kind, on });
  else await ctx.db.patch(row._id, { on });
  return true;
}

export async function notificationSwitchesOf(ctx: QueryCtx, member: MemberId): Promise<NotificationSwitches> {
  return { muteNotices: !(await wantsMessage(ctx, member, "celebrations")), dms: await wantsAnyDirectMessage(ctx, member) };
}

export async function setNotificationSwitches(ctx: MutationCtx, member: MemberId, { muteNotices, dms }: Partial<NotificationSwitches>) {
  if (muteNotices !== undefined) await setMessageSetting(ctx, member, "celebrations", !muteNotices);
  if (dms !== undefined) for (const kind of directMessageKinds) await setMessageSetting(ctx, member, kind, dms);
}

async function wantsAnyDirectMessage(ctx: QueryCtx, member: MemberId) {
  for (const kind of directMessageKinds) if (await wantsMessage(ctx, member, kind)) return true;
  return false;
}

async function todaysDefaultOf(ctx: QueryCtx, member: MemberId, kind: MessageKind) {
  const today = await ctx.db
    .query("progressSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  if (kind === "celebrations") return !(today?.muteNotices ?? false);
  return directMessageKinds.includes(kind) ? (today?.dms ?? true) : true;
}

function settingRow(ctx: QueryCtx, member: MemberId, kind: MessageKind) {
  return ctx.db
    .query("messageSettings")
    .withIndex("by_member_kind", (q) => q.eq("member", member).eq("kind", kind))
    .unique();
}
