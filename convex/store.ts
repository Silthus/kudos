import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import {
  balanceOf,
  isOpen,
  MAX_ACTIVE_REWARDS,
  MAX_OPEN_REDEMPTIONS,
  REDEMPTION_BOUNDS,
  storeOpen,
  transition,
  type RedemptionAction,
  type RedemptionStatus,
} from "./lib/store";
import { redemptionStatusValidator } from "./schema";

/**
 * The Rewards Store for members. Like `engine.ts` for kudos, this module is the one
 * place balances, stock and redemptions change: every path (web, Slack, demo) goes
 * through `requestRedemption` and `transitionRedemption`.
 */

/** Active rewards, cheapest first. Reads one more than the cap so callers can detect a full catalog. */
export async function activeRewards(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("rewards")
    .withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId).eq("status", "active"))
    .take(MAX_ACTIVE_REWARDS + 1);
}

/** A member's requests for one reward that weren't refunded, counted up to `limit`. */
async function countedRedemptions(ctx: QueryCtx, memberId: Id<"members">, rewardId: Id<"rewards">, limit: number) {
  let count = 0;
  for (const status of ["pending", "approved", "fulfilled"] as const) {
    if (count >= limit) break;
    const rows = await ctx.db
      .query("redemptions")
      .withIndex("by_member_reward_status", (q) => q.eq("memberId", memberId).eq("rewardId", rewardId).eq("status", status))
      .take(limit - count);
    count += rows.length;
  }
  return count;
}

/** How many of a member's requests still wait on an admin (at most a few). */
export async function openRedemptionCount(ctx: QueryCtx, memberId: Id<"members">) {
  let count = 0;
  for (const status of ["pending", "approved"] as const) {
    const rows = await ctx.db
      .query("redemptions")
      .withIndex("by_member_status", (q) => q.eq("memberId", memberId).eq("status", status))
      .take(MAX_OPEN_REDEMPTIONS + 1);
    count += rows.length;
  }
  return count;
}

/**
 * The four-eyes rule needs another admin who can actually act: signed in to Kudos, not
 * deactivated, not a bot. Slack sync makes every workspace admin a Kudos admin, so an admin
 * who never opened the app mustn't leave a request stuck. A sole admin decides alone.
 */
export async function otherActiveAdminExists(ctx: QueryCtx, workspaceId: Id<"workspaces">, memberId: Id<"members">) {
  const admins = ctx.db
    .query("members")
    .withIndex("by_workspace_isAdmin", (q) => q.eq("workspaceId", workspaceId).eq("isAdmin", true));
  for await (const admin of admins) {
    if (admin._id !== memberId && admin.userId && !admin.deactivated && !admin.isBot) return true;
  }
  return false;
}

/**
 * Tells Slack about a step once this transaction commits, with the requester's balance right
 * after it: the DM may go out after later steps. The demo has no Slack; a failed DM never
 * undoes the step, because the redemption's history is the source of truth.
 */
async function notifySlack(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  redemptionId: Id<"redemptions">,
  event: "requested" | Exclude<RedemptionStatus, "pending">,
  balance: number,
) {
  if (workspace.isDemo) return;
  await ctx.scheduler.runAfter(0, internal.slack.notifyRedemption, { redemptionId, event, balance });
}

/**
 * Creates a redemption and holds its cost: the balance goes down and stock by one, in the
 * same transaction as every check, so two people racing for the last item can't both win.
 */
export async function requestRedemption(
  ctx: MutationCtx,
  {
    workspace,
    member,
    rewardId,
    expectedCost,
    answer,
    now,
  }: { workspace: Doc<"workspaces">; member: Doc<"members">; rewardId: Id<"rewards">; expectedCost: number; answer?: string; now: number },
) {
  const glyph = workspace.emojiGlyph;
  if (!storeOpen(workspace)) throw new ConvexError("The rewards store isn't open in this workspace.");
  const reward = await ctx.db.get(rewardId);
  if (!reward || reward.workspaceId !== workspace._id) throw new ConvexError("Reward not found.");
  if (reward.status !== "active") throw new ConvexError("This reward isn't in the store any more.");
  if (expectedCost !== reward.cost) throw new ConvexError(`The price changed to ${reward.cost} ${glyph}. Take another look.`);
  if (reward.stock !== undefined && reward.stock <= 0) throw new ConvexError("Sold out. Someone got the last one.");
  if (reward.maxPerMember !== undefined && (await countedRedemptions(ctx, member._id, reward._id, reward.maxPerMember)) >= reward.maxPerMember) {
    throw new ConvexError(
      reward.maxPerMember === 1
        ? "You've already redeemed this. It's one per person."
        : `You've already redeemed this ${reward.maxPerMember} times, the limit per person.`,
    );
  }
  if ((await openRedemptionCount(ctx, member._id)) >= MAX_OPEN_REDEMPTIONS) {
    throw new ConvexError(`You have ${MAX_OPEN_REDEMPTIONS} open requests. Wait for one to finish before you ask for more.`);
  }
  let reply: string | undefined;
  if (reward.prompt) {
    reply = answer?.trim();
    if (!reply) throw new ConvexError(`Answer “${reward.prompt}” to redeem this.`);
    if (reply.length > REDEMPTION_BOUNDS.answer) throw new ConvexError(`Keep your answer to ${REDEMPTION_BOUNDS.answer} characters.`);
  }
  const balance = balanceOf(member);
  if (balance < reward.cost) throw new ConvexError(`You need ${reward.cost - balance} more ${glyph} for this.`);

  const redemptionId = await ctx.db.insert("redemptions", {
    workspaceId: workspace._id,
    memberId: member._id,
    rewardId: reward._id,
    rewardName: reward.name,
    rewardEmoji: reward.emoji,
    cost: reward.cost,
    prompt: reward.prompt,
    answer: reply,
    status: "pending",
    isOpen: true,
    stockHeld: reward.stock !== undefined,
    history: [{ status: "pending", at: now, by: member._id }],
    requestedAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(member._id, { storeSpent: (member.storeSpent ?? 0) + reward.cost });
  await ctx.db.patch(reward._id, {
    openCount: (reward.openCount ?? 0) + 1,
    ...(reward.stock !== undefined ? { stock: reward.stock - 1 } : {}),
  });
  await notifySlack(ctx, workspace, redemptionId, "requested", balance - reward.cost);
  return { redemptionId, balance: balance - reward.cost };
}

/**
 * Moves a redemption along its lifecycle (see `transition`), enforcing the four-eyes rule
 * for admin decisions. Declines and cancellations refund the cost and restock the reward.
 * A repeated action throws ("Already fulfilled by Lena.") rather than silently succeeding.
 */
export async function transitionRedemption(
  ctx: MutationCtx,
  {
    workspace,
    redemption,
    actor,
    action,
    note,
    now,
  }: { workspace: Doc<"workspaces">; redemption: Doc<"redemptions">; actor: Doc<"members">; action: RedemptionAction; note?: string; now: number },
) {
  // Every path (web, Slack, demo) goes through here, so check the ids here too.
  if (redemption.workspaceId !== workspace._id || actor.workspaceId !== workspace._id || actor.deactivated) {
    throw new ConvexError("Request not found.");
  }
  const last = redemption.history[redemption.history.length - 1];
  const lastBy = !last ? undefined : last.by === actor._id ? "you" : (await ctx.db.get(last.by))?.name;
  const isRequester = redemption.memberId === actor._id;
  const { to, refund } = transition(redemption.status, action, { isRequester, isAdmin: actor.isAdmin }, lastBy);
  if (action !== "cancel" && isRequester && (await otherActiveAdminExists(ctx, workspace._id, actor._id))) {
    throw new ConvexError("Another admin decides on your own requests.");
  }
  const text = action === "cancel" ? undefined : note?.trim() || undefined;
  if (text && text.length > REDEMPTION_BOUNDS.adminNote) throw new ConvexError(`Keep the note to ${REDEMPTION_BOUNDS.adminNote} characters.`);

  await ctx.db.patch(redemption._id, {
    status: to,
    isOpen: isOpen(to),
    history: [...redemption.history, { status: to, at: now, by: actor._id, ...(text ? { note: text } : {}) }],
    ...(text ? { adminNote: text } : {}),
    updatedAt: now,
  });

  const reward = await ctx.db.get(redemption.rewardId);
  if (reward) {
    const closes = isOpen(redemption.status) && !isOpen(to);
    await ctx.db.patch(reward._id, {
      ...(closes ? { openCount: Math.max(0, (reward.openCount ?? 0) - 1) } : {}),
      ...(to === "fulfilled" ? { fulfilledCount: (reward.fulfilledCount ?? 0) + 1 } : {}),
      // Only give back what the request took: nothing if stock was unlimited when it was made.
      // An archived reward is restocked too, which is harmless and keeps the count honest.
      ...(refund && redemption.stockHeld && reward.stock !== undefined ? { stock: reward.stock + 1 } : {}),
    });
  }
  const requester = await ctx.db.get(redemption.memberId);
  if (requester) {
    let balance = balanceOf(requester);
    if (refund) {
      await ctx.db.patch(requester._id, { storeSpent: (requester.storeSpent ?? 0) - redemption.cost });
      balance += redemption.cost;
    }
    if (to !== "pending") await notifySlack(ctx, workspace, redemption._id, to, balance);
  }
  return { status: to };
}

/** Loads a redemption, treating one from another workspace as missing. */
export async function redemptionInWorkspace(ctx: QueryCtx, workspace: Doc<"workspaces">, redemptionId: Id<"redemptions">) {
  const redemption = await ctx.db.get(redemptionId);
  if (!redemption || redemption.workspaceId !== workspace._id) throw new ConvexError("Request not found.");
  return redemption;
}

export const personValidator = v.object({ _id: v.id("members"), name: v.string(), avatarUrl: v.union(v.string(), v.null()) });

export const historyEntryValidator = v.object({
  status: redemptionStatusValidator,
  at: v.number(),
  by: v.union(personValidator, v.null()),
  note: v.optional(v.string()),
});

/** Resolves the people named in redemption histories, reading each member once. */
export function peopleCache(ctx: QueryCtx) {
  const cache = new Map<Id<"members">, Promise<Doc<"members"> | null>>();
  const member = (id: Id<"members">) => {
    if (!cache.has(id)) cache.set(id, ctx.db.get(id));
    return cache.get(id)!;
  };
  const person = async (id: Id<"members">) => {
    const m = await member(id);
    return m ? { _id: m._id, name: m.name, avatarUrl: m.avatarUrl ?? null } : null;
  };
  const history = (r: Doc<"redemptions">) =>
    Promise.all(r.history.map(async (h) => ({ status: h.status, at: h.at, by: await person(h.by), ...(h.note ? { note: h.note } : {}) })));
  return { member, person, history };
}

const catalogReward = v.object({
  _id: v.id("rewards"),
  name: v.string(),
  description: v.optional(v.string()),
  emoji: v.string(),
  cost: v.number(),
  stock: v.optional(v.number()),
  maxPerMember: v.optional(v.number()),
  prompt: v.optional(v.string()),
  yourCount: v.union(v.number(), v.null()), // counted for capped rewards only; null = no limit to count against
  affordable: v.boolean(),
  soldOut: v.boolean(),
  limitReached: v.boolean(),
});

/** What the signed-in member can spend and what's on the shelves. The balance is theirs alone. */
export const catalog = query({
  args: {},
  returns: v.union(
    v.object({ enabled: v.literal(false) }),
    v.object({
      enabled: v.literal(true),
      balance: v.number(),
      openCount: v.number(),
      maxOpen: v.number(),
      rewards: v.array(catalogReward),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!storeOpen(workspace)) return { enabled: false as const };
    const balance = balanceOf(member);
    const rewards = (await activeRewards(ctx, workspace._id)).slice(0, MAX_ACTIVE_REWARDS);
    return {
      enabled: true as const,
      balance,
      openCount: await openRedemptionCount(ctx, member._id),
      maxOpen: MAX_OPEN_REDEMPTIONS,
      rewards: await Promise.all(
        rewards.map(async (r) => {
          const yourCount = r.maxPerMember === undefined ? null : await countedRedemptions(ctx, member._id, r._id, r.maxPerMember);
          return {
            _id: r._id,
            name: r.name,
            description: r.description,
            emoji: r.emoji,
            cost: r.cost,
            stock: r.stock,
            maxPerMember: r.maxPerMember,
            prompt: r.prompt,
            yourCount,
            affordable: balance >= r.cost,
            soldOut: r.stock !== undefined && r.stock <= 0,
            limitReached: r.maxPerMember !== undefined && yourCount !== null && yourCount >= r.maxPerMember,
          };
        }),
      ),
    };
  },
});

/** Just the signed-in member's balance (null while the store is closed), for small surfaces like Me. */
export const balance = query({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    return storeOpen(workspace) ? balanceOf(member) : null;
  },
});

const myRedemption = v.object({
  _id: v.id("redemptions"),
  rewardName: v.string(),
  rewardEmoji: v.string(),
  cost: v.number(),
  prompt: v.optional(v.string()),
  answer: v.optional(v.string()),
  status: redemptionStatusValidator,
  adminNote: v.optional(v.string()),
  requestedAt: v.number(),
  updatedAt: v.number(),
  history: v.array(historyEntryValidator),
});

/** The signed-in member's own requests, newest first. There is no way to read anyone else's. */
export const myRedemptions = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(myRedemption),
  handler: async (ctx, { paginationOpts }) => {
    const { member } = await requireViewer(ctx);
    const result = await ctx.db
      .query("redemptions")
      .withIndex("by_member_requestedAt", (q) => q.eq("memberId", member._id))
      .order("desc")
      .paginate(paginationOpts);
    const people = peopleCache(ctx);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (r) => ({
          _id: r._id,
          rewardName: r.rewardName,
          rewardEmoji: r.rewardEmoji,
          cost: r.cost,
          prompt: r.prompt,
          answer: r.answer,
          status: r.status,
          adminNote: r.adminNote,
          requestedAt: r.requestedAt,
          updatedAt: r.updatedAt,
          history: await people.history(r),
        })),
      ),
    };
  },
});

export const redeem = mutation({
  args: { rewardId: v.id("rewards"), expectedCost: v.number(), answer: v.optional(v.string()) },
  returns: v.object({ redemptionId: v.id("redemptions"), balance: v.number() }),
  handler: async (ctx, { rewardId, expectedCost, answer }) => {
    const { workspace, member } = await requireViewer(ctx);
    return await requestRedemption(ctx, { workspace, member, rewardId, expectedCost, answer, now: Date.now() });
  },
});

/** Withdraws the signed-in member's own pending request and refunds it. */
export const cancel = mutation({
  args: { redemptionId: v.id("redemptions") },
  returns: v.null(),
  handler: async (ctx, { redemptionId }) => {
    const { workspace, member } = await requireViewer(ctx);
    const redemption = await redemptionInWorkspace(ctx, workspace, redemptionId);
    // Someone else's request is "not found", so ids can't be probed.
    if (redemption.memberId !== member._id) throw new ConvexError("Request not found.");
    await transitionRedemption(ctx, { workspace, redemption, actor: member, action: "cancel", now: Date.now() });
    return null;
  },
});
