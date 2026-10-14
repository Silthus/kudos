import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { crateOpeningOf, rewardKeyOf } from "../quests/crates";
import { journeyShippedAt, questsApplyIn } from "../quests/flag";
import { questValidator } from "../quests/step";
import { featureValidator, type Feature } from "../unlocks/feature";
import { unlockPathShownIn } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MutationCtx } from "../_generated/server";
import { memberMutation } from "./memberMutation";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await opensWithoutALaunch(ctx, me.workspace, feature))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature });
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

export const openQuestCrate = memberMutation({
  args: { quest: questValidator },
  handler: async (ctx, me, person, { quest }): Promise<CommandAnswer> => {
    if (!(await questsLaunchedIn(ctx, me.workspace))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openQuestCrate", quest });
    if ((await crateOpeningOf(ctx, me.member, rewardKeyOf(quest))) === null) return refused;
    await republish(ctx, me.member);
    return opened;
  },
});

async function opensWithoutALaunch(ctx: MutationCtx, workspace: string, feature: Feature) {
  if (feature === "quests") return questsLaunchedIn(ctx, workspace);
  return unlockPathShownIn(ctx, workspace);
}

async function questsLaunchedIn(ctx: MutationCtx, workspace: string) {
  return (await questsApplyIn(ctx, workspace)) && (await journeyShippedAt(ctx, workspace)) !== null;
}
