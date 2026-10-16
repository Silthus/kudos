import type { Drop } from "../../crates/drops";

export type PackReward = { xp: number; coins: number };

export type Pack = { n: number; drop: Drop; reward: PackReward };

const drops: Drop[] = [
  { hoggie: "wizard", name: "Wizard", rarity: "legendary", art: { kind: "hoggie", slug: "wizard" }, copy: 1, isNew: true, crest: null },
  { hoggie: "doctor", name: "Doctor", rarity: "rare", art: { kind: "hoggie", slug: "doctor" }, copy: 2, isNew: false, crest: null },
  { hoggie: "banana", name: "Banana", rarity: "common", art: { kind: "hoggie", slug: "banana" }, copy: 4, isNew: false, crest: null },
  { hoggie: "oprah", name: "Oprah", rarity: "epic", art: { kind: "hoggie", slug: "oprah" }, copy: 1, isNew: true, crest: null },
  { hoggie: "surfer", name: "Surfer", rarity: "uncommon", art: { kind: "hoggie", slug: "surfer" }, copy: 2, isNew: false, crest: null },
];

function rewardFor(n: number): PackReward {
  const xp = 40 + Math.round(((n * 37) % 121) / 5) * 5;
  const coins = 5 + ((n * 13) % 26);
  return { xp, coins };
}

export function packsFor(count: number): Pack[] {
  return Array.from({ length: count }, (_, at) => ({ n: at + 1, drop: drops[at % drops.length]!, reward: rewardFor(at + 1) }));
}

export function xpWords({ xp }: PackReward) {
  return `+${xp} XP`;
}

export function coinWords({ coins }: PackReward) {
  return `+${coins} ${coins === 1 ? "coin" : "coins"}`;
}
