import { hasSkill, rankOf, type Allocation } from "./skills";
import { countEmoji as count } from "./parse";
import { STORY_NOTE_WORDS } from "./quests";

/**
 * Cosmetics and Super kudos (#98; #55 §G5, §G7 Herald, §G12, §G17): the pure rules.
 *
 * - **Cosmetics** (avatar frames, banners, hoggie stickers) are Store items, bought once and worn on
 *   your profile and next to your name. Each is an **art slot**: the art pass (#101) loads PostHog's
 *   art from PostHog's servers at runtime; until then a placeholder in the slot's colours stands in.
 *   Nothing PostHog-drawn is ever committed while the repo is public.
 * - **Kudos-emoji variants** are extra Slack emoji (`:taco-golden:`) that give exactly like the
 *   workspace's kudos emoji, but only for a member who owns them (bought, or from Signature emoji).
 *   For everyone else they're just emoji. They change how a kudos looks, never what it gives.
 * - **Super kudos**: `:taco-super:` gives the usual amount for everybody. It's a Super kudos only for
 *   a Herald with the skill and a use left this month, to one person, with a 12+ word note, and not
 *   to the same person twice in a quarter; otherwise it's a normal kudos and the giver hears why.
 *
 * Slack apps can't add emoji: an admin uploads the variants and the Super kudos emoji once (Admin lists
 * them), and the kudos emoji itself only if it's a custom one.
 */

export type CosmeticSlot = "frame" | "banner" | "sticker";
export const COSMETIC_SLOTS: CosmeticSlot[] = ["frame", "banner", "sticker"];

/**
 * Where a cosmetic's art goes. `slot` names the art (#101 maps it to PostHog-hosted art); `colors`
 * paint the placeholder until then, and stay the fallback if the art can't load.
 */
export type ArtSlot = { slot: string; colors: string[] };

export type CosmeticKey =
  | "frameMeadow"
  | "frameSunrise"
  | "frameNightSky"
  | "bannerKeyboardGarden"
  | "bannerRollingHills"
  | "bannerStarfield"
  | "stickerGardener"
  | "stickerReader"
  | "stickerParty";

export type Cosmetic = { key: CosmeticKey; slot: CosmeticSlot; name: string; description: string; price: number; art: ArtSlot };

export const COSMETICS: readonly Cosmetic[] = [
  { key: "frameMeadow", slot: "frame", name: "Meadow frame", description: "A leafy green ring around your picture.", price: 30, art: { slot: "frame-meadow", colors: ["#4ade80", "#15803d"] } },
  { key: "frameSunrise", slot: "frame", name: "Sunrise frame", description: "A warm orange-to-gold ring around your picture.", price: 30, art: { slot: "frame-sunrise", colors: ["#f54e00", "#f7a501"] } },
  { key: "frameNightSky", slot: "frame", name: "Night-sky frame", description: "A deep blue ring with a violet glow.", price: 40, art: { slot: "frame-night-sky", colors: ["#1d4aff", "#a855f7"] } },
  { key: "bannerKeyboardGarden", slot: "banner", name: "Keyboard garden banner", description: "The hedgehogs' keyboard garden across the top of your profile.", price: 45, art: { slot: "banner-keyboard-garden", colors: ["#86efac", "#fde68a", "#fdba74"] } },
  { key: "bannerRollingHills", slot: "banner", name: "Rolling hills banner", description: "Green hills under a wide sky across your profile.", price: 35, art: { slot: "banner-rolling-hills", colors: ["#7dd3fc", "#bef264", "#4d7c0f"] } },
  { key: "bannerStarfield", slot: "banner", name: "Starfield banner", description: "A night full of stars across your profile.", price: 35, art: { slot: "banner-starfield", colors: ["#0f172a", "#312e81", "#6366f1"] } },
  { key: "stickerGardener", slot: "sticker", name: "Gardening hoggie", description: "A hoggie with a watering can, next to your name.", price: 20, art: { slot: "hoggie-gardener", colors: ["#f7a501", "#15803d"] } },
  { key: "stickerReader", slot: "sticker", name: "Reading hoggie", description: "A hoggie lost in a good book, next to your name.", price: 20, art: { slot: "hoggie-reader", colors: ["#f7a501", "#1d4aff"] } },
  { key: "stickerParty", slot: "sticker", name: "Party hoggie", description: "A hoggie in a party hat, next to your name.", price: 25, art: { slot: "hoggie-party", colors: ["#f7a501", "#db2777"] } },
];

export function cosmeticByKey(key: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.key === key);
}

/** What a member wears (`members.look`): one cosmetic key per slot. */
export type Look = Partial<Record<CosmeticSlot, string>>;

export type VariantItemKey = "emojiGolden" | "emojiRainbow";

export type EmojiVariant = {
  /** The shortcode is the workspace's kudos emoji + "-" + this: `taco-golden`. */
  suffix: string;
  name: string;
  /** Bought in the Store (`item`), or granted by a rank of Signature emoji. */
  source: { kind: "store"; price: number } | { kind: "skill"; rank: number };
  item?: VariantItemKey;
  art: ArtSlot;
};

export const EMOJI_VARIANTS: readonly EmojiVariant[] = [
  { suffix: "golden", name: "Golden kudos emoji", source: { kind: "store", price: 60 }, item: "emojiGolden", art: { slot: "emoji-golden", colors: ["#fde047", "#ca8a04"] } },
  { suffix: "rainbow", name: "Rainbow kudos emoji", source: { kind: "store", price: 60 }, item: "emojiRainbow", art: { slot: "emoji-rainbow", colors: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"] } },
  { suffix: "sparkle", name: "Sparkling kudos emoji", source: { kind: "skill", rank: 1 }, art: { slot: "emoji-sparkle", colors: ["#e0f2fe", "#38bdf8"] } },
  { suffix: "heart", name: "Heart kudos emoji", source: { kind: "skill", rank: 2 }, art: { slot: "emoji-heart", colors: ["#fecdd3", "#e11d48"] } },
];

export function variantBySuffix(suffix: string): EmojiVariant | undefined {
  return EMOJI_VARIANTS.find((v) => v.suffix === suffix);
}

export const SUPER_SUFFIX = "super";

export function variantShortcode(emojiName: string, suffix: string): string {
  return `:${emojiName}-${suffix}:`;
}

/** Every kudos emoji of a workspace: its own, then the Super kudos emoji and each variant (the ones an admin uploads). */
export function kudosEmojiNames(emojiName: string): string[] {
  return [emojiName, `${emojiName}-${SUPER_SUFFIX}`, ...EMOJI_VARIANTS.map((v) => `${emojiName}-${v.suffix}`)];
}

/**
 * The variants a member owns, by suffix: those bought (`bought`: their item keys) and one per rank
 * of Signature emoji. In catalog order.
 */
export function ownedVariants(skills: Allocation, bought: readonly string[]): string[] {
  const rank = rankOf(skills, "emoji_variants");
  return EMOJI_VARIANTS.filter((v) => (v.source.kind === "store" ? v.item !== undefined && bought.includes(v.item) : rank >= v.source.rank)).map((v) => v.suffix);
}

/**
 * Whether a message may carry kudos in this workspace at all: the kudos emoji, the Super kudos
 * emoji or any variant. Cheap enough for the Slack event handler, before anyone is looked up; who
 * gave it decides what counts (`readKudosEmoji`).
 */
export function mayCarryKudos(text: string, emojiName: string): boolean {
  return kudosEmojiNames(emojiName).some((name) => count(text, name) > 0);
}

export type KudosEmoji = {
  /** Kudos each mentioned person receives: every kudos emoji counts one (0: not an attempt). */
  amount: number;
  /** The first of the giver's own variants used, by suffix; null: none. */
  variant: string | null;
  /** How many Super kudos emoji it carries (each also counts in `amount`). */
  superEmoji: number;
};

/**
 * The kudos emoji in a message, for one giver: the workspace's, the Super kudos emoji (anyone's),
 * and the variants `owned` by this giver. Anyone else's variant is only an emoji.
 */
export function readKudosEmoji(text: string, emojiName: string, owned: readonly string[]): KudosEmoji {
  const superEmoji = count(text, `${emojiName}-${SUPER_SUFFIX}`);
  let amount = count(text, emojiName) + superEmoji;
  let variant: string | null = null;
  let first = Infinity;
  for (const suffix of owned) {
    const name = `${emojiName}-${suffix}`;
    const n = count(text, name);
    if (n === 0) continue;
    amount += n;
    const at = text.indexOf(`:${name}:`);
    if (at < first) {
      first = at;
      variant = suffix;
    }
  }
  return { amount, variant, superEmoji };
}

export const SUPER_KUDOS = {
  /** The note a Super kudos needs: a real "why" (#55 §G3). */
  minNoteWords: STORY_NOTE_WORDS,
} as const;

/** Super kudos a month: 1 with the skill, 2 with Encore. */
export function superKudosPerMonth(skills: Allocation): number {
  if (!hasSkill(skills, "super_kudos")) return 0;
  return hasSkill(skills, "encore") ? 2 : 1;
}

export type SuperKudosBlock = "no_skill" | "used_up" | "one_person" | "short_note" | "same_quarter";

/** Whether a kudos carrying the Super kudos emoji is a Super kudos, and if not, the first reason why. */
export function superKudosVerdict(input: {
  perMonth: number;
  usedThisMonth: number;
  people: number;
  noteWords: number | undefined;
  sameReceiverThisQuarter: boolean;
}): { ok: true } | { ok: false; reason: SuperKudosBlock } {
  if (input.perMonth === 0) return { ok: false, reason: "no_skill" };
  if (input.usedThisMonth >= input.perMonth) return { ok: false, reason: "used_up" };
  if (input.people !== 1) return { ok: false, reason: "one_person" };
  if ((input.noteWords ?? 0) < SUPER_KUDOS.minNoteWords) return { ok: false, reason: "short_note" };
  if (input.sameReceiverThisQuarter) return { ok: false, reason: "same_quarter" };
  return { ok: true };
}

/** What the giver hears when their Super kudos emoji gave a normal kudos (a private how-to). */
export function superKudosHowTo(reason: SuperKudosBlock, emoji: string, perMonth: number): string {
  const normal = `That ${emoji} counted as a normal kudos.`;
  switch (reason) {
    case "no_skill":
      return `${normal} Super kudos come with the Herald skill *Super kudos* on your skill tree: one a month, with a unique celebration for the person you thank.`;
    case "used_up":
      return `${normal} You've used your ${perMonth === 1 ? "Super kudos" : `${perMonth} Super kudos`} this month; ${perMonth === 1 ? "it comes" : "they come"} back on the 1st.`;
    case "one_person":
      return `${normal} A Super kudos is for one person: mention just them.`;
    case "short_note":
      return `${normal} A Super kudos needs a real why: a note of ${SUPER_KUDOS.minNoteWords} words or more. Your Super kudos is still yours to use.`;
    case "same_quarter":
      return `${normal} You already sent them a Super kudos this quarter: pick someone else, or wait for the next quarter. Your Super kudos is still yours to use.`;
  }
}

/**
 * What the giver hears when their Super kudos went out. `receiver` is a mention or a name.
 * `spotlight`: featured in the announcement channel, or would be outside the demo (which posts nothing).
 */
export function superKudosSent(receiver: string, left: number, perMonth: number, spotlight: "posted" | "demo" | null): string {
  return [
    `🌟 Super kudos sent! ${receiver} gets a celebration of their own, and a golden leaf grows on your plant for them.`,
    `${left} of ${perMonth} left this month.`,
    spotlight === "posted" ? "It's featured in the announcement channel." : null,
    spotlight === "demo" ? "In a real workspace, Spotlight features it in the announcement channel." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The receiver's celebration: who chose them and the why they wrote. In Slack `giver` is a mention
 * and `note` is escaped; on the web the note stays exactly as written.
 */
export function superKudosCelebration(giver: string, note: string, audience: "slack" | "web"): string {
  const title = `A Super kudos from ${giver}!`;
  const head = `🌟 ${audience === "slack" ? `*${title}*` : title} Each Herald only has one or two a month, and they chose you.`;
  return note ? `${head}\n${audience === "slack" ? "> " : ""}${note}` : head;
}

/** The announcement channel's spotlight (Spotlight capstone). `giver` and `receiver` are mentions. */
export function superKudosSpotlight(giver: string, receiver: string, note: string): string {
  return `🌟 ${giver} sent ${receiver} a Super kudos${note ? `:\n> ${note}` : "."}`;
}

/** A kudos' text as a Super kudos note: its emoji shortcodes left out. */
export function superKudosNote(text: string): string {
  return text
    .replace(/:[a-z0-9_+'-]+:(?::skin-tone-\d:)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A how-to's Slack mrkdwn as web text: its bold markers dropped (it quotes no user text). */
export function plainText(mrkdwn: string): string {
  return mrkdwn.replace(/\*/g, "");
}
