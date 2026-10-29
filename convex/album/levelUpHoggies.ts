import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import type { CrateKey } from "./hoggies/crateKey";
import { dropFor, droppedIn, foundIn, type Drop } from "./hoggies/drops";
import { crestsShownTo } from "./hoggies/flag";
import { hiddenItemsShownTo } from "./items/flag";
import { earnedItemOf, earnItem, markTurned } from "./items/ledger";
import { levelUpSlotRarities, levelUpThirdSlotRarities, rarityRangeFor, storedRangeOf, type RarityRange, type SourceRarities } from "./hoggies/rarityCaps";
import type { MemberId } from "../workspace/directory";

export const levelUpRevealFlag = { key: "level-up-reveal", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

const slots: ReadonlyArray<{ slot: number; rarities: SourceRarities }> = [
  { slot: 1, rarities: levelUpSlotRarities },
  { slot: 2, rarities: levelUpSlotRarities },
  { slot: 3, rarities: levelUpThirdSlotRarities },
];

export function levelUpCrateKeyOf(level: number, slot: number): CrateKey {
  return `level:${level}:${slot}`;
}

export type LevelUp = { workspace: string; member: MemberId; level: number; at: number };

type LevelUpItem = { crate: CrateKey; range: RarityRange };

export const earnLevelUpHoggies = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event: { workspace, member, level, at } }) => {
    if (await levelUpEarned(ctx, member, level)) return;
    await dropLevelUpHoggies(ctx, { workspace, member, level, at });
  },
});

export async function levelUpEarned(ctx: QueryCtx, member: MemberId, level: number): Promise<boolean> {
  return (await earnedItemOf(ctx, member, "hoggie", levelUpCrateKeyOf(level, 1))) !== null;
}

export async function dropLevelUpHoggies(ctx: MutationCtx, levelUp: LevelUp): Promise<void> {
  const items = await earnLevelUpItems(ctx, levelUp);
  if (await hiddenItemsShownTo(ctx, levelUp.member)) return;
  if (await levelUpRevealDropsFor(ctx, levelUp.member)) await revealLevelUpHoggies(ctx, levelUp, items);
}

async function earnLevelUpItems(ctx: MutationCtx, { workspace, member, level, at }: LevelUp): Promise<LevelUpItem[]> {
  const items: LevelUpItem[] = [];
  for (const { slot, rarities } of slots) {
    const crate = levelUpCrateKeyOf(level, slot);
    const item = await earnItem(ctx, { workspace, member, source: "hoggie", key: crate, ...(await rarityRangeFor(ctx, member, rarities)), reason: { kind: "levelUp", level }, earnedAt: at });
    items.push({ crate, range: storedRangeOf((await ctx.db.get(item))!) });
  }
  return items;
}

async function revealLevelUpHoggies(ctx: MutationCtx, { member, at }: LevelUp, items: LevelUpItem[]): Promise<void> {
  for (const { crate, range } of items) {
    await dropFor(ctx, member, crate, at, range);
    if (await droppedIn(ctx, member, crate)) await markTurned(ctx, member, "hoggie", crate, at);
  }
}

async function levelUpRevealDropsFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const drops = await memberDecision(ctx, levelUpRevealFlag, member);
  await exposed(ctx, levelUpRevealFlag, member, drops);
  return drops;
}

export function levelUpRevealOnFor(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, levelUpRevealFlag, member);
}

export async function levelUpHoggiesOf(ctx: QueryCtx, member: MemberId, level: number): Promise<Drop[]> {
  const shown = { crests: await crestsShownTo(ctx, member) };
  const hoggies: Drop[] = [];
  for (const { slot } of slots) {
    const drop = await foundIn(ctx, member, levelUpCrateKeyOf(level, slot), shown);
    if (drop !== null) hoggies.push(drop);
  }
  return hoggies;
}
