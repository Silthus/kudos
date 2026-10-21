import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type ActionCtx, type MutationCtx, type QueryCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { earnWelcomeItem } from "../items/welcome";
import { readyFromTheStartOnceVerified } from "../website/flag";
import { lookup } from "../workspace/directory";
import { lookUpUser, type LookUp } from "./directory";
import { convexActionTimeLimitMs, strandedPerSweep } from "./strandedJobs";

export const verificationTries = 3;
const firstRetryMs = 1000;

const personArgs = { workspace: v.string(), user: v.string() };

export async function verifyLater(ctx: MutationCtx, workspace: string, user: string, { firstSignIn }: { firstSignIn: boolean }) {
  const earlier = await verificationOf(ctx, workspace, user);
  if (earlier?.state === "pending") return;
  const fresh = { attempts: 0, state: "pending" as const, nextTryAt: Date.now() };
  if (earlier === null) await ctx.db.insert("memberVerifications", { workspace, user, ...fresh });
  else await ctx.db.patch(earlier._id, fresh);
  if (firstSignIn) await rememberFirstSignIn(ctx, workspace, user);
  await ctx.scheduler.runAfter(0, internal.slack.verifyMember.verifyMember, { workspace, user });
}

async function rememberFirstSignIn(ctx: MutationCtx, workspace: string, user: string) {
  if ((await firstSignInOf(ctx, workspace, user)) === null) await ctx.db.insert("firstSignIns", { workspace, user });
}

function firstSignInOf(ctx: QueryCtx, workspace: string, user: string) {
  return ctx.db
    .query("firstSignIns")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}

export function verificationOf(ctx: QueryCtx, workspace: string, user: string) {
  return ctx.db
    .query("memberVerifications")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}

export const verifyMember = observedAction({
  args: personArgs,
  handler: async (ctx, { workspace, user }) => {
    const answer = await lookUpOrFail(ctx, workspace, user);
    const retryAfterMs = answer.kind === "failed" ? answer.retryAfterMs : undefined;
    await ctx.runMutation(internal.slack.verifyMember.recordAttempt, { workspace, user, found: answer.kind === "found", retryAfterMs });
  },
});

async function lookUpOrFail(ctx: ActionCtx, workspace: string, user: string): Promise<LookUp> {
  try {
    return await lookUpUser(ctx, workspace, user);
  } catch (error) {
    await ctx.runMutation(internal.slack.verifyMember.recordAttempt, { workspace, user, found: false });
    throw error;
  }
}

export const recordAttempt = internalMutation({
  args: { ...personArgs, found: v.boolean(), retryAfterMs: v.optional(v.number()) },
  handler: async (ctx, { workspace, user, found, retryAfterMs }) => {
    const verification = await verificationOf(ctx, workspace, user);
    if (verification === null) return;
    if (found) return verified(ctx, verification);
    const attempts = verification.attempts + 1;
    if (attempts >= verificationTries) return failed(ctx, verification, attempts);
    const waitMs = Math.max(retryAfterMs ?? 0, firstRetryMs * 2 ** (attempts - 1));
    await ctx.db.patch(verification._id, { attempts, nextTryAt: Date.now() + waitMs });
    await ctx.scheduler.runAfter(waitMs, internal.slack.verifyMember.verifyMember, { workspace, user });
  },
});

async function verified(ctx: MutationCtx, verification: Doc<"memberVerifications">) {
  await ctx.db.delete(verification._id);
  const wasFirstSignIn = await forgetFirstSignIn(ctx, verification.workspace, verification.user);
  const person = await lookup(ctx, verification.workspace, verification.user);
  if (person?.kind !== "member") return;
  await readyFromTheStartOnceVerified(ctx, person.member);
  if (wasFirstSignIn) await earnWelcomeItem(ctx, verification.workspace, person.member, Date.now());
}

async function forgetFirstSignIn(ctx: MutationCtx, workspace: string, user: string): Promise<boolean> {
  const firstSignIn = await firstSignInOf(ctx, workspace, user);
  if (firstSignIn !== null) await ctx.db.delete(firstSignIn._id);
  return firstSignIn !== null;
}

function failed(ctx: MutationCtx, verification: Doc<"memberVerifications">, attempts: number) {
  return ctx.db.patch(verification._id, { attempts, state: "failed" });
}

export const retryStranded = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const stranded = await ctx.db
      .query("memberVerifications")
      .withIndex("by_state_and_next_try", (q) => q.eq("state", "pending").gte("nextTryAt", 0).lt("nextTryAt", Date.now() - convexActionTimeLimitMs))
      .take(strandedPerSweep);
    for (const verification of stranded) await tryAgainCountingTheStrandedTry(ctx, verification);
    if (stranded.length === strandedPerSweep) await ctx.scheduler.runAfter(0, internal.slack.verifyMember.retryStranded, {});
  },
});

async function tryAgainCountingTheStrandedTry(ctx: MutationCtx, verification: Doc<"memberVerifications">) {
  const { _id, workspace, user, attempts } = verification;
  if ((await lookup(ctx, workspace, user))?.kind === "member") return verified(ctx, verification);
  const attemptsWithStrandedTry = attempts + 1;
  if (attemptsWithStrandedTry >= verificationTries) return failed(ctx, verification, attemptsWithStrandedTry);
  await ctx.db.patch(_id, { attempts: attemptsWithStrandedTry, nextTryAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.slack.verifyMember.verifyMember, { workspace, user });
}
