import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { RegisteredQuery } from "convex/server";
import type { ObjectType, PropertyValidators } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { signInWorkspace } from "../slack/signIn";
import type { HomeMember } from "../feedback/homes";
import { lookup, type MemberId } from "../workspace/directory";
import { websiteOpenTo, websiteOpenWithoutWriting } from "./flag";
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

export type Verified = { me: VerifiedMember; person: HomeMember };

type SignedIn = Omit<VerifiedMember, "member">;

type MemberHandler<Args, Result> = (ctx: QueryCtx, me: VerifiedMember, args: Args) => Promise<Result>;

export function memberQuery<Result>(handler: MemberHandler<Record<string, never>, Result>): RegisteredQuery<"public", Record<string, never>, Promise<Result | Denial>>;
export function memberQuery<Args extends PropertyValidators, Result>(definition: {
  args: Args;
  handler: MemberHandler<ObjectType<Args>, Result>;
}): RegisteredQuery<"public", ObjectType<Args>, Promise<Result | Denial>>;
export function memberQuery(definition: MemberHandler<never, unknown> | { args: PropertyValidators; handler: MemberHandler<never, unknown> }) {
  const { args, handler } = typeof definition === "function" ? { args: {}, handler: definition } : definition;
  return query({
    args,
    handler: async (ctx, given) => {
      const verified = await verifiedMember(ctx);
      return "kind" in verified ? verified : handler(ctx, verified.me, given as never);
    },
  });
}

const closed: Denial = { kind: "closed" };

export async function verifiedMember(ctx: QueryCtx): Promise<Verified | Denial> {
  const signedIn = await liveSession(ctx);
  if (signedIn === null || signedIn.workspace !== signInWorkspace()) return answerWhileOpen(ctx, { kind: "signed-out" });
  const verified = await directoryAnswer(ctx, signedIn);
  if ("kind" in verified) return answerWhileOpen(ctx, verified);
  return (await websiteOpenTo(ctx, verified.me.member)) ? verified : closed;
}

async function answerWhileOpen(ctx: QueryCtx, denial: Denial): Promise<Denial> {
  return (await websiteOpenWithoutWriting(ctx)) ? denial : closed;
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

async function directoryAnswer(ctx: QueryCtx, signedIn: SignedIn): Promise<Verified | Denial> {
  const person = await lookup(ctx, signedIn.workspace, signedIn.user);
  if (person === undefined) {
    const verification = await verificationOf(ctx, signedIn.workspace, signedIn.user);
    return { kind: verification?.state === "failed" ? "unverified" : "verifying" };
  }
  if (person.kind !== "member") return { kind: "not-a-member" };
  return { me: { member: person.member, ...signedIn }, person };
}

function present<Fields extends Record<string, string | undefined>>(fields: Fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<Record<keyof Fields, string>>;
}
