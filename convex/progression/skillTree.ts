import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, workspaceDecision } from "../analytics/flags";
import { unlocksAppliedIn } from "../unlocks/launch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { skillTreeFlag } from "./skillTreeFlag";
import type { PerkId } from "./tree";
import { xpLevelsShownIn } from "./xpLevels";

export type OwnedPerk = { perk: PerkId; boughtAt: number };

export async function skillTreeAppliesIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, skillTreeFlag, workspace)) && (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

export async function skillTreeShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await xpLevelsShownIn(ctx, workspace)) || !(await unlocksAppliedIn(ctx, workspace))) return false;
  const applies = await workspaceDecision(ctx, skillTreeFlag, workspace);
  await exposed(ctx, skillTreeFlag, member, applies);
  return applies;
}

export async function ownedPerksOf(ctx: QueryCtx, member: MemberId): Promise<OwnedPerk[]> {
  const owned = await ctx.db
    .query("perksOwned")
    .withIndex("by_member_perk", (q) => q.eq("member", member))
    .collect();
  return owned.map(({ perk, boughtAt }) => ({ perk, boughtAt }));
}

export async function perksPayingIn(ctx: QueryCtx, workspace: string, member: MemberId): Promise<PerkId[]> {
  if (!(await skillTreeAppliesIn(ctx, workspace))) return [];
  return (await ownedPerksOf(ctx, member)).map(({ perk }) => perk);
}
