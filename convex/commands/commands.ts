import { v, type GenericValidator, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { pickSurfaceValidator, reportLeaderboardViewed, reportLeaderboardVisibilityChanged, reportMessageSettingChanged, reportPrimaryGroupPicked } from "../analytics/isolatedUsage";
import { groupsShownAndExposedTo } from "../groups/groups";
import { pickPrimaryGroup } from "../groups/pick";
import { homeTabValidator, isLeaderboardShownTo, selectLeaderboardPeriod, showHomeTab, type HomeMember } from "../feedback/homes";
import { setGroupMode } from "../groups/groupMode";
import { groupModeValidator } from "../groups/mode";
import { boardsShownTo } from "../leaderboard/boards";
import { setMondayPost } from "../leaderboard/mondayPost";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import { periodValidator, type Period } from "../leaderboard/periods";
import { messageSettingsShownTo } from "../messageSettings/flag";
import { messageKindValidator, messagePlaceValidator, type MessageKind, type MessagePlace } from "../messageSettings/kinds";
import { kindAppliesTo, placesOf, placeWhenOn, setMessageSetting, setNotificationSwitches } from "../messageSettings/messageSettings";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { buyPerk } from "../progression/perks";
import type { PurchaseOutcome } from "../progression/purchases";
import { perkValidator } from "../progression/tree";
import { openQuestCrate } from "../quests/open";
import { questValidator, weeklyQuestValidator } from "../quests/step";
import { rerollQuest } from "../quests/weekly";
import { teamPagesApplyTo } from "../companyProfiles/flag";
import { linkCompanyProfile, type AdminLinkOutcome } from "../companyProfiles/admin";
import { linkMyCompanyProfile, type SelfLinkOutcome } from "../companyProfiles/links";
import { setAvatar } from "../hoggies/avatar";
import { avatarShownTo } from "../hoggies/flag";
import { buyCrate, openCrate } from "../hoggies/boughtCrates";
import type { CratePurchaseOutcome } from "../hoggies/records";
import { buyItem } from "../store/buying";
import { setCustomKudosEmoji } from "../store/customKudosEmoji";
import type { ItemPurchaseOutcome } from "../store/rows";
import { xpLevelsShownTo } from "../progression/xpLevels";
import type { Surface } from "./surface";
import { featureValidator } from "../unlocks/feature";
import { openUnlock } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { setAnnouncementChannel } from "../workspace/settings";
import { changeWorkspaceSettings, type WorkspaceSettingsOutcome } from "../workspace/workspaceSettings";

export const commandValidator = v.union(
  v.object({ type: v.literal("showHomeTab"), tab: homeTabValidator }),
  v.object({ type: v.literal("showLeaderboard"), period: periodValidator }),
  v.object({ type: v.literal("setLeaderboardVisibility"), visible: v.boolean() }),
  v.object({ type: v.literal("setProgressSettings"), muteNotices: v.optional(v.boolean()), dms: v.optional(v.boolean()) }),
  v.object({ type: v.literal("setMessageSetting"), kind: messageKindValidator, place: messagePlaceValidator }),
  v.object({ type: v.literal("setMessageSetting"), kind: messageKindValidator, on: v.boolean() }),
  v.object({ type: v.literal("setAnnouncementChannel"), channel: v.union(v.string(), v.null()) }),
  v.object({ type: v.literal("openUnlock"), feature: featureValidator }),
  v.object({ type: v.literal("openQuestCrate"), quest: questValidator }),
  v.object({ type: v.literal("rerollQuest"), quest: weeklyQuestValidator }),
  v.object({ type: v.literal("buyPerk"), perk: perkValidator }),
  v.object({ type: v.literal("pickPrimaryGroup"), group: v.string(), surface: pickSurfaceValidator }),
  v.object({ type: v.literal("setGroupMode"), mode: groupModeValidator, allowlist: v.optional(v.array(v.string())) }),
  v.object({ type: v.literal("setMondayPost"), on: v.boolean(), timeZone: v.optional(v.string()) }),
  v.object({ type: v.literal("buyItem"), item: v.string() }),
  v.object({ type: v.literal("setCustomKudosEmoji"), emoji: v.array(v.string()) }),
  v.object({ type: v.literal("buyCrate"), next: v.number() }),
  v.object({ type: v.literal("openCrate"), crate: v.string() }),
  v.object({ type: v.literal("setAvatar"), hoggie: v.union(v.string(), v.null()) }),
  v.object({ type: v.literal("linkMyCompanyProfile"), profile: v.union(v.number(), v.null()) }),
  v.object({ type: v.literal("linkCompanyProfile"), member: v.union(v.id("members"), v.null()), profile: v.union(v.number(), v.literal("none"), v.null()) }),
  v.object({ type: v.literal("setWorkspaceSettings"), baseAllowance: v.number(), kudosEmoji: v.string(), hugBudget: v.number() }),
);

export type Command = Infer<typeof commandValidator>;

export type CommandOrigin = { surface: Surface; idempotencyKey: string };

export type CommandOutcome = PurchaseOutcome | ItemPurchaseOutcome | CratePurchaseOutcome | SelfLinkOutcome | AdminLinkOutcome | WorkspaceSettingsOutcome | null;

const websiteOnly: ReadonlySet<Command["type"]> = new Set(["linkMyCompanyProfile", "linkCompanyProfile", "setWorkspaceSettings"]);

export function isWebsiteOnly({ type }: Command): boolean {
  return websiteOnly.has(type);
}

export function commandOf(candidate: unknown): Command | null {
  return conforms(commandValidator, candidate) ? (candidate as Command) : null;
}

export async function commandsOfferedTo(ctx: QueryCtx, member: MemberId, commands: Command[]): Promise<Command[]> {
  const setsAvatar = ({ type }: Command) => type === "setAvatar";
  if (!commands.some(setsAvatar) || (await avatarShownTo(ctx, member))) return commands;
  return commands.filter((command) => !setsAvatar(command));
}

export async function runCommand(ctx: MutationCtx, workspace: string, person: HomeMember, command: Command, { surface, idempotencyKey }: CommandOrigin): Promise<CommandOutcome> {
  const { member } = person;
  switch (command.type) {
    case "showHomeTab": {
      const selection = await showHomeTab(ctx, workspace, person, command.tab);
      if (selection?.tab === "leaderboard") await leaderboardViewedInAppHome(ctx, workspace, member, selection.period);
      return null;
    }
    case "showLeaderboard":
      if (!(await isLeaderboardShownTo(ctx, workspace, member))) return null;
      await selectLeaderboardPeriod(ctx, member, command.period);
      await leaderboardViewedInAppHome(ctx, workspace, member, command.period);
      return null;
    case "setLeaderboardVisibility":
      if (!(await isEveryoneBoardShownTo(ctx, workspace, member))) return null;
      if (await setLeaderboardVisibility(ctx, member, command.visible)) await reportLeaderboardVisibilityChanged(ctx, { workspace, member, visible: command.visible, at: Date.now() });
      return null;
    case "setProgressSettings": {
      const { type: _, ...changes } = command;
      if (await xpLevelsShownTo(ctx, member)) await setNotificationSwitches(ctx, member, changes);
      return null;
    }
    case "setMessageSetting":
      if (await isMessageSettingShownTo(ctx, member, command.kind)) await changeMessageSetting(ctx, workspace, member, command.kind, await placeAskedBy(ctx, member, command));
      return null;
    case "setAnnouncementChannel":
      await setAnnouncementChannel(ctx, workspace, person, command.channel);
      return null;
    case "openUnlock":
      await openUnlock(ctx, member, command.feature, surface);
      return null;
    case "openQuestCrate":
      await openQuestCrate(ctx, member, command.quest, surface);
      return null;
    case "rerollQuest":
      await rerollQuest(ctx, member, command.quest);
      return null;
    case "setGroupMode": {
      const { type: _, ...change } = command;
      if (await setGroupMode(ctx, workspace, person, change)) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
      return null;
    }
    case "setMondayPost": {
      const { type: _, ...change } = command;
      if (await setMondayPost(ctx, workspace, person, change)) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
      return null;
    }
    case "buyPerk": {
      const outcome = await buyPerk(ctx, member, command.perk, idempotencyKey);
      if (outcome !== null) await showHomeTab(ctx, workspace, person, "skillTree");
      return outcome;
    }
    case "buyItem": {
      const outcome = await buyItem(ctx, member, command.item, idempotencyKey);
      if (outcome !== null) await showHomeTab(ctx, workspace, person, "inventory");
      return outcome;
    }
    case "buyCrate":
      return buyCrate(ctx, member, command.next, Date.now());
    case "openCrate":
      await openCrate(ctx, member, command.crate, Date.now(), surface);
      return null;
    case "setAvatar":
      await setAvatar(ctx, member, command.hoggie);
      return null;
    case "linkMyCompanyProfile":
      return (await teamPagesApplyTo(ctx, member)) ? linkMyCompanyProfile(ctx, member, command.profile) : null;
    case "linkCompanyProfile":
      return (await teamPagesApplyTo(ctx, member)) ? linkCompanyProfile(ctx, workspace, person, command.member, command.profile) : null;
    case "setWorkspaceSettings": {
      const { type: _, ...change } = command;
      return changeWorkspaceSettings(ctx, workspace, member, change);
    }
    case "setCustomKudosEmoji":
      if (await setCustomKudosEmoji(ctx, workspace, person, command.emoji)) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
      return null;
    case "pickPrimaryGroup": {
      const group = ctx.db.normalizeId("userGroups", command.group);
      if (group === null || !(await groupsShownAndExposedTo(ctx, member))) return null;
      if ((await pickPrimaryGroup(ctx, member, group)) === "picked") await reportPrimaryGroupPicked(ctx, { workspace, member, surface: command.surface, at: Date.now() });
      return null;
    }
  }
}

async function isMessageSettingShownTo(ctx: MutationCtx, member: MemberId, kind: MessageKind) {
  return (await messageSettingsShownTo(ctx, member)) && (await kindAppliesTo(ctx, member, kind));
}

async function placeAskedBy(ctx: MutationCtx, member: MemberId, command: Extract<Command, { type: "setMessageSetting" }>): Promise<MessagePlace> {
  if ("place" in command) return command.place;
  return command.on ? placeWhenOn(ctx, member, command.kind) : "none";
}

async function changeMessageSetting(ctx: MutationCtx, workspace: string, member: MemberId, kind: MessageKind, place: MessagePlace) {
  if (!(await placesOf(ctx, member, kind)).includes(place)) return;
  if (await setMessageSetting(ctx, member, kind, place)) await reportMessageSettingChanged(ctx, { workspace, member, setting: kind, on: place !== "none", place, at: Date.now() });
}

async function leaderboardViewedInAppHome(ctx: MutationCtx, workspace: string, member: MemberId, period: Period) {
  for (const board of await boardsShownTo(ctx, member)) await reportLeaderboardViewed(ctx, { workspace, member, board, period, surface: "app-home", at: Date.now() });
}

function conforms(validator: GenericValidator, value: unknown): boolean {
  switch (validator.kind) {
    case "union":
      return validator.members.some((member) => conforms(member, value));
    case "object":
      return isRecord(value) && hasOnlyFieldsOf(validator.fields, value);
    case "literal":
      return value === validator.value;
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "id":
      return typeof value === "string";
    case "float64":
      return typeof value === "number";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value) && value.every((element) => conforms(validator.element, element));
    default:
      return false;
  }
}

function hasOnlyFieldsOf(fields: Record<string, GenericValidator>, value: Record<string, unknown>) {
  const known = Object.keys(value).every((key) => key in fields);
  return known && Object.entries(fields).every(([key, field]) => (value[key] === undefined ? field.isOptional === "optional" : conforms(field, value[key])));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
