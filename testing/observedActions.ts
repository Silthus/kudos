import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { observedAction } from "../convex/analytics/boundary";
import { ReportableError } from "../convex/analytics/exceptions";

export const fixturePath = "./testing/observedActions.ts";

export const failing = observedAction({
  args: { reason: v.string() },
  handler: async (_ctx, { reason }): Promise<void> => {
    throw new ReportableError(reason);
  },
});

export const callingFailing = observedAction({
  args: { reason: v.string() },
  handler: async (ctx, { reason }): Promise<void> => {
    await ctx.runAction(failingReference, { reason });
  },
});

export const failingReference = makeFunctionReference<"action", { reason: string }>("testing/observedActions:failing");
export const callingFailingReference = makeFunctionReference<"action", { reason: string }>("testing/observedActions:callingFailing");
