import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "../_generated/server";
import { signInWorkspace } from "../slack/signIn";
import { lookup, type MemberId } from "../workspace/directory";
import { websiteOpen } from "./flag";
import { verificationOf } from "../slack/verifyMember";

export type Denial = { kind: "closed" } | { kind: "signed-out" } | { kind: "verifying" } | { kind: "unverified" } | { kind: "not-a-member" };

export type VerifiedMember = {
  member: MemberId;
  workspace: string;
  user: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  image?: string;
};

type SignedIn = Omit<VerifiedMember, "member">;

export function memberQuery<Result>(handler: (ctx: QueryCtx, me: VerifiedMember) => Promise<Result>) {
  return query({
    args: {},
    handler: async (ctx): Promise<Result | Denial> => {
      const me = await verifiedMember(ctx);
      return "kind" in me ? me : handler(ctx, me);
    },
  });
}

async function verifiedMember(ctx: QueryCtx): Promise<VerifiedMember | Denial> {
  if (!(await websiteOpen(ctx))) return { kind: "closed" };
  const signedIn = await liveSession(ctx);
  if (signedIn === null || signedIn.workspace !== signInWorkspace()) return { kind: "signed-out" };
  return directoryAnswer(ctx, signedIn);
}

async function liveSession(ctx: QueryCtx): Promise<SignedIn | null> {
  const [userId, sessionId] = await Promise.all([getAuthUserId(ctx), getAuthSessionId(ctx)]);
  if (userId === null || sessionId === null) return null;
  const session = await ctx.db.get(sessionId);
  if (session === null || session.userId !== userId || session.expirationTime <= Date.now()) return null;
  const user = await ctx.db.get(userId);
  if (user?.chatIdentity === undefined) return null;
  const { chatIdentity, name, givenName, familyName, image } = user;
  return { ...chatIdentity, ...present({ name, givenName, familyName, image }) };
}

async function directoryAnswer(ctx: QueryCtx, signedIn: SignedIn): Promise<VerifiedMember | Denial> {
  const person = await lookup(ctx, signedIn.workspace, signedIn.user);
  if (person === undefined) {
    const verification = await verificationOf(ctx, signedIn.workspace, signedIn.user);
    return { kind: verification?.state === "failed" ? "unverified" : "verifying" };
  }
  if (person.kind !== "member") return { kind: "not-a-member" };
  return { member: person.member, ...signedIn };
}

function present<Fields extends Record<string, string | undefined>>(fields: Fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<Record<keyof Fields, string>>;
}
