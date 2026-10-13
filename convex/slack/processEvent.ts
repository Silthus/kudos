import type { MutationCtx } from "../_generated/server";
import { observe, type Observation } from "../engine/engine";
import type { MessageEvent } from "../engine/messageEvent";
import { checkDirectoryLater } from "./directory";

export type Receipt = { workspace: string; eventId: string };

export async function processEvent(ctx: MutationCtx, _receipt: Receipt, event: MessageEvent | null): Promise<Observation | null> {
  if (event === null) return null;
  const observation = await observe(ctx, event);
  await checkDirectoryLater(ctx, event.ref, observation);
  return observation;
}
