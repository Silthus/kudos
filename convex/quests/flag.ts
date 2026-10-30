import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision } from "../analytics/flags";
import { xpLevelsOnFor } from "../progression/xpLevels";
import type { MemberId } from "../workspace/directory";
import { mondayQuestFlag } from "./mondayQuestFlag";

export async function onTheMondayPath(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, mondayQuestFlag, member)) && (await xpLevelsOnFor(ctx, member));
}

export async function mondayPathShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const applies = await memberDecision(ctx, mondayQuestFlag, member);
  await exposed(ctx, mondayQuestFlag, member, applies);
  return applies && (await xpLevelsOnFor(ctx, member));
}
