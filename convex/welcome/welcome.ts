import { internalMutation, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent, type MemberWelcomedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { requestWelcome } from "../feedback/welcome";
import type { MemberId } from "../workspace/directory";

type Welcomed = Pick<MemberWelcomedEvent, "member" | "as">;

export const welcomeNewMembers = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    for (const { member, as } of membersNamedIn(event)) {
      if (await isWelcomed(ctx, member)) continue;
      await ctx.db.insert("welcomes", { member });
      await requestWelcome(ctx, member);
      await publish(ctx, { type: "memberWelcomed", workspace: event.workspace, member, as, at: Date.now() });
    }
  },
});

function membersNamedIn(event: KudosGivenEvent): Welcomed[] {
  const recipients = event.awards.map((award) => award.recipient).filter((recipient) => recipient !== event.giver);
  return [{ member: event.giver, as: "giver" }, ...[...new Set(recipients)].map((member) => ({ member, as: "recipient" as const }))];
}

async function isWelcomed(ctx: MutationCtx, member: MemberId) {
  const welcome = await ctx.db
    .query("welcomes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return welcome !== null;
}
