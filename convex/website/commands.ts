import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import { journeyStartedFor, questsApplyTo } from "../quests/flag";
import { questValidator } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { memberMutation } from "./memberMutation";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await launchesRecordedFor(ctx, me.member))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature }, `website:openFeature:${me.member}:${feature}`);
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CommandAnswer> => {
    if (!(await questsLaunchedFor(ctx, me.member))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest }, `website:openQuestCrate:${me.member}:${rewardKeyOf(quest)}`);
    if ((await crateOpeningOf(ctx, me.member, rewardKeyOf(quest))) === null) return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

async function launchesRecordedFor(ctx: MutationCtx, member: MemberId) {
  if (!(await unlockPathShownTo(ctx, member))) return false;
  return !(await questsApplyTo(ctx, member)) || (await journeyStartedFor(ctx, member)) !== null;
}

async function questsLaunchedFor(ctx: MutationCtx, member: MemberId) {
  return (await questsApplyTo(ctx, member)) && (await journeyStartedFor(ctx, member)) !== null;
}
