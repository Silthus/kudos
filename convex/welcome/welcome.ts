import { internalMutation, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, membersNamedIn } from "../bus/events";
import { requestWelcome } from "../feedback/welcome";
import type { MemberId } from "../workspace/directory";

export const welcomeNewMembers = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    for (const member of membersNamedIn(event)) {
      if (await isWelcomed(ctx, member)) continue;
      await ctx.db.insert("welcomes", { member });
      await requestWelcome(ctx, member);
    }
  },
});

async function isWelcomed(ctx: MutationCtx, member: MemberId) {
  const welcome = await ctx.db
    .query("welcomes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return welcome !== null;
}
