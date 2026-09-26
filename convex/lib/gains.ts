import type { Infer } from "convex/values";
import type { gainValidator } from "../schema";
import { COINS, WALLET_LEVEL } from "./coins";
import { FRUITS, type FruitId } from "./fruits";
import { joinNames, RARITIES, RARITY_SLACK_BADGE, type Rarity } from "./messages";
import { escapeMrkdwn } from "./slack";
import { titleForLevel } from "./xp";

/**
 * Gains: what a member discovered or gained, told in a DM (#55 §G13). A new message discovered where
 * only they saw it, a level-up with its skill point, a skill or an item gained, a spree tier their
 * kudos reached, a plant reaching a new stage. Never a DM for XP or coins alone, never a reminder.
 *
 * Pure: how each kind reads in Slack (Block Kit and fallback text) and on the web. Collecting and
 * sending them is `convex/gains.ts`: everything one event gained goes out in one DM.
 */

export type Gain = Infer<typeof gainValidator>;

/**
 * Rolled messages that arrive as a DM: an event's gains ride along in them. Replies shown only where
 * they happened (the giver's reply, "limit reached", "self kudos", `/kudos me`) are passing, so a new
 * message discovered in one of those is a gain of its own.
 */
export const DM_CATEGORIES: ReadonlySet<string> = new Set(["receiver_success", "quest_complete"]);

/**
 * A new message is a DM-worthy discovery from Rare up. Commons and Uncommons are most of the first
 * weeks' rolls: a DM for each would be the stream §G13 forbids; their reply marks them as new.
 */
export function discoveryWorthADm(rarity: Rarity) {
  return RARITIES.indexOf(rarity) >= RARITIES.indexOf("rare");
}

/**
 * What a member may see of a gain: coins stay silent until their wallet opens (§G1), whatever the
 * system that paid them wrote.
 */
export function visibleTo(gain: Gain, level: number): Gain {
  if ((gain.kind === "spree_tier" || gain.kind === "offering_claimed") && gain.coins !== undefined && level < WALLET_LEVEL) {
    const { coins: _silent, ...rest } = gain;
    return rest;
  }
  return gain;
}
export type Audience = "slack" | "web";
type Person = { slackUserId: string; name: string };

/** The web page each kind links to ("Your level", "Your garden", ...). Null: no link. */
type LinkTo = (path: string) => string | null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hogCoins = (n: number) => plural(n, "Hog coin", "Hog coins");
const person = (p: Person, audience: Audience) => (audience === "slack" ? `<@${p.slackUserId}>` : p.name);
const people = (ps: Person[], audience: Audience) => joinNames(ps.map((p) => person(p, audience)));
/** Every name a system emits is escaped in Slack, so none can ping or link. */
const safe = (text: string, audience: Audience) => (audience === "slack" ? escapeMrkdwn(text) : text);
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
/** "a Sun fruit", "2 Sun fruit and a Moon fruit". */
function fruitWords(fruits: FruitId[]) {
  return joinNames(
    FRUITS.filter((f) => fruits.includes(f.id)).map((f) => {
      const n = fruits.filter((id) => id === f.id).length;
      return n === 1 ? `${article(f.name)} ${f.name}` : `${n} ${f.name}`;
    }),
  );
}

type Parts = {
  /** Bold in Slack, the first sentence on the web. */
  title: string;
  body?: string;
  /** Slack only: a leading emoji for the title. */
  icon?: string;
  /** Slack only: the context line under it. */
  context?: string[];
};

function parts(gain: Gain, audience: Audience, link: LinkTo): Parts {
  const to = (path: string, label: string) => {
    const url = link(path);
    return url ? `<${url}|${label}>` : null;
  };
  const links = (...items: (string | null)[]) => items.filter((i): i is string => i !== null);
  switch (gain.kind) {
    case "level_up": {
      const points = gain.level - gain.from;
      const coins =
        gain.from >= WALLET_LEVEL
          ? ` +${hogCoins(COINS.levelUp * points)}.`
          : gain.level >= WALLET_LEVEL && gain.balance !== undefined
            ? ` Your Hog coin wallet is open: ${hogCoins(gain.balance)} collected so far.`
            : "";
      return {
        title: `Level ${gain.level}: ${titleForLevel(gain.level)}`,
        body: `Your thoughtful kudos got you here. You earned ${points === 1 ? "a skill point" : `${points} skill points`} for your skill tree.${coins}`,
        context: links(`Level ${gain.level}`, to("/me", "Your level"), to("/skills", "Your skill tree")),
      };
    }
    case "discovery":
      return {
        icon: "✨",
        title: "New message discovered",
        body: audience === "slack" ? gain.slackText.split("\n").map((l) => `>${l}`).join("\n") : gain.webText,
        context: links(RARITY_SLACK_BADGE[gain.rarity], `${gain.collected} of ${gain.total} collected`, to("/discoveries", "Message gallery")),
      };
    case "skill":
      return {
        icon: "🌿",
        title: `New skill: ${safe(gain.name, audience)}`,
        body: [`${safe(gain.branch, audience)} branch.`, gain.description && safe(gain.description, audience)].filter(Boolean).join(" "),
        context: links(to("/skills", "Your skill tree")),
      };
    case "item":
      return {
        icon: "🎁",
        title: `${safe(gain.name, audience)} is yours`,
        body: gain.description && safe(gain.description, audience),
        context: links(to("/store", "Store")),
      };
    case "spree_tier": {
      const paid = [`+${gain.xp} XP`, gain.coins ? `+${hogCoins(gain.coins)}` : null].filter(Boolean).join(audience === "slack" ? " · " : " and ");
      const whose = `${person(gain.giver, audience)}'s kudos for ${people(gain.receivers, audience)}`;
      return gain.role === "started"
        ? { icon: "🎉", title: `Your kudos for ${people(gain.receivers, audience)} became a spree of ${gain.tier}`, body: paid, context: links(to("/me", "Your level")) }
        : {
            icon: "🎉",
            title: `A spree you joined reached ${gain.tier}`,
            body: audience === "slack" ? `${whose} · ${paid}` : `${whose}. ${paid}`,
            context: links(to("/me", "Your level")),
          };
    }
    case "tree_seed":
      return {
        icon: "🌱",
        title: "You planted the Ancient Seed",
        body: `Your thoughtful kudos for ${person(gain.receiver, audience)} was the first seed planted at the tree. The desert has its tree now, and every thoughtful kudos helps it grow.`,
        context: links(to("/", "Visit the tree")),
      };
    case "offering_claimed": {
      const month = gain.month;
      const coins = gain.coins !== undefined ? ` ${hogCoins(gain.coins)} went into your wallet.` : "";
      const fruit = gain.fruits.length === 0 ? "" : ` The tree dropped ${fruitWords(gain.fruits)}.`;
      return {
        title: `Your appreciation from ${month} fed the tree`,
        body: `Nobody offered it at the stone for 30 days, so it offered itself.${coins}${fruit}`,
        context: links(to("/offering", "Visit the offering stone")),
      };
    }
    case "plant_stage": {
      const name = safe(gain.stage, audience);
      const stage = gain.stage === "Ancient" ? "an Ancient plant" : `${article(gain.stage)} ${name}`;
      return {
        icon: "🌿",
        title: `Your ${safe(gain.species, audience)} for ${person(gain.teammate, audience)} is now ${stage}`,
        context: links(to("/garden", "Your garden")),
      };
    }
  }
}

/** One gain as mrkdwn (Slack) or one plain paragraph (web). */
export function gainText(gain: Gain, audience: Audience): string {
  const p = parts(gain, audience, () => null);
  if (audience === "web") {
    if (gain.kind === "discovery") {
      return `${p.title} (${capitalise(gain.rarity)}, ${gain.collected} of ${gain.total} collected): “${gain.webText}”`;
    }
    return [`${p.title}.`, p.body].filter(Boolean).join(" ");
  }
  return [`${p.icon ? `${p.icon} ` : ""}*${p.title}*`, p.body].filter(Boolean).join("\n");
}

/** Every gain of one DM as text: its Slack fallback, or the web copy. */
export function gainsText(gains: Gain[], audience: Audience): string {
  return gains.map((g) => gainText(g, audience)).join("\n");
}

/** The DM's blocks: a section per gain, with its context line (rarity, links) when there is one. */
export function gainBlocks(gains: Gain[], link: LinkTo): object[] {
  return gains.flatMap((gain) => {
    const context = parts(gain, "slack", link).context ?? [];
    return [
      { type: "section", text: { type: "mrkdwn", text: gainText(gain, "slack") } },
      ...(context.length > 0 ? [{ type: "context", elements: [{ type: "mrkdwn", text: context.join("  ·  ") }] }] : []),
    ];
  });
}

/**
 * Adds a gain to what an event gained so far. Level-ups merge into one (from the first level to the
 * last, with the latest balance): one event, one DM, one level-up in it.
 */
export function mergeGains(gains: Gain[], gain: Gain): Gain[] {
  if (gain.kind !== "level_up") return [...gains, gain];
  const i = gains.findIndex((g) => g.kind === "level_up");
  if (i < 0) return [...gains, gain];
  const prior = gains[i] as Extract<Gain, { kind: "level_up" }>;
  const merged: Gain = {
    kind: "level_up",
    level: Math.max(prior.level, gain.level),
    from: Math.min(prior.from, gain.from),
    ...(gain.balance !== undefined ? { balance: gain.balance } : prior.balance !== undefined ? { balance: prior.balance } : {}),
  };
  return gains.map((g, j) => (j === i ? merged : g));
}

const LABELS: [Gain["kind"], string][] = [
  ["tree_seed", "Ancient Tree"],
  ["offering_claimed", "Offering"],
  ["level_up", "Level up"],
  ["skill", "New skill"],
  ["spree_tier", "Spree"],
  ["plant_stage", "Garden"],
  ["item", "New item"],
  ["discovery", "New discovery"],
];

/** What a DM of gains is about, for a label on the web: the biggest thing in it. */
export function gainLabel(gains: Gain[]): string {
  return LABELS.find(([kind]) => gains.some((g) => g.kind === kind))?.[1] ?? "Game";
}

function capitalise(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
