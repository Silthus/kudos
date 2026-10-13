import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx, type QueryCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { lookUpUser, type LookUp } from "./directory";

export const verificationTries = 3;
const firstRetryMs = 1000;

const personArgs = { workspace: v.string(), user: v.string() };

export async function verifyLater(ctx: MutationCtx, workspace: string, user: string) {
  const earlier = await verificationOf(ctx, workspace, user);
  if (earlier?.state === "pending") return;
  if (earlier === null) await ctx.db.insert("memberVerifications", { workspace, user, attempts: 0, state: "pending" });
  else await ctx.db.patch(earlier._id, { attempts: 0, state: "pending" });
  await ctx.scheduler.runAfter(0, internal.slack.verifyMember.verifyMember, { workspace, user });
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
    console.warn(`verifying ${user} failed: ${error}`);
    return { kind: "failed" };
  }
}

export const recordAttempt = internalMutation({
  args: { ...personArgs, found: v.boolean(), retryAfterMs: v.optional(v.number()) },
  handler: async (ctx, { workspace, user, found, retryAfterMs }) => {
    const verification = await verificationOf(ctx, workspace, user);
    if (verification === null) return;
    if (found) return ctx.db.delete(verification._id);
    const attempts = verification.attempts + 1;
    if (attempts >= verificationTries) return ctx.db.patch(verification._id, { attempts, state: "failed" });
    await ctx.db.patch(verification._id, { attempts });
    const waitMs = Math.max(retryAfterMs ?? 0, firstRetryMs * 2 ** (attempts - 1));
    await ctx.scheduler.runAfter(waitMs, internal.slack.verifyMember.verifyMember, { workspace, user });
  },
});
