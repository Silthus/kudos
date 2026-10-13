import { v, type GenericValidator, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { homeTabValidator, republishAdminsIn, selectLeaderboardPeriod, showHomeTab, type HomeMember } from "../feedback/homes";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import { periodValidator } from "../leaderboard/periods";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { setProgressSettings } from "../progression/settings";
import { xpLevelsShownTo } from "../progression/xpLevels";
import { setAnnouncementChannel } from "../workspace/settings";

export const commandValidator = v.union(
  v.object({ type: v.literal("showHomeTab"), tab: homeTabValidator }),
  v.object({ type: v.literal("showLeaderboard"), period: periodValidator }),
  v.object({ type: v.literal("setLeaderboardVisibility"), visible: v.boolean() }),
  v.object({ type: v.literal("setProgressSettings"), muteNotices: v.optional(v.boolean()), dms: v.optional(v.boolean()) }),
  v.object({ type: v.literal("setAnnouncementChannel"), channel: v.union(v.string(), v.null()) }),
);

export type Command = Infer<typeof commandValidator>;

export function commandOf(candidate: unknown): Command | null {
  return conforms(commandValidator, candidate) ? (candidate as Command) : null;
}

export async function runCommand(ctx: MutationCtx, workspace: string, person: HomeMember, command: Command) {
  const { member } = person;
  switch (command.type) {
    case "showHomeTab":
      return showHomeTab(ctx, workspace, person, command.tab);
    case "showLeaderboard":
      if (await isEveryoneBoardShownTo(ctx, workspace, member)) await selectLeaderboardPeriod(ctx, member, command.period);
      return;
    case "setLeaderboardVisibility":
      if (await isEveryoneBoardShownTo(ctx, workspace, member)) await setLeaderboardVisibility(ctx, member, command.visible);
      return;
    case "setProgressSettings": {
      const { type: _, ...changes } = command;
      if (await xpLevelsShownTo(ctx, member)) await setProgressSettings(ctx, member, changes);
      return;
    }
    case "setAnnouncementChannel":
      if ((await xpLevelsShownTo(ctx, member)) && (await setAnnouncementChannel(ctx, workspace, person, command.channel))) await republishAdminsIn(ctx, workspace);
      return;
  }
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
    case "null":
      return value === null;
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
