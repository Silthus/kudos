import type { MutationCtx } from "../_generated/server";

export async function recordsOnce(ctx: MutationCtx, fact: string | undefined): Promise<boolean> {
  if (fact === undefined) return true;
  if (await wasRecorded(ctx, fact)) return false;
  await ctx.db.insert("recordedFacts", { fact });
  return true;
}

async function wasRecorded(ctx: MutationCtx, fact: string) {
  const recorded = await ctx.db
    .query("recordedFacts")
    .withIndex("by_fact", (q) => q.eq("fact", fact))
    .unique();
  return recorded !== null;
}
