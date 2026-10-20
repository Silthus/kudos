import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Rarity } from "../hoggies/catalogue";
import type { CrateKey } from "../hoggies/crateKey";
import { dropFor, foundIn, type Drop } from "../hoggies/drops";
import { crestsShownTo } from "../hoggies/flag";
import type { MemberId } from "../workspace/directory";

export const levelUpRevealFlag = { key: "level-up-reveal", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

const slots: ReadonlyArray<{ slot: number; floor?: Rarity }> = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" }];

export function levelUpCrateKeyOf(level: number, slot: number): CrateKey {
  return `level:${level}:${slot}`;
}

export async function dropLevelUpHoggies(ctx: MutationCtx, member: MemberId, level: number, at: number): Promise<void> {
  if (!(await levelUpRevealDropsFor(ctx, member))) return;
  for (const { slot, floor } of slots) await dropFor(ctx, member, levelUpCrateKeyOf(level, slot), at, { floor });
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
