import type { CrateTarget } from "../../../../convex/website/routes";
import type { Collection } from "../../collectionRead";
import type { Drop, Rarity } from "../../crates/drops";
import { foundWordsOf } from "../../crates/moments";
import { crateTargetOfKey } from "../../crates/packKeys";
import { boughtCrateOf } from "../../crates/readyCrates";
import type { RewardKind } from "../../crates/rewards";
import { rewardWords } from "../../quests/QuestReward";
import type { AppliedReward } from "../../shell";
import { coinsText } from "../../skills/perkWords";

export type PackState = "sealed" | "tearing" | "opened";

export type WaitingPack = { crate: string; n: number; target: CrateTarget | undefined };

export type WaitingPacks = { packs: WaitingPack[]; listed: boolean; more: boolean };

export type OpenedPack = { crate: string; n: number; drop: Drop | null; applied: AppliedReward | null };

export type ScenePack = { crate: string; n: number; state: PackState; revealed: boolean; drop: Drop | null | undefined; applied: AppliedReward | null | undefined; message: string | undefined };

export type PackChip = { kind: Extract<RewardKind, "xp" | "coins">; words: string };

export const noPacks: WaitingPacks = { packs: [], listed: false, more: false };

export function waitingPacksOf(collection: Collection | undefined): WaitingPacks {
  if (collection === undefined) return noPacks;
  if (collection.packs !== undefined) return { packs: collection.packs.map(({ crate, n }) => ({ crate, n, target: crateTargetOfKey(crate) })), listed: true, more: collection.morePacks === true };
  const bought = (collection.bought ?? []).flatMap((crate) => boughtCrateOf(crate) ?? []);
  return { packs: bought.map(({ crate, target }) => ({ crate, n: target.n, target })), listed: false, more: false };
}

export function packOf({ crate, n }: WaitingPack): Pick<OpenedPack, "crate" | "n"> {
  return { crate, n };
}

export function chipsOf(applied: AppliedReward | null | undefined): PackChip[] {
  if (applied === null || applied === undefined) return [];
  return [...(applied.xp > 0 ? [{ kind: "xp" as const, words: `+${applied.xp} XP` }] : []), ...(applied.coins > 0 ? [{ kind: "coins" as const, words: `+${coinsText(applied.coins)}` }] : [])];
}

export function rarityNameOf(rarity: Rarity) {
  return `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`;
}

export function findWordsOf(drop: Drop | null) {
  if (drop === null) return "Opened";
  return drop.rarity === "legendary" ? "✦ Legendary find ✦" : `${rarityNameOf(drop.rarity)} find`;
}

export function nameOf({ n, drop }: OpenedPack) {
  return drop === null ? `Pack ${n}` : drop.name;
}

export function openedWordsOf({ n, drop, applied }: OpenedPack) {
  const opened = `You opened pack ${n}.`;
  return [opened, ...(drop === null ? [] : [foundWordsOf(drop)]), ...earnedWordsOf(applied)].join(" ");
}

function earnedWordsOf(applied: AppliedReward | null): string[] {
  if (applied === null) return [];
  const words = rewardWords({ xp: applied.xp, ...(applied.coins > 0 && { coins: applied.coins }) });
  return words === undefined ? [] : [`You earned ${words}.`];
}

export function inTheBookWordsOf(opened: OpenedPack[]) {
  const names = opened.flatMap(({ drop }) => drop?.name ?? []);
  if (names.length === 0) return "";
  const listed = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${listed} ${names.length === 1 ? "is" : "are"} in your book.`;
}

export function packsWordsOf(count: number) {
  return `${count} ${count === 1 ? "pack" : "packs"}`;
}

export function packsWaitingWordsOf(count: number) {
  return `${packsWordsOf(count)} waiting`;
}
