import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { observe, type Observation } from "../engine/engine";
import type { MessageEvent } from "../engine/messageEvent";

export type Receipt = { workspace: string; eventId: string };

export async function processEvent(ctx: MutationCtx, _receipt: Receipt, event: MessageEvent | null): Promise<Observation | null> {
  if (event === null) return null;
  const observation = await observe(ctx, event);
  if (observation.kind === "awaiting-directory") {
    await ctx.scheduler.runAfter(observation.retryInMs, internal.slack.directory.lookUpUsers, { ref: event.ref, users: observation.users });
  }
  return observation;
}
