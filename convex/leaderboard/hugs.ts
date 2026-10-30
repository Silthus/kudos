import type { MutationCtx } from "../_generated/server";
import { hugGivenEventValidator, hugReceivedEventValidator, type HugGivenEvent, type HugReceivedEvent } from "../bus/events";
import { internalMutation } from "../_generated/server";
import { addCounts, countedKeys, countOnce, landingAt } from "./counts";
import { noteThanker } from "./thankers";

type GivenHug = Pick<HugGivenEvent, "workspace" | "giver" | "message" | "day">;

type ReceivedHug = Pick<HugReceivedEvent, "workspace" | "giver" | "person" | "message" | "at">;

export const countHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event }) => {
    await countGivenHug(ctx, event);
  },
});

export const countHugReceived = internalMutation({
  args: { event: hugReceivedEventValidator },
  handler: async (ctx, { event }) => {
    await countReceivedHug(ctx, event);
  },
});

export async function countGivenHug(ctx: MutationCtx, { workspace, giver, message, day }: GivenHug) {
  if (!(await countOnce(ctx, workspace, countedKeys.hugGiven(giver, message)))) return false;
  await addCounts(ctx, { workspace, member: giver, day }, { hugsGiven: 1 });
  return true;
}

export async function countReceivedHug(ctx: MutationCtx, { workspace, giver, person, message, at }: ReceivedHug) {
  const landing = await landingAt(ctx, workspace, person, at);
  await noteThanker(ctx, landing, giver);
  if (!(await countOnce(ctx, workspace, countedKeys.hugReceived(person, giver, message)))) return false;
  await addCounts(ctx, landing, { hugsReceived: 1 });
  return true;
}
