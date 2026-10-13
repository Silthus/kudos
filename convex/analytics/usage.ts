import type { MutationCtx } from "../_generated/server";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
import { projectUsage, type UsageFact } from "./projections";

export async function recordUsage(ctx: MutationCtx, fact: UsageFact) {
  await record(ctx, fact.workspace, [projectUsage(fact)]);
}

export async function recordUsageWithoutBlocking(recording: () => Promise<unknown>) {
  try {
    await failuresLogged("analytics.usage_not_recorded", recording);
  } catch {
    return;
  }
}
