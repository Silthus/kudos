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

export type ScheduledFeature = { feature: Feature; level: number; name: string; opens: string; shipsWith: ShipFlag };

type Naming = Pick<ScheduledFeature, "name" | "opens">;

const namedWithTheStore: Partial<Record<Feature, Naming>> = {
  coins: { name: "Coins and inventory", opens: "your wallet, the store's kudos emoji and your emoji slots" },
};

export const schedule = {
  version: "2",
  features: [
    { feature: "book", level: 1, name: "Book", opens: "achievements", shipsWith: achievementsFlag },
    { feature: "leaderboard", level: 2, name: "Leaderboard", opens: "the boards", shipsWith: everyoneBoardFlag },
    { feature: "quests", level: 3, name: "Quests", opens: "your weekly quests", shipsWith: questsFlag },
    { feature: "skillTree", level: skillTreeLevel, name: "Skill tree", opens: "the tree and your first skill point", shipsWith: skillTreeFlag },
    { feature: "coins", level: 6, name: "Coins", opens: "your wallet and the coin perks", shipsWith: coinsFlag },
  ],
} as const satisfies { version: string; features: readonly ScheduledFeature[] };

export const startingLevel = 1;

export function readyFromTheStart({ level }: Pick<ScheduledFeature, "level">): boolean {
  return level <= startingLevel;
}

export function scheduled(feature: Feature): ScheduledFeature {
  return schedule.features.find((entry) => entry.feature === feature)!;
}

export function namedFor(entry: ScheduledFeature, storeShown: boolean): ScheduledFeature {
  const naming = storeShown ? namedWithTheStore[entry.feature] : undefined;
  return naming === undefined ? entry : { ...entry, ...naming };
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
    if (await decides(entry.shipsWith)) shipped.push(entry);
  }
  return shipped;
}
