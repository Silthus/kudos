import type { QueryCtx } from "../_generated/server";
import type { Feature } from "../unlocks/feature";
import { stateOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";

export async function whenOpened<T>(ctx: QueryCtx, member: MemberId, feature: Feature, told: T): Promise<T | null> {
  return (await stateOf(ctx, member, feature)) === "open" ? told : null;
}
