import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx } from "../_generated/server";
import { workspaceLaunchDueIn } from "./flag";
import { memberMutation } from "./memberMutation";
import type { VerifiedMember } from "./memberQuery";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CommandAnswer> => {
    if (!(await questsLaunchedFor(ctx, me))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    if ((await crateOpeningOf(ctx, me.member, rewardKeyOf(quest))) === null) return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

async function launchesRecordedFor(ctx: MutationCtx, me: VerifiedMember) {
  if ((await workspaceLaunchDueIn(ctx, me.workspace)) || !(await unlockPathShownTo(ctx, me.member))) return false;
  return !(await questsApplyTo(ctx, me.member)) || (await journeyStartedFor(ctx, me.member)) !== null;
}

async function questsLaunchedFor(ctx: MutationCtx, me: VerifiedMember) {
  if (await workspaceLaunchDueIn(ctx, me.workspace)) return false;
  return (await questsApplyTo(ctx, me.member)) && (await journeyStartedFor(ctx, me.member)) !== null;
}
