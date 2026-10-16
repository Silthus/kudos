import type { QueryCtx } from "../_generated/server";
import { bookAppliesIn } from "../achievements/flag";
import { ladderOf, ladders, type LadderId, type TierId } from "../achievements/ladders";
import { laddersShownTo } from "../achievements/shown";
import { everyTierEarnedBy, type EarnedTier } from "../achievements/tiers";
import { groupsShownTo, primaryGroupOf } from "../groups/groups";
import { standingOf } from "../progression/progression";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { openedAtOf } from "../unlocks/unlocks";
import { nameless } from "../website/faces";
import { chatUserOf, displayNameOf, type MemberId } from "../workspace/directory";

export type Medal = { ladder: LadderId; tier: TierId; name: string };

export type ProfileCard = { name: string; level: number | null; medals: Medal[] };

export type Viewing = { own: boolean; viewer: MemberId | null };

const medalsShown = 4;
const tiersBestFirst: readonly TierId[] = ["diamond", "gold", "silver", "bronze"];
const ladderOrder: readonly LadderId[] = ladders.ladders.map(({ ladder }) => ladder);

export async function profileCardOf(ctx: QueryCtx, member: MemberId, { own, viewer }: Viewing): Promise<ProfileCard> {
  const { workspace } = await chatUserOf(ctx, member);
  return {
    name: (await displayNameOf(ctx, member)) ?? nameless,
    level: (await xpLevelsShownIn(ctx, workspace)) ? (await standingOf(ctx, member)).level : null,
    medals: (await medalsShownIn(ctx, workspace, member, own)) ? await medalsShownTo(ctx, viewer, member) : [],
  };
}

async function medalsShownTo(ctx: QueryCtx, viewer: MemberId | null, member: MemberId) {
  const shown = await laddersShownTo(ctx, viewer);
  return bestMedalsOf((await everyTierEarnedBy(ctx, member)).filter(({ ladder }) => shown.includes(ladder)));
}

export async function groupNameOnCard(ctx: QueryCtx, viewer: MemberId, member: MemberId): Promise<string | null> {
  if (!(await groupsShownTo(ctx, viewer))) return null;
  return (await primaryGroupOf(ctx, member))?.name ?? null;
}

async function medalsShownIn(ctx: QueryCtx, workspace: string, member: MemberId, own: boolean) {
  if (!(await bookAppliesIn(ctx, workspace))) return false;
  return !own || (await openedAtOf(ctx, member, "book")) !== null;
}

function bestMedalsOf(earned: EarnedTier[]): Medal[] {
  return ladderOrder
    .flatMap((ladder) => highestTierOn(ladder, earned))
    .toSorted((one, other) => tiersBestFirst.indexOf(one.tier) - tiersBestFirst.indexOf(other.tier))
    .slice(0, medalsShown);
}

function highestTierOn(ladder: LadderId, earned: EarnedTier[]): Medal[] {
  const tier = tiersBestFirst.find((tier) => earned.some((row) => row.ladder === ladder && row.tier === tier));
  if (tier === undefined) return [];
  return [{ ladder, tier, name: ladderOf(ladder).tiers.find((entry) => entry.tier === tier)!.name }];
}
