import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { homeTabValidator, selectHomeTab, selectLeaderboardPeriod } from "../feedback/homeTabs";
import { periodValidator } from "../leaderboard/periods";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { lookup, type MemberId } from "../workspace/directory";

export const commandValidator = v.union(
  v.object({ type: v.literal("showHomeTab"), tab: homeTabValidator }),
  v.object({ type: v.literal("showLeaderboard"), period: periodValidator }),
  v.object({ type: v.literal("setLeaderboardVisibility"), visible: v.boolean() }),
);

export type Command = Infer<typeof commandValidator>;

export const run = internalMutation({
  args: { workspace: v.string(), user: v.string(), command: commandValidator },
  handler: async (ctx, { workspace, user, command }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return { ran: false };
    await route(ctx, person.member, command);
    return { ran: true };
  },
});

async function route(ctx: MutationCtx, member: MemberId, command: Command) {
  switch (command.type) {
    case "showHomeTab":
      return selectHomeTab(ctx, member, command.tab);
    case "showLeaderboard":
      return selectLeaderboardPeriod(ctx, member, command.period);
    case "setLeaderboardVisibility":
      return setLeaderboardVisibility(ctx, member, command.visible);
  }
}
