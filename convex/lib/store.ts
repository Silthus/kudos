import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Rules of the Rewards Store. Pure functions, so they can be unit tested and shared
 * by every path that reads or changes a balance (web, Slack, demo).
 */

export const MAX_ACTIVE_REWARDS = 100;
export const MAX_OPEN_REDEMPTIONS = 5;

export const REWARD_BOUNDS = {
  name: 60,
  description: 280,
  prompt: 120,
  emoji: 16,
  cost: { min: 1, max: 100_000 },
  stock: { min: 0, max: 10_000 },
  maxPerMember: { min: 1, max: 100 },
} as const;

/**
 * What a member can spend: every kudos they ever received, plus grants, minus spending.
 * Spending never touches `totalReceived`, so recognition stats stay pure.
 */
export function balanceOf(member: Pick<Doc<"members">, "totalReceived" | "storeGranted" | "storeSpent">): number {
  return member.totalReceived + (member.storeGranted ?? 0) - (member.storeSpent ?? 0);
}

/** The Store only opens while members can see what they received (ADR 0001). */
export function storeOpen(workspace: Pick<Doc<"workspaces">, "storeEnabled" | "receivedVisibility">): boolean {
  return Boolean(workspace.storeEnabled) && workspace.receivedVisibility !== "hidden";
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
