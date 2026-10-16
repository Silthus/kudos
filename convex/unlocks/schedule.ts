import type { MutationCtx, QueryCtx } from "../_generated/server";
import { achievementsFlag } from "../achievements/achievementsFlag";
import { memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import { everyoneBoardFlag } from "../leaderboard/flag";
import { questsFlag } from "../quests/questsFlag";
import { skillTreeLevel } from "../progression/levels";
import { skillTreeFlag } from "../progression/skillTreeFlag";
import { coinsFlag } from "../wallet/coinsFlag";
import type { MemberId } from "../workspace/directory";
import type { Feature } from "./feature";

type ShipFlag = Flag<boolean>;

export type ScheduledFeature = { feature: Feature; level: number; name: string; opens: string; shipsWith: ShipFlag | null };

type Naming = Pick<ScheduledFeature, "name" | "opens">;

const namedWithTheStore: Partial<Record<Feature, Naming>> = {
  coins: { name: "Coins and inventory", opens: "your wallet, the store's kudos emoji and your emoji slots" },
};

const namedWithTheStoreWithoutSlots: Partial<Record<Feature, Naming>> = {
  coins: { name: "Coins and inventory", opens: "your wallet, the store and your kudos emoji" },
};

export const schedule = {
  version: "1",
  features: [
    { feature: "quests", level: 2, name: "Quests", opens: "your weekly quests", shipsWith: questsFlag },
    { feature: "leaderboard", level: 3, name: "Leaderboard", opens: "the boards", shipsWith: everyoneBoardFlag },
    { feature: "book", level: 4, name: "Book", opens: "achievements", shipsWith: achievementsFlag },
    { feature: "skillTree", level: skillTreeLevel, name: "Skill tree", opens: "the tree and your first skill point", shipsWith: skillTreeFlag },
    { feature: "coins", level: 6, name: "Coins", opens: "your wallet and the coin perks", shipsWith: coinsFlag },
    { feature: "hedgehogs", level: 7, name: "Hedgehogs", opens: "the hedgehog collection, your avatar and the store's hedgehogs", shipsWith: null },
  ],
} as const satisfies { version: string; features: readonly ScheduledFeature[] };

export function scheduled(feature: Feature): ScheduledFeature {
  return schedule.features.find((entry) => entry.feature === feature)!;
}

export function namedFor(entry: ScheduledFeature, storeShown: boolean, slotsRetired = false): ScheduledFeature {
  const naming = storeNamingsOf(storeShown, slotsRetired)[entry.feature];
  return naming === undefined ? entry : { ...entry, ...naming };
}

function storeNamingsOf(storeShown: boolean, slotsRetired: boolean): Partial<Record<Feature, Naming>> {
  if (!storeShown) return {};
  return slotsRetired ? namedWithTheStoreWithoutSlots : namedWithTheStore;
}

export function shippedIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<ScheduledFeature[]> {
  return shippedBy((flag) => workspaceDecision(ctx, flag, workspace), schedule.features);
}

export function shippedTo(ctx: QueryCtx | MutationCtx, member: MemberId, among: readonly ScheduledFeature[] = schedule.features): Promise<ScheduledFeature[]> {
  return shippedBy((flag) => memberDecision(ctx, flag, member), among);
}

async function shippedBy(decides: (flag: ShipFlag) => Promise<boolean>, among: readonly ScheduledFeature[]) {
  const shipped: ScheduledFeature[] = [];
  for (const entry of among) {
    if (entry.shipsWith !== null && (await decides(entry.shipsWith))) shipped.push(entry);
  }
  return shipped;
}
