import { internalMutation } from "../_generated/server";
import { questFinishedEventValidator } from "../bus/events";
import { isMember } from "../workspace/directory";
import { recordReward } from "./progression";

export const payQuestFinished = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { workspace, member, rewardKey, reward, catalogueVersion, at, cause } }) => {
    if (rewardKey === undefined || reward === undefined || catalogueVersion === undefined || !(await isMember(ctx, member))) return;
    await recordReward(ctx, workspace, { member, key: rewardKey, xp: reward.xp, coins: 0, item: null, catalogueVersion, at, ...(cause && { cause }) });
  },
});
