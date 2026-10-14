import type { QueryCtx } from "../_generated/server";
import { bookAppliesIn } from "../achievements/flag";
import { ladderOf, ladders, type LadderId, type TierId } from "../achievements/ladders";
import { everyTierEarnedBy, type EarnedTier } from "../achievements/tiers";
import { standingOf } from "../progression/progression";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { openedAtOf } from "../unlocks/unlocks";
import { nameless } from "../website/faces";
import { chatUserOf, displayNameOf, type MemberId } from "../workspace/directory";

export type Medal = { ladder: LadderId; tier: TierId; name: string };

export type ProfileCard = { name: string; level: number | null; medals: Medal[] };

export type Viewing = { own: boolean };

const medalsShown = 4;
const tiersBestFirst: readonly TierId[] = ["diamond", "gold", "silver", "bronze"];
const ladderOrder: readonly LadderId[] = ladders.ladders.map(({ ladder }) => ladder);

export async function profileCardOf(ctx: QueryCtx, member: MemberId, { own }: Viewing): Promise<ProfileCard> {
  const { workspace } = await chatUserOf(ctx, member);
  return {
    name: (await displayNameOf(ctx, member)) ?? nameless,
    level: (await xpLevelsShownIn(ctx, workspace)) ? (await standingOf(ctx, member)).level : null,
    medals: (await medalsShownIn(ctx, workspace, member, { own })) ? bestMedalsOf(await everyTierEarnedBy(ctx, member)) : [],
  };
}

async function medalsShownIn(ctx: QueryCtx, workspace: string, member: MemberId, { own }: Viewing) {
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
