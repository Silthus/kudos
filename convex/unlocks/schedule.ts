import type { MutationCtx, QueryCtx } from "../_generated/server";
import { flag, type Flag } from "../analytics/flags";
import { everyoneBoardFlag } from "../leaderboard/flag";
import type { Feature } from "./feature";

type ShipFlag = Flag<boolean, "workspace">;

export type ScheduledFeature = { feature: Feature; level: number; name: string; opens: string; shipsWith: ShipFlag | null };

export const skillTree = { key: "skill-tree", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies ShipFlag;

export const schedule = {
  version: "1",
  features: [
    { feature: "quests", level: 2, name: "Quests", opens: "weekly quests and the group quest", shipsWith: null },
    { feature: "leaderboard", level: 3, name: "Leaderboard", opens: "the boards", shipsWith: everyoneBoardFlag },
    { feature: "book", level: 4, name: "Book", opens: "the sticker book, its albums and achievements", shipsWith: null },
    { feature: "skillTree", level: 5, name: "Skill tree", opens: "the tree and your first skill point", shipsWith: skillTree },
    { feature: "coins", level: 6, name: "Coins and inventory", opens: "the wallet, the store's kudos emoji and your emoji slots", shipsWith: null },
    { feature: "hedgehogs", level: 7, name: "Hedgehogs", opens: "the hedgehog collection, your avatar and the store's hedgehogs", shipsWith: null },
  ],
} as const satisfies { version: string; features: readonly ScheduledFeature[] };

export function scheduled(feature: Feature): ScheduledFeature {
  return schedule.features.find((entry) => entry.feature === feature)!;
}

export async function shippedIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<ScheduledFeature[]> {
  const shipped: ScheduledFeature[] = [];
  for (const entry of schedule.features) {
    if (entry.shipsWith !== null && (await flag(ctx, entry.shipsWith, { workspace }))) shipped.push(entry);
  }
  return shipped;
}
