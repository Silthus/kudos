import type { MutationCtx, QueryCtx } from "../_generated/server";
import { bookAppliesIn } from "../achievements/flag";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import { questsApplyTo } from "../quests/flag";
import { unlocksAppliedTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { directMessageKinds, messageKinds, placesChosenFrom, type MessageKind, type MessageKindEntry, type MessagePlace } from "./kinds";

export type MessageSetting = MessageKindEntry & { applies: boolean; on: boolean; place: MessagePlace; places: readonly MessagePlace[] };

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
  for (const entry of messageKinds) {
    const place = await placeOf(ctx, member, entry.kind);
    settings.push({ ...entry, applies: await kindAppliesTo(ctx, member, entry.kind), on: place !== "none", place, places: await placesOf(ctx, member, entry.kind) });
  }
  return settings;
}

export async function kindAppliesTo(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  return appliesWhile[kind](ctx, member, workspace);
}

export async function wantsMessage(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<boolean> {
  return (await chosenPlaceOf(ctx, member, kind)) !== "none";
}

export async function placeOf(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<MessagePlace> {
  const chosen = await chosenPlaceOf(ctx, member, kind);
  return kind === "tips" && chosen !== "none" ? placeOfTheReply(ctx, member) : chosen;
}

export async function placesOf(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<readonly MessagePlace[]> {
  return kind === "tips" ? [await placeOfTheReply(ctx, member), "none"] : placesChosenFrom[kind];
}

export async function setMessageSetting(ctx: MutationCtx, member: MemberId, kind: MessageKind, place: MessagePlace): Promise<boolean> {
  if ((await placeOf(ctx, member, kind)) === place) return false;
  const row = await settingRow(ctx, member, kind);
  const setting = { on: place !== "none", place };
  if (row === null) await ctx.db.insert("messageSettings", { member, kind, ...setting });
  else await ctx.db.patch(row._id, setting);
  return true;
}

export async function placeWhenOn(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<MessagePlace> {
  if (kind === "tips") return placeOfTheReply(ctx, member);
  const chosen = await chosenPlaceOf(ctx, member, kind);
  return chosen === "none" ? defaultPlaceOf(kind) : chosen;
}

export async function notificationSwitchesOf(ctx: QueryCtx, member: MemberId): Promise<NotificationSwitches> {
  return { muteNotices: !(await wantsMessage(ctx, member, "celebrations")), dms: await wantsAnyDirectMessage(ctx, member) };
}

export async function setNotificationSwitches(ctx: MutationCtx, member: MemberId, { muteNotices, dms }: Partial<NotificationSwitches>) {
  if (muteNotices !== undefined) await setMessageSetting(ctx, member, "celebrations", muteNotices ? "none" : "channel");
  if (dms !== undefined) for (const kind of directMessageKinds) await setMessageSetting(ctx, member, kind, dms ? await placeWhenOn(ctx, member, kind) : "none");
}

async function wantsAnyDirectMessage(ctx: QueryCtx, member: MemberId) {
  for (const kind of directMessageKinds) if (await wantsMessage(ctx, member, kind)) return true;
  return false;
}

async function placeOfTheReply(ctx: QueryCtx, member: MemberId): Promise<MessagePlace> {
  return (await chosenPlaceOf(ctx, member, "kudos-reply")) === "dm" ? "dm" : "channel";
}

async function chosenPlaceOf(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<MessagePlace> {
  const row = await settingRow(ctx, member, kind);
  if (!(row?.on ?? (await todaysDefaultOf(ctx, member, kind)))) return "none";
  return row?.place ?? defaultPlaceOf(kind);
}

function defaultPlaceOf(kind: MessageKind): MessagePlace {
  return kind === "tips" ? "channel" : placesChosenFrom[kind][0]!;
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
