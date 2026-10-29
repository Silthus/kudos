import { internalMutation, type MutationCtx } from "../_generated/server";
import { hugGivenEventValidator, hugReceivedEventValidator } from "../bus/events";
import { hugXp, hugsCatalogueVersion } from "../hugs/xp";
import { isMember, type MemberId } from "../workspace/directory";
import { recordReward } from "./progression";

type HugReward = { workspace: string; member: MemberId; key: string; at: number };

export const payHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event: { workspace, giver, message, at } }) => {
    await payHugXp(ctx, { workspace, member: giver, key: `hug-given:${message.conversation}:${message.message}`, at });
  },
});

export const payHugReceived = internalMutation({
  args: { event: hugReceivedEventValidator },
  handler: async (ctx, { event: { workspace, giver, person, message, at } }) => {
    await payHugXp(ctx, { workspace, member: person, key: `hug:${giver}:${message.conversation}:${message.message}`, at });
  },
});

async function payHugXp(ctx: MutationCtx, { workspace, member, key, at }: HugReward) {
  if (!(await isMember(ctx, member))) return;
  await recordReward(ctx, workspace, { member, key, xp: hugXp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at });
}
