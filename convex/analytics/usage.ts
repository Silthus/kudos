import type { MutationCtx } from "../_generated/server";
import { record } from "./outbox";
import { projectUsage, type UsageFact } from "./projections";

export async function recordUsage(ctx: MutationCtx, fact: UsageFact) {
  await record(ctx, fact.workspace, [projectUsage(fact)]);
}
