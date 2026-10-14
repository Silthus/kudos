import { runCommand } from "../commands/commands";
import { republish } from "../feedback/homes";
import { featureValidator } from "../unlocks/feature";
import { stateOf } from "../unlocks/unlocks";
import { memberMutation } from "./memberMutation";
import { unlockPathShownIn } from "./unlockPath";

export type CommandAnswer = { kind: "opened" } | { kind: "refused" };

const opened: CommandAnswer = { kind: "opened" };
const refused: CommandAnswer = { kind: "refused" };

export const openFeature = memberMutation({
  args: { feature: featureValidator },
  handler: async (ctx, me, person, { feature }): Promise<CommandAnswer> => {
    if (!(await unlockPathShownIn(ctx, me.workspace))) return refused;
    await runCommand(ctx, me.workspace, person, { type: "openUnlock", feature });
    if ((await stateOf(ctx, me.member, feature)) !== "open") return refused;
    await republish(ctx, me.member);
    return opened;
  },
});
