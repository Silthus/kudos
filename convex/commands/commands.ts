import { v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { homeTabValidator, selectHomeTab, selectLeaderboardPeriod } from "../feedback/homeTabs";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import { periodValidator } from "../leaderboard/periods";
import { setLeaderboardVisibility } from "../leaderboard/visibility";
import { lookup, type MemberId } from "../workspace/directory";

export const commandValidator = v.union(
  v.object({ type: v.literal("showHomeTab"), tab: homeTabValidator }),
  v.object({ type: v.literal("showLeaderboard"), period: periodValidator }),
  v.object({ type: v.literal("setLeaderboardVisibility"), visible: v.boolean() }),
);

export type Command = Infer<typeof commandValidator>;

export async function runCommand(ctx: MutationCtx, workspace: string, user: string, command: Command) {
  const person = await lookup(ctx, workspace, user);
  if (person?.kind !== "member") return false;
  if (await isEveryoneBoardShownTo(ctx, workspace, person.member)) await route(ctx, person.member, command);
  return true;
}

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
