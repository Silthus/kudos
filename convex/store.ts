import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import { canSpend, coinBalance, formatCoins, WALLET_LEVEL } from "./lib/coins";
import { ITEMS, itemByKey, monthOf, quoteItem, realRewardsOn, SHOP_LEVEL, shopAccess } from "./lib/items";
import {
  isOpen,
  MAX_ACTIVE_REWARDS,
  MAX_OPEN_REDEMPTIONS,
  REDEMPTION_BOUNDS,
  transition,
  type RedemptionAction,
  type RedemptionStatus,
  validateAdjustment,
} from "./lib/store";
import { dayKeyFor, parseToday } from "./lib/time";
import { GAME_AREAS } from "./lib/xp";
import { playerOf } from "./game";
import { type Buyer, ITEM_EFFECTS, itemsBought } from "./items";
import { sendGains } from "./gains";
import { adjustmentSourceValidator, redemptionStatusValidator } from "./schema";

/**
 * The Store (#91, ADR 0002), priced only in Hog coins. Like `engine.ts` for kudos, this module is
 * the one place a coin balance goes down or is adjusted, and stock and redemptions change: every
 * path (web, Slack, demo) goes through `purchaseItem`, `requestRedemption`, `transitionRedemption`
 * and `grantBalance`. Each reads the member afresh and checks the balance in the transaction that
 * spends it, so two purchases racing for the same coins can't both win.
 */

/** A member's Hog coins as they stand in this transaction (a fresh read, never a caller's copy). */
export async function coinWallet(ctx: QueryCtx, memberId: Id<"members">) {
  const member = await ctx.db.get(memberId);
  if (!member) throw new ConvexError("Member not found.");
  const player = await playerOf(ctx, memberId);
  return { member, player, level: player?.level ?? 1, coins: coinBalance(player ?? { level: 1 }, member) };
}

/** Why this member can't shop, as a sentence, or null when the Store is open to them. */
function shopBlocker(workspace: Doc<"workspaces">, member: Doc<"members">, level: number): string | null {
  switch (shopAccess(workspace, member, level)) {
    case "off":
      return "The game isn't on in this workspace, so there's no Store.";
    case "hidden":
      return "You've hidden the game. Show it again on your Me page to shop.";
    case "locked":
      return `The Store opens at level ${SHOP_LEVEL}. You're level ${level}.`;
    case "open":
      return null;
  }
}

/** Spending needs the whole price; a balance below zero (after a revoke) blocks it altogether. */
function assertAffordable(balance: number, price: number) {
  if (canSpend(balance, price)) return;
  if (balance < 0) throw new ConvexError("Your balance is below zero after a revoke. Spending waits until it's above zero again.");
  const short = price - balance;
  throw new ConvexError(`You need ${short.toLocaleString("en-US")} more Hog coin${short === 1 ? "" : "s"} for this.`);
}

/**
 * Buys a game item (lib/items.ts): it applies instantly, with no approval. Every check, the debit,
 * the purchase row and the item's effect happen in this one transaction.
 */
export async function purchaseItem(
  ctx: MutationCtx,
  { workspace, member: caller, item: key, expectedPrice, now }: { workspace: Doc<"workspaces">; member: Doc<"members">; item: string; expectedPrice: number; now: number },
) {
  if (caller.workspaceId !== workspace._id || caller.isBot) throw new ConvexError("Member not found.");
  const { member, player, level, coins: wallet } = await coinWallet(ctx, caller._id);
  const blocker = shopBlocker(workspace, member, level);
  if (blocker) throw new ConvexError(blocker);
  const item = itemByKey(key);
  if (!item || !player) throw new ConvexError("That item isn't in the Store.");
  const effect = ITEM_EFFECTS[item.key];
  const unavailable = await effect.unavailable?.(ctx, { workspace, member, player, today: dayKeyFor(now, workspace.timezone) });
  if (unavailable) throw new ConvexError(`${item.name}: ${unavailable}`);
  const month = monthOf(now, workspace.timezone);
  const bought = { ever: await itemsBought(ctx, member._id, item.key), thisMonth: await itemsBought(ctx, member._id, item.key, month) };
  const { price, limitReached } = quoteItem(item, bought, player);
  if (limitReached) throw new ConvexError(`${item.name} is ${item.perMonth} a month, and you have them all. More next month.`);
  if (expectedPrice !== price) throw new ConvexError(`The price changed to ${formatCoins(price)}. Take another look.`);
  assertAffordable(wallet.balance, price);

  const purchaseId = await ctx.db.insert("itemPurchases", { workspaceId: workspace._id, memberId: member._id, item: item.key, price, month, at: now });
  await ctx.db.patch(member._id, { coinsSpent: wallet.spent + price });
  await effect.apply(ctx, { workspace, member, player, now, month, price }, purchaseId);
  // An item gained is a gain DM (#99, §G13); the pipeline decides who sees it and how it reads.
  await sendGains(ctx, workspace, member._id, [{ kind: "item", name: item.name, description: item.description }]);
  // The App Home shows the balance; keep it current (the demo has no Slack).
  if (!workspace.isDemo && !member.deactivated) {
    await ctx.scheduler.runAfter(0, internal.slack.refreshHome, { workspaceId: workspace._id, slackUserId: member.slackUserId });
  }
  return { balance: wallet.balance - price };
}

/** Whether a reward's price is in Hog coins; one from the received-kudos Store waits for an admin to re-save it. */
export const pricedInCoins = (reward: Pick<Doc<"rewards">, "unit">) => reward.unit === "coins";

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
    if (admin._id !== memberId && couldDecide(admin)) return true;
  }
  return false;
}

/** Someone who could act on the request queue if they were an admin: signed in, still here, not a bot. */
const couldDecide = (m: Doc<"members">) => Boolean(m.userId) && !m.deactivated && !m.isBot;

/** How many people an admin demoted are checked; more than a handful would be odd already. */
const REMOVED_ADMINS_READ = 50;

/**
 * Why `actor` may not decide on their own request, or null when they may (D8). Another admin
 * who can act decides. A sole admin decides alone, unless they became the sole admin by
 * demoting someone who could still decide: those four eyes still count, so demoting the other
 * admins and then approving your own request doesn't work, in whichever order it's tried.
 */
export async function ownDecisionBlocker(ctx: QueryCtx, workspace: Doc<"workspaces">, actor: Doc<"members">): Promise<string | null> {
  if (await otherActiveAdminExists(ctx, workspace._id, actor._id)) return "Another admin decides on your own requests.";
  const removed = await ctx.db
    .query("members")
    .withIndex("by_adminRemovedBy", (q) => q.eq("adminRemovedBy", actor._id))
    .take(REMOVED_ADMINS_READ);
  const decider = removed.find((m) => m.workspaceId === workspace._id && couldDecide(m));
  return decider ? `You removed ${decider.name}'s admin role, so another admin decides on your own requests.` : null;
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
  balance: number | null,
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
  if (!realRewardsOn(workspace)) throw new ConvexError("Real rewards aren't on in this workspace.");
  if (member.workspaceId !== workspace._id || member.isBot) throw new ConvexError("Member not found.");
  const { member: fresh, level, coins: wallet } = await coinWallet(ctx, member._id);
  const blocker = shopBlocker(workspace, fresh, level);
  if (blocker) throw new ConvexError(blocker);
  const reward = await ctx.db.get(rewardId);
  if (!reward || reward.workspaceId !== workspace._id) throw new ConvexError("Reward not found.");
  if (reward.status !== "active") throw new ConvexError("This reward isn't in the store any more.");
  if (!pricedInCoins(reward)) throw new ConvexError("This reward's price is being reviewed. Try again later.");
  if (expectedCost !== reward.cost) throw new ConvexError(`The price changed to ${formatCoins(reward.cost)}. Take another look.`);
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
  const { balance } = wallet;
  assertAffordable(balance, reward.cost);

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
    unit: "coins",
  });
  await ctx.db.patch(member._id, { coinsSpent: wallet.spent + reward.cost });
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
  if (action !== "cancel" && isRequester) {
    const blocker = await ownDecisionBlocker(ctx, workspace, actor);
    if (blocker) throw new ConvexError(blocker);
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
    const { coins: wallet, level } = await coinWallet(ctx, requester._id);
    let balance = wallet.balance;
    // A request from the received-kudos Store (no unit) never touched the coins, so it gives none back.
    if (refund && redemption.unit === "coins") {
      await ctx.db.patch(requester._id, { coinsSpent: wallet.spent - redemption.cost });
      balance += redemption.cost;
    }
    if (to !== "pending") await notifySlack(ctx, workspace, redemption._id, to, walletShown(workspace, requester, level) ? balance : null);
  }
  // Every admin's review DM tells the same story as the queue, whichever way the step came in.
  if (!workspace.isDemo && redemption.adminMessages?.length) {
    await ctx.scheduler.runAfter(0, internal.slack.syncAdminMessages, { redemptionId: redemption._id });
  }
  return { status: to };
}

/**
 * Erases a game item purchase as if it was never made: the item is taken back and its price
 * returns to the balance. Only the demo's "Hand back" uses it, and only for items that can be
 * taken back (`undo`); returns whether it did.
 */
export async function undoPurchase(ctx: MutationCtx, purchase: Doc<"itemPurchases">) {
  const item = itemByKey(purchase.item);
  const undo = item && ITEM_EFFECTS[item.key].undo;
  if (!undo) return false;
  await undo(ctx, purchase);
  const member = await ctx.db.get(purchase.memberId);
  if (member) await ctx.db.patch(member._id, { coinsSpent: (member.coinsSpent ?? 0) - purchase.price });
  await ctx.db.delete(purchase._id);
  return true;
}

/**
 * Erases a redemption as if it was never made: gives back what it still holds (the cost, and
 * the stock it took) and uncounts it on its reward. Only the demo's "Hand back my rewards"
 * uses it; a real workspace refunds through `transitionRedemption` and keeps the history.
 */
export async function undoRedemption(ctx: MutationCtx, redemption: Doc<"redemptions">) {
  const refunded = redemption.status === "declined" || redemption.status === "cancelled";
  const requester = await ctx.db.get(redemption.memberId);
  if (requester && !refunded && redemption.unit === "coins") {
    await ctx.db.patch(requester._id, { coinsSpent: (requester.coinsSpent ?? 0) - redemption.cost });
  }
  const reward = await ctx.db.get(redemption.rewardId);
  if (reward) {
    await ctx.db.patch(reward._id, {
      ...(redemption.isOpen ? { openCount: Math.max(0, (reward.openCount ?? 0) - 1) } : {}),
      ...(redemption.status === "fulfilled" ? { fulfilledCount: Math.max(0, (reward.fulfilledCount ?? 0) - 1) } : {}),
      ...(!refunded && redemption.stockHeld && reward.stock !== undefined ? { stock: reward.stock + 1 } : {}),
    });
  }
  await ctx.db.delete(redemption._id);
}

/**
 * An audited Hog coin adjustment: an admin's correction or an automation's grant (`source:
 * "system"`). It moves `coinsAdjusted` only, never XP, levels or kudos, so received totals,
 * leaderboards and analytics never see it. Callers do their own authz; this
 * checks the member belongs to the workspace and enforces the bounds.
 */
export async function grantBalance(
  ctx: MutationCtx,
  {
    workspace,
    member,
    amount,
    reason,
    source,
    by,
    now,
  }: {
    workspace: Doc<"workspaces">;
    member: Doc<"members">;
    amount: number;
    reason: string;
    source: "admin" | "system";
    by?: Doc<"members">;
    now: number;
  },
) {
  if (member.workspaceId !== workspace._id || member.isBot) throw new ConvexError("Member not found.");
  if (source === "admin") {
    if (by?._id === member._id) throw new ConvexError("You can't adjust your own balance. Ask another admin.");
    if (!by || by.workspaceId !== workspace._id || !by.isAdmin) throw new ConvexError("An admin adjustment needs the admin who made it.");
  } else if (by) {
    throw new ConvexError("System grants aren't made by an admin.");
  }
  const valid = validateAdjustment({ amount, reason });
  // Re-read: a caller looping over grants may hold a document from before the previous one.
  const { member: fresh, coins: wallet } = await coinWallet(ctx, member._id);
  const adjustmentId = await ctx.db.insert("balanceAdjustments", {
    workspaceId: workspace._id,
    memberId: member._id,
    amount: valid.amount,
    reason: valid.reason,
    source,
    ...(by ? { by: by._id } : {}),
    at: now,
    unit: "coins",
  });
  await ctx.db.patch(member._id, { coinsAdjusted: wallet.adjusted + valid.amount });
  // The App Home shows the balance; keep it current (the demo has no Slack).
  if (!workspace.isDemo && !fresh.deactivated) {
    await ctx.scheduler.runAfter(0, internal.slack.refreshHome, { workspaceId: workspace._id, slackUserId: member.slackUserId });
  }
  return { adjustmentId, balance: wallet.balance + valid.amount };
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

export const adjustmentValidator = v.object({
  _id: v.id("balanceAdjustments"),
  amount: v.number(),
  reason: v.string(),
  source: adjustmentSourceValidator,
  by: v.union(personValidator, v.null()), // null for system grants, or an admin whose record is gone
  at: v.number(),
});

/** Shapes an adjustment for the web, naming the admin who made it. */
export async function adjustmentRow(people: ReturnType<typeof peopleCache>, a: Doc<"balanceAdjustments">) {
  return { _id: a._id, amount: a.amount, reason: a.reason, source: a.source, by: a.by ? await people.person(a.by) : null, at: a.at };
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

/** Whether the member sees their Hog coins at all: the game is shown to them and the wallet is open (level 3). */
function walletShown(workspace: Doc<"workspaces">, member: Doc<"members">, level: number) {
  const access = shopAccess(workspace, member, level);
  return (access === "open" || access === "locked") && level >= WALLET_LEVEL;
}

const shopItem = v.object({
  key: v.string(),
  name: v.string(),
  description: v.string(),
  price: v.number(),
  perMonth: v.union(v.number(), v.null()),
  boughtThisMonth: v.number(),
  affordable: v.boolean(),
  // Why it can't be bought now (not for sale yet, or the monthly limit), or null.
  blocked: v.union(v.string(), v.null()),
});

/**
 * Every game item as one member sees it in a workspace month ("YYYY-MM"): its price for them, how
 * many they bought this month, and why they can't buy it now (not for sale yet, or the monthly
 * limit), if so. Shared by the web Store and `/kudos store`, so they never disagree.
 */
export async function shopItems(ctx: QueryCtx, buyer: Buyer & { today: string }, month: string, balance: number) {
  return await Promise.all(
    ITEMS.map(async (item) => {
      const memberId = buyer.member._id;
      const bought = { ever: await itemsBought(ctx, memberId, item.key), thisMonth: await itemsBought(ctx, memberId, item.key, month) };
      const { price, limitReached } = quoteItem(item, bought, buyer.player);
      const unavailable = (await ITEM_EFFECTS[item.key].unavailable?.(ctx, buyer)) ?? null;
      return {
        key: item.key,
        name: item.name,
        description: item.description,
        price,
        perMonth: item.perMonth ?? null,
        boughtThisMonth: bought.thisMonth,
        affordable: canSpend(balance, price),
        blocked: unavailable ?? (limitReached ? `${item.perMonth} a month: you have them all. More next month.` : null),
      };
    }),
  );
}

/**
 * The signed-in member's Store: the door (off, hidden, or locked below level 5 with how to get
 * there) or the game items with their prices and the balance. `today` is the viewer's workspace
 * day, so monthly limits roll over at midnight without the query reading the clock. Below level 3
 * not even the balance leaves the server (§G1).
 */
export const shop = query({
  args: { today: v.string() },
  returns: v.union(
    v.object({ access: v.literal("off") }),
    v.object({ access: v.literal("hidden") }),
    v.object({ access: v.literal("locked"), level: v.number(), unlockLevel: v.number(), how: v.string(), balance: v.union(v.number(), v.null()) }),
    v.object({ access: v.literal("open"), balance: v.number(), realRewards: v.boolean(), items: v.array(shopItem) }),
  ),
  handler: async (ctx, { today }) => {
    const { workspace, member } = await requireViewer(ctx);
    const { player, level, coins: wallet } = await coinWallet(ctx, member._id);
    const access = shopAccess(workspace, member, level);
    if (access === "off") return { access: "off" as const };
    if (access === "hidden") return { access: "hidden" as const };
    if (access === "locked" || !player) {
      const how = GAME_AREAS.find((a) => a.key === "store")!.how;
      return { access: "locked" as const, level, unlockLevel: SHOP_LEVEL, how, balance: walletShown(workspace, member, level) ? wallet.balance : null };
    }
    const day = parseToday(today);
    const items = await shopItems(ctx, { workspace, member, player, today: day }, day.slice(0, 7), wallet.balance);
    return { access: "open" as const, balance: wallet.balance, realRewards: realRewardsOn(workspace), items };
  },
});

/** Buys a game item for Hog coins. It applies instantly: no approval. */
export const buyItem = mutation({
  args: { item: v.string(), expectedPrice: v.number() },
  returns: v.object({ balance: v.number() }),
  handler: async (ctx, { item, expectedPrice }) => {
    const { workspace, member } = await requireViewer(ctx);
    return await purchaseItem(ctx, { workspace, member, item, expectedPrice, now: Date.now() });
  },
});

/**
 * Real rewards: what the signed-in member can spend and what's on the shelves, while the admin
 * switch is on and the Store is open to them (level 5). The balance is theirs alone.
 */
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
    const { level, coins: wallet } = await coinWallet(ctx, member._id);
    if (!realRewardsOn(workspace) || shopAccess(workspace, member, level) !== "open") return { enabled: false as const };
    const { balance } = wallet;
    const rewards = (await activeRewards(ctx, workspace._id)).slice(0, MAX_ACTIVE_REWARDS).filter(pricedInCoins);
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
            affordable: canSpend(balance, r.cost),
            soldOut: r.stock !== undefined && r.stock <= 0,
            limitReached: r.maxPerMember !== undefined && yourCount !== null && yourCount >= r.maxPerMember,
          };
        }),
      ),
    };
  },
});

/** Just the signed-in member's Hog coins (null until their wallet is open), for small surfaces. */
export const balance = query({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    const { level, coins: wallet } = await coinWallet(ctx, member._id);
    return walletShown(workspace, member, level) ? wallet.balance : null;
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
  // Made in the received-kudos Store: its cost was kudos, and a refund gives back no coins.
  legacy: v.boolean(),
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
          legacy: r.unit !== "coins",
        })),
      ),
    };
  },
});

/**
 * The signed-in member's own Hog coin adjustments, newest first ("+10 Hog coins from Lena"). Empty
 * until their wallet is open: an adjustment list next to a hidden balance would hint at it. Old
 * received-kudos adjustments (no unit) were reset with that balance, so they're left out.
 */
export const myAdjustments = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adjustmentValidator),
  handler: async (ctx, { paginationOpts }) => {
    const { workspace, member } = await requireViewer(ctx);
    const { level } = await coinWallet(ctx, member._id);
    if (!walletShown(workspace, member, level)) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("balanceAdjustments")
      .withIndex("by_member_unit_at", (q) => q.eq("memberId", member._id).eq("unit", "coins"))
      .order("desc")
      .paginate(paginationOpts);
    const people = peopleCache(ctx);
    return { ...result, page: await Promise.all(result.page.map((a) => adjustmentRow(people, a))) };
  },
});

export const redeem = mutation({
  args: { rewardId: v.id("rewards"), expectedCost: v.number(), answer: v.optional(v.string()) },
  returns: v.object({ redemptionId: v.id("redemptions"), balance: v.number() }),
  handler: async (ctx, { rewardId, expectedCost, answer }) => {
    const { workspace, member } = await requireViewer(ctx);
    const result = await requestRedemption(ctx, { workspace, member, rewardId, expectedCost, answer, now: Date.now() });
    // The demo has no Slack and nobody else at the desk: teammate admin Lena decides, live.
    if (workspace.isDemo) {
      await ctx.scheduler.runAfter(3_000 + Math.random() * 3_000, internal.demo.storeTeammateDecision, { redemptionId: result.redemptionId, action: "approve" });
    }
    return result;
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
