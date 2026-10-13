// Variant E book requirements: one plain sentence per ladder saying what earns its next tier, worded for one or many.
import type { Ladder, LadderTier } from "../../data/types";

type Need = { more: number; threshold: number };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

const sentences: Record<string, (need: Need) => string> = {
  generosity: ({ more }) => `${more.toLocaleString()} more kudos to give`,
  recognition: ({ more }) => `${more.toLocaleString()} more kudos to receive`,
  connections: ({ more }) => `${plural(more, "more different person", "more different people")} to thank`,
  momentum: ({ threshold }) => `Give kudos ${plural(threshold, "workday", "workdays")} in a row`,
  dependability: ({ more }) => `${plural(more, "more day", "more days")} with a kudos given`,
  applause: ({ more }) => `Thank 3+ different people on ${plural(more, "more day", "more days")}`,
  seasons: ({ more }) => `${plural(more, "more calendar month", "more calendar months")} with a kudos given`,
  "old-friends": ({ more }) => `Thank someone again after 30+ days, ${plural(more, "more time", "more times")}`,
  "team-spirit": ({ more }) => `${plural(more, "more sticker album", "more sticker albums")} to complete`,
  "crowd-favourite": ({ more }) => `${plural(more, "more chime-in", "more chime-ins")} on kudos you give`,
  "standing-ovation": ({ threshold }) => `Get ${plural(threshold, "chime-in", "chime-ins")} on one kudos you receive`,
  amplifier: ({ more }) => `Chime in ${plural(more, "more time", "more times")}`,
};

export function requirementOf(ladder: Ladder, tier: LadderTier): string {
  const need = { more: Math.max(0, tier.threshold - ladder.count), threshold: tier.threshold };
  return sentences[ladder.id]?.(need) ?? `${need.more.toLocaleString()} more ${ladder.counts}`;
}
