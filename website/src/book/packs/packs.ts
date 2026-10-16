import type { Drop, Rarity } from "../../crates/drops";
import { foundWordsOf } from "../../crates/moments";
import type { BoughtCrate } from "../../crates/readyCrates";

export type PackState = "sealed" | "tearing" | "opened";

export type OpenedPack = { crate: string; n: number; drop: Drop | null };

export type ScenePack = { crate: string; n: number; state: PackState; drop: Drop | null | undefined; message: string | undefined };

export function packOf({ crate, target }: BoughtCrate): Pick<OpenedPack, "crate" | "n"> {
  return { crate, n: target.n };
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

export function openedWordsOf({ n, drop }: OpenedPack) {
  const opened = `You opened pack ${n}.`;
  return drop === null ? opened : `${opened} ${foundWordsOf(drop)}`;
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
