import { internalMutation } from "../_generated/server";
import { hugGivenEventValidator, hugReceivedEventValidator } from "../bus/events";
import { addCounts, countedKeys, countOnce, landingAt } from "./counts";

export const countHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event: { workspace, giver, message, day } }) => {
    if (await countOnce(ctx, workspace, countedKeys.hugGiven(giver, message))) await addCounts(ctx, { workspace, member: giver, day }, { hugsGiven: 1 });
  },
});

export const countHugReceived = internalMutation({
  args: { event: hugReceivedEventValidator },
  handler: async (ctx, { event: { workspace, giver, person, message, at } }) => {
    if (await countOnce(ctx, workspace, countedKeys.hugReceived(person, giver, message))) await addCounts(ctx, await landingAt(ctx, workspace, person, at), { hugsReceived: 1 });
  },
});
