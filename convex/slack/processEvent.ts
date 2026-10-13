import type { MutationCtx } from "../_generated/server";
import { observe, type Observation } from "../engine/engine";
import type { MessageEvent } from "../engine/messageEvent";
import { checkDirectoryLater } from "./directory";

export async function processEvent(ctx: MutationCtx, event: MessageEvent | null): Promise<Observation | null> {
  if (event === null) return null;
  const observation = await observe(ctx, event);
  await checkDirectoryLater(ctx, event.ref, observation);
  return observation;
}
