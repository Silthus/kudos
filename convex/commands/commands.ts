import { v, type GenericValidator, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { reportLeaderboardViewed, reportLeaderboardVisibilityChanged } from "../analytics/isolatedUsage";
import { homeTabValidator, isLeaderboardShownTo, selectLeaderboardPeriod, showHomeTab, type HomeMember } from "../feedback/homes";
import { setGroupMode } from "../groups/groupMode";
import { groupModeValidator } from "../groups/mode";
import { boardsShownTo } from "../leaderboard/boards";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import { periodValidator, type Period } from "../leaderboard/periods";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { buyPerk } from "../progression/perks";
import type { PurchaseOutcome } from "../progression/purchases";
import { setProgressSettings } from "../progression/settings";
import { perkValidator } from "../progression/tree";
import { openQuestCrate } from "../quests/open";
import { questValidator, weeklyQuestValidator } from "../quests/step";
import { rerollQuest } from "../quests/weekly";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { featureValidator } from "../unlocks/feature";
import { openUnlock } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { setAnnouncementChannel } from "../workspace/settings";

export const commandValidator = v.union(
  v.object({ type: v.literal("showHomeTab"), tab: homeTabValidator }),
  v.object({ type: v.literal("showLeaderboard"), period: periodValidator }),
  v.object({ type: v.literal("setLeaderboardVisibility"), visible: v.boolean() }),
  v.object({ type: v.literal("setProgressSettings"), muteNotices: v.optional(v.boolean()), dms: v.optional(v.boolean()) }),
  v.object({ type: v.literal("setAnnouncementChannel"), channel: v.union(v.string(), v.null()) }),
  v.object({ type: v.literal("openUnlock"), feature: featureValidator }),
  v.object({ type: v.literal("openQuestCrate"), quest: questValidator }),
  v.object({ type: v.literal("rerollQuest"), quest: weeklyQuestValidator }),
  v.object({ type: v.literal("buyPerk"), perk: perkValidator }),
  v.object({ type: v.literal("setGroupMode"), mode: groupModeValidator, allowlist: v.optional(v.array(v.string())) }),
);

export type Command = Infer<typeof commandValidator>;

export function commandOf(candidate: unknown): Command | null {
  return conforms(commandValidator, candidate) ? (candidate as Command) : null;
}

export async function runCommand(ctx: MutationCtx, workspace: string, person: HomeMember, command: Command, idempotencyKey: string): Promise<PurchaseOutcome | null> {
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
      if (await xpLevelsShownTo(ctx, member)) await setProgressSettings(ctx, member, changes);
      return null;
    }
    case "setAnnouncementChannel":
      if ((await xpLevelsShownIn(ctx, workspace)) && (await setAnnouncementChannel(ctx, workspace, person, command.channel))) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
      return null;
    case "openUnlock":
      await openUnlock(ctx, member, command.feature);
      return null;
    case "openQuestCrate":
      await openQuestCrate(ctx, member, command.quest);
      return null;
    case "rerollQuest":
      await rerollQuest(ctx, member, command.quest);
      return null;
    case "setGroupMode": {
      const { type: _, ...change } = command;
      if (await setGroupMode(ctx, workspace, person, change)) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
      return null;
    }
    case "buyPerk": {
      const outcome = await buyPerk(ctx, member, command.perk, idempotencyKey);
      await showHomeTab(ctx, workspace, person, "skillTree");
      return outcome;
    }
  }
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
