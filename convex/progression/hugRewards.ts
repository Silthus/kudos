import { internalMutation, type MutationCtx } from "../_generated/server";
import { hugGivenEventValidator, hugReceivedEventValidator } from "../bus/events";
import { firstHugGivenADayBonusXp, firstHugReceivedAWeekBonusXp, hugXp, hugsCatalogueVersion } from "../hugs/xp";
import { isMember, type MemberId } from "../workspace/directory";
import { recordReward } from "./progression";

type HugReward = { workspace: string; member: MemberId; key: string; xp: number; at: number };

export const payHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event: { workspace, giver, message, at, day, rewards } }) => {
    if (!(await isMember(ctx, giver))) return;
    await payHugXp(ctx, { workspace, member: giver, key: `hug-given:${message.conversation}:${message.message}`, xp: hugXp, at });
    if (rewards === true) await payHugXp(ctx, { workspace, member: giver, key: `hug-day:${day}`, xp: firstHugGivenADayBonusXp, at });
  },
});

export const payHugReceived = internalMutation({
  args: { event: hugReceivedEventValidator },
  handler: async (ctx, { event: { workspace, giver, person, message, at, week, rewards } }) => {
    if (!(await isMember(ctx, person))) return;
    await payHugXp(ctx, { workspace, member: person, key: `hug:${giver}:${message.conversation}:${message.message}`, xp: hugXp, at });
    if (rewards === true) await payHugXp(ctx, { workspace, member: person, key: `hug-week:${week}`, xp: firstHugReceivedAWeekBonusXp, at });
  },
});

async function payHugXp(ctx: MutationCtx, { workspace, member, key, xp, at }: HugReward) {
  await recordReward(ctx, workspace, { member, key, xp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at });
}
