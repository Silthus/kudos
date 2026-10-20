import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx } from "../_generated/server";
import type { Rarity } from "../hoggies/catalogue";
import type { CrateKey } from "../hoggies/crateKey";
import { dropFor } from "../hoggies/drops";
import type { MemberId } from "../workspace/directory";

export const levelUpHoggiesFlag = { key: "level-up-hoggies", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

const slots: ReadonlyArray<{ slot: number; floor?: Rarity }> = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" }];

export function levelUpCrateKeyOf(level: number, slot: number): CrateKey {
  return `level:${level}:${slot}`;
}

export async function dropLevelUpHoggies(ctx: MutationCtx, member: MemberId, level: number, at: number): Promise<void> {
  if (!(await levelUpHoggiesDropFor(ctx, member))) return;
  for (const { slot, floor } of slots) await dropFor(ctx, member, levelUpCrateKeyOf(level, slot), at, { floor });
}

async function levelUpHoggiesDropFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const drops = await memberDecision(ctx, levelUpHoggiesFlag, member);
  await exposed(ctx, levelUpHoggiesFlag, member, drops);
  return drops;
}
