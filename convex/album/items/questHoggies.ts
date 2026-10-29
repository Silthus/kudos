import { internalMutation } from "../../_generated/server";
import { questFinishedEventValidator } from "../../bus/events";
import { isMember } from "../../workspace/directory";
import { earnItem } from "./ledger";

export function questItemKeyOf(rewardKey: string): `quest:${string}` {
  return `quest:${rewardKey}`;
}

export const earnQuestHoggie = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { workspace, member, quest, rewardKey, at } }) => {
    if (rewardKey === undefined || !(await isMember(ctx, member))) return;
    await earnItem(ctx, { workspace, member, source: "hoggie", key: questItemKeyOf(rewardKey), reason: { kind: "quest", quest }, earnedAt: at });
  },
});
