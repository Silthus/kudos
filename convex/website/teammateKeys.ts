import type { QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import { currentMembersOf, type MemberId } from "../workspace/directory";
import { listedMembersIn } from "../workspace/listedMembers";
import type { VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";

export function teammateKeyOf(me: VerifiedMember, teammate: MemberId): Promise<string> {
  return seenKeyOf(me.member, `member:${teammate}`);
}

export async function teammateOfKey(ctx: QueryCtx, me: VerifiedMember, key: string): Promise<MemberId | null> {
  for (const teammate of await currentMembersOf(ctx, me.workspace)) if ((await teammateKeyOf(me, teammate)) === key) return teammate;
  return null;
}

export function listedMemberKeyOf(me: VerifiedMember, user: ChatUserId): Promise<string> {
  return seenKeyOf(me.member, `listed:${user}`);
}

export async function listedMemberOfKey(ctx: QueryCtx, me: VerifiedMember, key: string): Promise<ChatUserId | null> {
  for (const { user } of await listedMembersIn(ctx, me.workspace)) if ((await listedMemberKeyOf(me, user)) === key) return user;
  return null;
}
