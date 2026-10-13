import { internalMutation, type QueryCtx } from "../_generated/server";

export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const clock = await ctx.db.query("websiteClock").first();
    if (clock === null) await ctx.db.insert("websiteClock", { tick: Date.now() });
    else await ctx.db.patch(clock._id, { tick: Date.now() });
  },
});

export async function followTheClock(ctx: QueryCtx) {
  await ctx.db.query("websiteClock").first();
}
