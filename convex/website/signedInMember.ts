import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";

export type SignedInMember =
  | { kind: "signed-in"; workspace: string; user: string; name?: string; image?: string }
  | { kind: "signed-out" };

export async function signedInMember(ctx: QueryCtx): Promise<SignedInMember> {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (userId === null || sessionId === null) return { kind: "signed-out" };

  const session = await ctx.db.get(sessionId);
  if (session === null || session.userId !== userId || session.expirationTime < Date.now()) return { kind: "signed-out" };

  const user = await ctx.db.get(userId);
  if (user?.chatIdentity === undefined) return { kind: "signed-out" };
  return { kind: "signed-in", ...user.chatIdentity, name: user.name, image: user.image };
}
