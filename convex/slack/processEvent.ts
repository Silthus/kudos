import type { MutationCtx } from "../_generated/server";
import { observe, type Observation } from "../engine/engine";
import type { MessageDeleted, MessageEvent } from "../engine/messageEvent";
import { checkDirectoryLater } from "./directory";
import { fillWorkspaceUrlLater } from "./workspaceUrl";

export async function processEvent(ctx: MutationCtx, event: MessageEvent | MessageDeleted | null): Promise<Observation | null> {
  if (event === null) return null;
  const observation = await observe(ctx, event);
  await checkDirectoryLater(ctx, event.ref, observation);
  if (observation.kind !== "ignored") await fillWorkspaceUrlLater(ctx, event.ref.workspace);
  return observation;
}
