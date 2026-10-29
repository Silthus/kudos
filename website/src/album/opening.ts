import { hoggieNamed } from "../../../convex/album/hoggies/catalogue";
import type { TeamArt } from "../crates/TeamCrest";
import type { Rarity } from "../shell";
import type { Album, AlbumEmoji, AlbumPerson, CardHoggie, PackOpenAnswer, Thanked, WaitingPack } from "./answer";

export type Beat = "stack" | "person" | "glow" | "hoggie";

export type TeamTick = { team: string; name: string; art: TeamArt; before: number; after: number; total: number; completes: boolean };

export type OpenedSticker = { teams: TeamTick[]; hype: AlbumEmoji | null };

export type PackContents = { pack: WaitingPack; sticker: OpenedSticker | null; hoggie: CardHoggie | null; xp: number };

export function contentsOf(before: Album, pack: WaitingPack, { items, applied }: Extract<PackOpenAnswer, { kind: "opened" }>): PackContents {
  const sticker = items.some((item) => item.kind === "sticker") ? stickerOf(before, pack.person) : null;
  const hoggie = items.find((item) => item.kind === "hoggie");
  return {
    pack,
    sticker,
    hoggie: hoggie === undefined ? null : { hoggie: hoggie.hoggie, name: hoggieNamed(hoggie.hoggie)?.name ?? hoggie.hoggie, rarity: hoggie.rarity, isNew: hoggie.isNew },
    xp: applied?.xp ?? 0,
  };
}

export function beatsOf(contents: PackContents): Beat[] {
  return [...(["stack"] as const), ...(contents.sticker === null ? [] : (["person"] as const)), ...(contents.hoggie === null ? [] : (["glow", "hoggie"] as const))];
}

export function lastBeatOf(contents: PackContents): Beat {
  return beatsOf(contents).at(-1)!;
}

export function beatAfter(contents: PackContents, beat: Beat): Beat {
  const beats = beatsOf(contents);
  return beats[Math.min(beats.indexOf(beat) + 1, beats.length - 1)]!;
}

export function hasTurned(contents: PackContents, beat: Beat, card: "person" | "hoggie"): boolean {
  return beatsOf(contents).indexOf(beat) >= beatsOf(contents).indexOf(card);
}

export function shownTeamOf(sticker: OpenedSticker): TeamTick | null {
  return sticker.teams.find(({ completes }) => completes) ?? sticker.teams[0] ?? null;
}

export function completedTeamOf(contents: PackContents): TeamTick | null {
  return contents.sticker?.teams.find(({ completes }) => completes) ?? null;
}

export function nameOf(thanked: Thanked) {
  return thanked.name ?? "a teammate";
}

export function cardNameOf(thanked: Thanked) {
  return thanked.name === null ? "Your teammate's card" : `${thanked.name}'s card`;
}

const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export function rarityWordOf(rarity: Rarity) {
  return rarityWords[rarity];
}

export function sparklesFor(rarity: Rarity): number {
  return { common: 0, uncommon: 0, rare: 12, epic: 16, legendary: 22 }[rarity];
}

export function confettiFor(contents: PackContents): "gold" | "modest" | null {
  if (contents.sticker === null) return null;
  return completedTeamOf(contents) === null ? "modest" : "gold";
}

export function heldSaying(contents: PackContents): string {
  const cards = [contents.sticker === null ? null : `${cardNameOf(contents.pack.thanked)}, new in your album`, contents.hoggie === null ? null : `${contents.hoggie.name}, ${rarityWordOf(contents.hoggie.rarity)}, ${contents.hoggie.isNew ? "new" : "a spare"}`].filter((card) => card !== null);
  const xp = contents.xp > 0 ? ` +${contents.xp} XP.` : "";
  return `You opened the pack for thanking ${nameOf(contents.pack.thanked)}: ${cards.join(", and ")}.${xp}`;
}

function personIn(album: Album, person: string): AlbumPerson | undefined {
  return album.people.find((listed) => listed.person === person);
}

function stickerOf(album: Album, person: string): OpenedSticker {
  const teams = personIn(album, person)?.teams ?? [];
  return {
    teams: album.teams.filter(({ team }) => teams.includes(team)).map(({ team, name, art, held, total }) => ({ team, name, art, before: held, after: Math.min(total, held + 1), total, completes: held < total && held + 1 >= total })),
    hype: album.emojis.find(({ id, kind, earned }) => kind === "hype" && earned && id === `hype:${person}`) ?? null,
  };
}
