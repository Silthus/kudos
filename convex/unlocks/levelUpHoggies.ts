import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Rarity } from "../album/hoggies/catalogue";
import type { CrateKey } from "../album/hoggies/crateKey";
import { dropFor, droppedIn, foundIn, type Drop } from "../album/hoggies/drops";
import { crestsShownTo } from "../album/hoggies/flag";
import { hiddenItemsShownTo } from "../album/items/flag";
import { earnItem, markTurned } from "../album/items/ledger";
import type { MemberId } from "../workspace/directory";

export const levelUpRevealFlag = { key: "level-up-reveal", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

const slots: ReadonlyArray<{ slot: number; floor?: Rarity }> = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" }];

export function levelUpCrateKeyOf(level: number, slot: number): CrateKey {
  return `level:${level}:${slot}`;
}

export type LevelUp = { workspace: string; member: MemberId; level: number; at: number };

export async function dropLevelUpHoggies(ctx: MutationCtx, levelUp: LevelUp): Promise<void> {
  await earnLevelUpItems(ctx, levelUp);
  if (await hiddenItemsShownTo(ctx, levelUp.member)) return;
  if (await levelUpRevealDropsFor(ctx, levelUp.member)) await revealLevelUpHoggies(ctx, levelUp);
}

async function earnLevelUpItems(ctx: MutationCtx, { workspace, member, level, at }: LevelUp): Promise<void> {
  for (const { slot, floor } of slots) await earnItem(ctx, { workspace, member, source: "hoggie", key: levelUpCrateKeyOf(level, slot), ...(floor && { floor }), reason: { kind: "levelUp", level }, earnedAt: at });
}

async function revealLevelUpHoggies(ctx: MutationCtx, { member, level, at }: LevelUp): Promise<void> {
  for (const { slot, floor } of slots) {
    const crate = levelUpCrateKeyOf(level, slot);
    await dropFor(ctx, member, crate, at, { floor });
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
