import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Rules of the real-rewards part of the Store (catalog, redemptions, adjustments), priced in Hog
 * coins (ADR 0002). Pure functions, so they can be unit tested and shared by every path (web,
 * Slack, demo). The balance itself is `coinBalance` (lib/coins.ts); who may shop and the game
 * items are in lib/items.ts.
 */

export const MAX_ACTIVE_REWARDS = 100;
export const MAX_OPEN_REDEMPTIONS = 5;
/** Badges count up to this many open requests and show "99+" beyond. */
export const OPEN_COUNT_CAP = 100;

export const REWARD_BOUNDS = {
  name: 60,
  description: 280,
  prompt: 120,
  emoji: 16,
  cost: { min: 1, max: 100_000 },
  stock: { min: 0, max: 10_000 },
  maxPerMember: { min: 1, max: 100 },
} as const;

export const REDEMPTION_BOUNDS = { answer: 280, adminNote: 500 } as const;

export type RedemptionStatus = Doc<"redemptions">["status"];
export type RedemptionAction = "approve" | "fulfill" | "decline" | "cancel";
export type AdminAction = Exclude<RedemptionAction, "cancel">;

/** Open requests still hold their cost and wait for an admin; the rest are finished. */
export function isOpen(status: RedemptionStatus): boolean {
  return status === "pending" || status === "approved";
}

const NEXT: Record<RedemptionAction, { from: RedemptionStatus[]; to: RedemptionStatus; refund: boolean }> = {
  approve: { from: ["pending"], to: "approved", refund: false },
  fulfill: { from: ["pending", "approved"], to: "fulfilled", refund: false },
  decline: { from: ["pending", "approved"], to: "declined", refund: true },
  cancel: { from: ["pending"], to: "cancelled", refund: true },
};

/**
 * The redemption lifecycle: pending → approved → fulfilled, with declined (admin) and
 * cancelled (requester, pending only) as off-ramps that refund. `lastBy` names whoever
 * made the latest change, so a stale action reads "Already fulfilled by Lena."
 */
export function transition(
  from: RedemptionStatus,
  action: RedemptionAction,
  { isRequester, isAdmin }: { isRequester: boolean; isAdmin: boolean },
  lastBy?: string,
): { to: RedemptionStatus; refund: boolean } {
  if (action === "cancel" ? !isRequester : !isAdmin) {
    throw new ConvexError(action === "cancel" ? "Only the person who asked can cancel a request." : "Only workspace admins can do that.");
  }
  const next = NEXT[action];
  if (next.from.includes(from)) return { to: next.to, refund: next.refund };
  if (action === "cancel" && from === "approved") {
    throw new ConvexError("This request is already approved, so ask an admin if you need to call it off.");
  }
  throw new ConvexError(lastBy ? `Already ${from} by ${lastBy}.` : `Already ${from}.`);
}

export type RewardInput = {
  name: string;
  emoji: string;
  cost: number;
  description?: string;
  stock?: number;
  maxPerMember?: number;
  prompt?: string;
};

const wholeIn = (n: number, { min, max }: { min: number; max: number }) => Number.isInteger(n) && n >= min && n <= max;

const optionalText = (s: string | undefined) => {
  const trimmed = s?.trim();
  return trimmed ? trimmed : undefined;
};

/** Whether anything would actually render: not just spaces, joiners or variation selectors. */
const hasVisible = (s: string) => s.replace(/[\p{Cc}\p{Cf}\p{Mn}\p{Z}\s]/gu, "").length > 0;

/** Stock is a remaining count; `undefined` means unlimited. */
export function assertValidStock(stock: number | undefined) {
  if (stock !== undefined && !wholeIn(stock, REWARD_BOUNDS.stock)) {
    throw new ConvexError("Stock must be a whole number between 0 and 10,000, or unlimited.");
  }
}

/** Trims a reward and enforces the catalog bounds, with copy an admin can act on. */
export function validateRewardInput(input: RewardInput): Required<Pick<RewardInput, "name" | "emoji" | "cost">> & Omit<RewardInput, "name" | "emoji" | "cost"> {
  const b = REWARD_BOUNDS;
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!hasVisible(name) || name.length > b.name) throw new ConvexError(`Give the reward a name of 1–${b.name} characters.`);
  const emoji = input.emoji.trim();
  if (!hasVisible(emoji) || emoji.length > b.emoji) throw new ConvexError("Pick an emoji for the reward.");
  const description = optionalText(input.description);
  if (description && description.length > b.description) {
    throw new ConvexError(`Keep the description to ${b.description} characters.`);
  }
  const prompt = optionalText(input.prompt);
  if (prompt && prompt.length > b.prompt) throw new ConvexError(`Keep the question to ${b.prompt} characters.`);
  if (!wholeIn(input.cost, b.cost)) throw new ConvexError("Cost must be a whole number between 1 and 100,000.");
  assertValidStock(input.stock);
  if (input.maxPerMember !== undefined && !wholeIn(input.maxPerMember, b.maxPerMember)) {
    throw new ConvexError("The per-person limit must be a whole number between 1 and 100, or none.");
  }
  return { name, emoji, cost: input.cost, description, prompt, stock: input.stock, maxPerMember: input.maxPerMember };
}

// ── Balance adjustments (S6) ─────────────────────────────────────────────────

export const ADJUSTMENT_BOUNDS = { amount: 10_000, reason: { min: 3, max: 200 } } as const;

/** An audited balance change: a whole, non-zero amount within ±10,000 and a one-line reason. */
export function validateAdjustment({ amount, reason }: { amount: number; reason: string }) {
  const b = ADJUSTMENT_BOUNDS;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > b.amount) {
    throw new ConvexError("The amount must be a whole number between −10,000 and 10,000, not 0.");
  }
  const text = reason.replace(/\s+/g, " ").trim();
  if (text.length < b.reason.min || text.length > b.reason.max) {
    throw new ConvexError(`Give a reason of ${b.reason.min}–${b.reason.max} characters. The member sees it.`);
  }
  return { amount, reason: text };
}

// ── Review aids (S6) ─────────────────────────────────────────────────────────

/** "Where these coins came from" looks at the thoughtful kudos given in the 90 days before a request. */
export const CONTEXT_WINDOW_DAYS = 90;
/** Ledger events read for that window; someone who gave more is summarised from the newest ones. */
export const CONTEXT_READ_CAP = 3000;
export const CONCENTRATION = { share: 0.5, min: 20 } as const;

/**
 * Whether one person brought most of someone's coins: half or more, and at least 20 coins, so
 * a few thoughtful kudos to one teammate never look like gaming.
 */
export function concentration(people: { amount: number }[]): boolean {
  const total = people.reduce((sum, g) => sum + g.amount, 0);
  const top = Math.max(0, ...people.map((g) => g.amount));
  return top >= CONCENTRATION.min && top >= total * CONCENTRATION.share;
}
