import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx } from "../_generated/server";
import type { Rarity } from "../hoggies/catalogue";
import type { CrateKey } from "../hoggies/crateKey";
import { dropFor } from "../hoggies/drops";
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
