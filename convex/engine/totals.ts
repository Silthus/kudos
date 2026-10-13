import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { Award } from "./awards";

export type LifetimeTotals = { given: number; received: number };

export async function addToTotals(ctx: MutationCtx, award: Award) {
  await add(ctx, award.giver, { given: award.kudos, received: 0 });
  await add(ctx, award.recipient, { given: 0, received: award.kudos });
}

export async function lifetimeTotals(ctx: QueryCtx, member: MemberId): Promise<LifetimeTotals> {
  const totals = await totalsRow(ctx, member);
  return { given: totals?.given ?? 0, received: totals?.received ?? 0 };
}

async function add(ctx: MutationCtx, member: MemberId, kudos: LifetimeTotals) {
  const totals = await totalsRow(ctx, member);
  if (totals === null) await ctx.db.insert("kudosTotals", { member, ...kudos });
  else await ctx.db.patch(totals._id, { given: totals.given + kudos.given, received: totals.received + kudos.received });
}

function totalsRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("kudosTotals")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
