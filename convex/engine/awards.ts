import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { DayKey } from "./allowance";
import type { MessageRef } from "./messageEvent";

export type Award = { giver: MemberId; recipient: MemberId; kudos: number };

export async function insertAwards(ctx: MutationCtx, message: MessageRef, awards: Award[], day: DayKey, at: number) {
  for (const award of awards) {
    await ctx.db.insert("awards", { ...message, ...award, day, at });
  }
}
