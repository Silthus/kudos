import { exposed, memberDecision, type Flag } from "../../analytics/flags";
import type { MutationCtx } from "../../_generated/server";
import type { MemberId } from "../../workspace/directory";
import type { MilestoneTier } from "../records";
import type { Rarity, WeightsName } from "./catalogue";

export const rarityCapsFlag = { key: "rarity-caps", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type RarityRange = { floor?: Rarity; cap?: Rarity; weights?: WeightsName };

export type SourceRarities = { today: RarityRange; capped: RarityRange };

const cappedAtRare: RarityRange = { cap: "rare", weights: "base" };

const exactlyRare: RarityRange = { floor: "rare", cap: "rare", weights: "base" };

export const kudosPackRarities: SourceRarities = { today: {}, capped: { weights: "kudos" } };

export const welcomeRarities: SourceRarities = { today: { floor: "rare" }, capped: exactlyRare };

export const levelUpSlotRarities: SourceRarities = { today: {}, capped: cappedAtRare };

export const levelUpThirdSlotRarities: SourceRarities = { today: { floor: "rare" }, capped: exactlyRare };

export const completedTeamRarities: SourceRarities = { today: { floor: "rare" }, capped: exactlyRare };

export const milestoneRarities: Record<MilestoneTier, SourceRarities> = {
  bronze: { today: { floor: "uncommon" }, capped: { floor: "uncommon", cap: "rare", weights: "base" } },
  silver: { today: { floor: "rare" }, capped: exactlyRare },
  gold: { today: { floor: "epic" }, capped: exactlyRare },
  diamond: { today: { floor: "legendary" }, capped: exactlyRare },
};

export const questHoggieRarities: SourceRarities = { today: {}, capped: cappedAtRare };

export const featureOpeningRarities: SourceRarities = { today: {}, capped: cappedAtRare };

export const boughtCrateRarities: SourceRarities = { today: {}, capped: cappedAtRare };

export async function rarityRangeFor(ctx: MutationCtx, member: MemberId, { today, capped }: SourceRarities): Promise<RarityRange> {
  const caps = await memberDecision(ctx, rarityCapsFlag, member);
  await exposed(ctx, rarityCapsFlag, member, caps);
  return caps ? capped : today;
}

export function storedRangeOf({ floor, cap, weights }: RarityRange): RarityRange {
  return { floor, cap, weights };
}
