import { internalMutation } from "../../_generated/server";
import { questFinishedEventValidator } from "../../bus/events";
import { isMember } from "../../workspace/directory";
import { earnHoggieItem, questHoggieRarities } from "../hoggies/rarityCaps";

export function questItemKeyOf(rewardKey: string): `quest:${string}` {
  return `quest:${rewardKey}`;
}

export const earnQuestHoggie = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { workspace, member, quest, rewardKey, at } }) => {
    if (rewardKey === undefined || !(await isMember(ctx, member))) return;
    await earnHoggieItem(ctx, { workspace, member, key: questItemKeyOf(rewardKey), reason: { kind: "quest", quest }, earnedAt: at }, questHoggieRarities);
  },
});
