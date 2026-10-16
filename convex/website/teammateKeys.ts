import type { QueryCtx } from "../_generated/server";
import { currentMembersOf, type MemberId } from "../workspace/directory";
import type { VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";

export function teammateKeyOf(me: VerifiedMember, teammate: MemberId): Promise<string> {
  return seenKeyOf(me.member, `member:${teammate}`);
}

export async function teammateOfKey(ctx: QueryCtx, me: VerifiedMember, key: string): Promise<MemberId | null> {
  for (const teammate of await currentMembersOf(ctx, me.workspace)) if ((await teammateKeyOf(me, teammate)) === key) return teammate;
  return null;
}
