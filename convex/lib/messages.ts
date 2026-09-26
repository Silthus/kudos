import type { Infer } from "convex/values";
import type { categoryValidator, rarityValidator } from "../schema";

export type Rarity = Infer<typeof rarityValidator>;
export type Category = Infer<typeof categoryValidator>;

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Relative drop weights. Roughly: 55% / 25% / 12% / 6% / 2%. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 55,
  uncommon: 25,
  rare: 12,
  epic: 6,
  legendary: 2,
};

export const RARITY_SLACK_BADGE: Record<Rarity, string> = {
  common: "⚪ Common",
  uncommon: "🟢 Uncommon",
  rare: "🔵 Rare",
  epic: "🟣 Epic",
  legendary: "🟠 *LEGENDARY*",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  giver_success: "Giver success",
  receiver_success: "Receiver success",
  limit_reached: "Limit reached",
  allowance_status: "Allowance check",
  self_kudos: "Self kudos",
  quest_complete: "Quest complete",
};

export type Template = { key: string; category: Category; rarity: Rarity; text: string };

type Tiered = Record<Rarity, string[]>;

const CATALOG_SOURCE: Record<Category, Tiered> = {
  giver_success: {
    common: [
      "Delivered! {recipients} just got {amount} {emoji} from you. {remaining} left for today.",
      "Nice one. {amount} {emoji} on its way to {recipients}. You've got {remaining} left to hand out today.",
      "Kudos sent to {recipients} in {channel}. {remaining} {emoji} still in your pocket.",
      "{recipients} will feel that. {amount} {emoji} delivered, {remaining} to go today.",
      "Recognition logged: {amount} {emoji} → {recipients}. Daily balance: {remaining}/{limit}.",
    ],
    uncommon: [
      "Generosity detected in {channel}! {recipients} received {amount} {emoji}. {remaining} left to keep it going.",
      "You just made someone's afternoon. {amount} {emoji} for {recipients}, {remaining} still up for grabs.",
      "Somewhere, a manager is nodding approvingly. {recipients} got {amount} {emoji}.",
    ],
    rare: [
      "📡 Signal received across the org: {recipients} just got {amount} {emoji} from you. {remaining} charges remaining.",
      "🎯 Direct hit! {amount} {emoji} landed squarely on {recipients}. Ammo left today: {remaining}.",
    ],
    epic: [
      "⚡ Epic giving energy! You channeled {amount} {emoji} straight into {recipients}. The team morale meter just ticked up.",
    ],
    legendary: [
      "🔥 LEGENDARY DROP! M-M-M-Monster {emoji} from your hands flow. {amount} points empower {recipients}. Songs will be sung in {channel}.",
    ],
  },
  receiver_success: {
    common: [
      "{giver} gave you {amount} {emoji} in {channel}.",
      "You've been recognized! {amount} {emoji} from {giver}.",
      "Incoming: {amount} {emoji} from {giver}. Well deserved.",
      "{giver} thinks you're doing great work: {amount} {emoji} for you.",
      "Ding! {amount} {emoji} just arrived from {giver} in {channel}.",
    ],
    uncommon: [
      "Word travels fast: {giver} just sent {amount} {emoji} your way from {channel}.",
      "Plot twist: you're appreciated. Source: {giver}, {amount} {emoji}.",
      "{giver} stopped what they were doing to send you {amount} {emoji}. That's a big deal.",
    ],
    rare: [
      "🌠 Shooting star spotted! {giver} launched {amount} {emoji} straight to you.",
      "🎁 Special delivery from {giver}: {amount} {emoji}, hand-picked for you.",
    ],
    epic: ["🏆 Epic recognition unlocked: {giver} crowned you with {amount} {emoji} in {channel}."],
    legendary: [
      "🌋 Supernova moment! {giver} blasted {amount} radiant {emoji} to you. This one goes in the hall of fame.",
    ],
  },
  limit_reached: {
    common: [
      "Whoa there, generous soul. You only have {remaining} {emoji} left today (you tried {requested}). Your allowance of {limit} resets at midnight.",
      "Not enough {emoji} left: {remaining} remaining, {requested} requested. Try fewer or wait until tomorrow.",
      "Your {emoji} pouch is lighter than your heart today. {remaining} left, {requested} needed.",
      "Almost out: {remaining} {emoji} left of {limit}. Nothing was sent this time.",
      "Easy, tiger. You'd need {requested} {emoji} but have {remaining}. Fresh batch tomorrow.",
    ],
    uncommon: [
      "Your generosity has outpaced the budget office. {remaining} {emoji} left, nothing sent.",
      "Error 429: Too Much Appreciation. {remaining}/{limit} {emoji} remaining today.",
      "The {emoji} vault is closed until midnight. You have {remaining} left, not {requested}.",
    ],
    rare: [
      "🧮 The math didn't math: {requested} requested, {remaining} available. Kudos aren't infinite (yet).",
      "🔋 Battery low: {remaining}/{limit} {emoji}. Recharge happens overnight.",
    ],
    epic: [
      "⏳ Time-locked! Your {emoji} regenerate at midnight. Until then, {remaining} is all you've got. Spend wisely.",
    ],
    legendary: [
      "🐉 You have awakened the Allowance Dragon. It guards {limit} {emoji} per day and you asked for too many. Return tomorrow, brave one.",
    ],
  },
  allowance_status: {
    common: [
      "You have {remaining} of {limit} {emoji} left to give today.",
      "Balance check: {remaining}/{limit} {emoji} available.",
      "{remaining} {emoji} ready to go. Who helped you out today?",
      "Today's allowance: {remaining} {emoji} left. They don't roll over, so use them!",
      "Hey {user}, {remaining} {emoji} are burning a hole in your pocket.",
    ],
    uncommon: [
      "Fun fact: unused {emoji} vanish at midnight. You have {remaining}.",
      "Your {emoji} reserves: {remaining}. Your teammates' appetite for appreciation: unlimited.",
      "{remaining} {emoji} left. Think of someone who unblocked you this week.",
    ],
    rare: [
      "🧭 Recognition radar online: {remaining} {emoji} available to deploy.",
      "📦 Inventory report: {remaining} × {emoji}. Shipping is free.",
    ],
    epic: ["⚡ Epic charge detected, {user}! {remaining} {emoji} are glowing for a legendary shout."],
    legendary: [
      "👑 By royal decree, {user} holds {remaining} {emoji} of pure appreciation. The realm awaits your generosity.",
    ],
  },
  self_kudos: {
    common: [
      "Nice try! You can't give {emoji} to yourself.",
      "Self-appreciation is healthy, but {emoji} are for others.",
      "Kudos to you for trying, but that's not how this works.",
      "Mirror, mirror… no. {emoji} only go to teammates.",
      "We love the confidence. Still no self-{emoji}.",
    ],
    uncommon: [
      "Self-high-five detected. Denied, but respected.",
      "Our records show you are, in fact, yourself. No {emoji} transferred.",
      "The {emoji} economy has strict anti-money-laundering rules.",
    ],
    rare: [
      "🪞 Reflection detected: your {emoji} bounced off the mirror and came back.",
      "🔄 Infinite loop prevented. {emoji} can't circle back to their sender.",
    ],
    epic: ["🌀 You tried to create {emoji} out of thin air. The universe noticed."],
    legendary: [
      "🏛️ The Council of Kudos has convened and ruled: you cannot knight yourself. Go make someone else's day.",
    ],
  },
  // Only ever sent for a quest completion (never bought, never rolled by anything else).
  quest_complete: {
    common: [
      "Quest complete: {quest}. That's how recognition spreads.",
      "{quest}: done. Someone's week got better because of you.",
      "You finished {quest}. The team noticed, even if they didn't say so.",
      "Checked off: {quest}. Thoughtful {emoji} beat loud {emoji} every time.",
      "{quest} complete. Keep noticing the good stuff.",
    ],
    uncommon: [
      "Quest log updated: {quest} ✔. Your recognition radar is well calibrated.",
      "{quest} cleared. Somewhere a teammate is re-reading your note.",
      "No trophies here, just this: {quest} is done and it mattered.",
    ],
    rare: [
      "🧭 Explorer's note: {quest} completed. You found the people others walk past.",
      "🌿 {quest} complete. Small {emoji}, planted in the right places, grow whole cultures.",
    ],
    epic: ["🗺️ Epic quest log entry: {user} completed {quest}. The map of who-helped-whom just got wider."],
    legendary: [
      "🏰 The Guild of Gratitude records it in gold: {user} has completed {quest}. The bards are warming up.",
    ],
  },
};

const CATEGORY_PREFIX: Record<Category, string> = {
  giver_success: "giver",
  receiver_success: "receiver",
  limit_reached: "limit",
  allowance_status: "allowance",
  self_kudos: "self",
  quest_complete: "quest",
};

export const CATALOG: Template[] = (Object.keys(CATALOG_SOURCE) as Category[]).flatMap((category) =>
  RARITIES.flatMap((rarity) =>
    CATALOG_SOURCE[category][rarity].map((text, i) => ({
      key: `${CATEGORY_PREFIX[category]}.${rarity}.${i + 1}`,
      category,
      rarity,
      text,
    })),
  ),
);

export const TEMPLATE_BY_KEY = new Map(CATALOG.map((t) => [t.key, t]));

/** Rolls a weighted rarity; a `minRarity` floor rolls only over it and the rarer ones, keeping their weights. */
export function rollRarity(random: () => number = Math.random, minRarity: Rarity = "common"): Rarity {
  const tiers = RARITIES.slice(RARITIES.indexOf(minRarity));
  const total = tiers.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  let roll = random() * total;
  for (const r of tiers) {
    roll -= RARITY_WEIGHTS[r];
    if (roll < 0) return r;
  }
  return minRarity;
}

/**
 * Pick a template for `category`. Rarity is rolled first; within that rarity we
 * lean towards messages the member hasn't discovered yet so collecting feels rewarding.
 */
export function pickTemplate(
  category: Category,
  discovered: Set<string>,
  random: () => number = Math.random,
  { minRarity }: { minRarity?: Rarity } = {},
): Template {
  const rarity = rollRarity(random, minRarity);
  const pool = CATALOG.filter((t) => t.category === category && t.rarity === rarity);
  const fresh = pool.filter((t) => !discovered.has(t.key));
  const source = fresh.length > 0 && random() < 0.65 ? fresh : pool;
  return source[Math.floor(random() * source.length)] ?? pool[0];
}

export type TemplateVars = Partial<
  Record<
    "giver" | "recipients" | "amount" | "emoji" | "remaining" | "limit" | "channel" | "user" | "requested" | "quest",
    string | number
  >
>;

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name as keyof TemplateVars];
    return value === undefined ? match : String(value);
  });
}

/** Human list: "Ana", "Ana and Ben", "Ana, Ben and Cleo". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
