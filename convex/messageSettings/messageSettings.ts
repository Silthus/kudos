import type { MutationCtx, QueryCtx } from "../_generated/server";
import { achievementsApplyIn, bookAppliesIn } from "../achievements/flag";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import { questsApplyTo } from "../quests/flag";
import { hugsShownTo } from "../hugs/flag";
import { unlocksAppliedTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import { coinsVisibleTo } from "../wallet/visibility";
import { publicCelebrationsOn } from "../workspace/celebrationsSwitch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { directMessageKinds, messageKinds, placesChosenFrom, type MessageKind, type MessageKindEntry, type MessagePlace } from "./kinds";

export type MessageSetting = MessageKindEntry & { applies: boolean; on: boolean; place: MessagePlace; places: readonly MessagePlace[] };

export type NotificationSwitches = { muteNotices: boolean; dms: boolean };

export type ShownNotificationSwitches = Partial<Pick<NotificationSwitches, "muteNotices">> & Pick<NotificationSwitches, "dms">;

type Applies = (ctx: QueryCtx, member: MemberId, workspace: string) => Promise<boolean>;

const appliesWhile: Record<MessageKind, Applies> = {
  "kudos-reply": async () => true,
  tips: async (ctx, member, workspace) => (await skillTreeAppliesIn(ctx, workspace)) || (await coinsVisibleTo(ctx, member)),
  "level-ups": (ctx, member) => xpLevelsOnFor(ctx, member),
  "new-features": async (ctx, member) => (await xpLevelsOnFor(ctx, member)) && (await unlocksAppliedTo(ctx, member)),
  quests: (ctx, member) => questsApplyTo(ctx, member),
  achievements: async (ctx, member, workspace) => (await bookAppliesIn(ctx, workspace)) && (await stateOf(ctx, member, "book")) === "open",
  celebrations: async (ctx, _, workspace) => (await xpLevelsShownIn(ctx, workspace)) && (await publicCelebrationsOn(ctx, workspace)),
  "hugs-recap": (ctx, member) => hugsShownTo(ctx, member),
};

const retirablePartOf: Partial<Record<MessageKind, { appliesWhile: Applies; describedWithout: string }>> = {
  "level-ups": { appliesWhile: (ctx, member) => unlocksAppliedTo(ctx, member), describedWithout: "When you reach a level." },
  celebrations: { appliesWhile: (ctx, _, workspace) => achievementsApplyIn(ctx, workspace), describedWithout: "Your level ups in the announcement channel." },
};

export async function messageSettingsOf(ctx: QueryCtx, member: MemberId): Promise<MessageSetting[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const { kudosEmoji } = await settingsOf(ctx, workspace);
  const settings: MessageSetting[] = [];
  for (const entry of messageKinds) {
    const place = await placeOf(ctx, member, entry.kind);
    const description = (await describedFor(ctx, member, workspace, entry)).replace("{kudos emoji}", `:${kudosEmoji}:`);
    settings.push({ ...entry, description, applies: await kindAppliesTo(ctx, member, entry.kind), on: place !== "none", place, places: await placesOf(ctx, member, entry.kind) });
  }
  return settings;
}

async function describedFor(ctx: QueryCtx, member: MemberId, workspace: string, { kind, description }: MessageKindEntry) {
  const part = retirablePartOf[kind];
  return part === undefined || (await part.appliesWhile(ctx, member, workspace)) ? description : part.describedWithout;
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
  const setting = storedSettingOf(kind, place);
  if (row === null) await ctx.db.insert("messageSettings", { member, kind, ...setting });
  else await ctx.db.patch(row._id, setting);
  return true;
}

function storedSettingOf(kind: MessageKind, place: MessagePlace) {
  const on = place !== "none";
  return { on, place: on && place !== defaultPlaceOf(kind) ? place : undefined };
}

export async function placeWhenOn(ctx: QueryCtx, member: MemberId, kind: MessageKind): Promise<MessagePlace> {
  if (kind === "tips") return placeOfTheReply(ctx, member);
  const chosen = await chosenPlaceOf(ctx, member, kind);
  return chosen === "none" ? defaultPlaceOf(kind) : chosen;
}

export async function notificationSwitchesOf(ctx: QueryCtx, member: MemberId): Promise<ShownNotificationSwitches> {
  const dms = await wantsAnyDirectMessage(ctx, member);
  if (!(await publicCelebrationsOnFor(ctx, member))) return { dms };
  return { muteNotices: !(await wantsMessage(ctx, member, "celebrations")), dms };
}

export async function setNotificationSwitches(ctx: MutationCtx, member: MemberId, { muteNotices, dms }: Partial<NotificationSwitches>) {
  if (muteNotices !== undefined && (await publicCelebrationsOnFor(ctx, member))) await setMessageSetting(ctx, member, "celebrations", muteNotices ? "none" : "channel");
  if (dms !== undefined) for (const kind of directMessageKinds) await setMessageSetting(ctx, member, kind, dms ? await placeWhenOn(ctx, member, kind) : "none");
}

async function publicCelebrationsOnFor(ctx: QueryCtx, member: MemberId) {
  return publicCelebrationsOn(ctx, (await chatUserOf(ctx, member)).workspace);
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
