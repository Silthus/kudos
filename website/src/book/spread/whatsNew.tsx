import type { ReactNode } from "react";
import type { Collection, CollectionHoggie } from "../../collectionRead";
import { rarityWordsOf } from "../../crates/drops";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import { dateWords } from "../dates";
import { HoggieCoin } from "../HoggieCoin";
import { spreadHrefOf } from "./spreads";

export type NewItem = { key: string; at: number; art: ReactNode; title: string; sub: string; href: string };

type Fresh = { fresh: ReadonlySet<string>; timeZone: string };

export function newItemsOf(collection: Collection, { fresh, timeZone }: Fresh): NewItem[] {
  const hoggies: NewItem[] = collection.hoggies
    .filter((hoggie): hoggie is CollectionHoggie & { seen: string; firstAt: number } => hoggie.seen !== null && hoggie.firstAt !== null && fresh.has(hoggie.seen))
    .map((hoggie) => ({ key: hoggie.seen, at: hoggie.firstAt, art: <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={40} />, title: hoggie.name, sub: `${rarityWordsOf(hoggie.rarity)} · ${dateWords(hoggie.firstAt, timeZone)}`, href: spreadHrefOf({ kind: "hoggies", rarity: hoggie.rarity }) }));
  const crests: NewItem[] = (collection.crests ?? [])
    .filter((crest) => crest.seen !== null && crest.collectedAt !== null && fresh.has(crest.seen))
    .map((crest) => ({ key: crest.seen!, at: crest.collectedAt!, art: <TeamCrest art={crest.art} size={40} />, title: `${crest.name} crest`, sub: `Team complete · ${dateWords(crest.collectedAt!, timeZone)}`, href: spreadHrefOf({ kind: "team", team: crest.crest }) }));
  const teamCrests: NewItem[] = (collection.teams ?? [])
    .filter((team): team is typeof team & { crest: { collectedAt: number; seen: string } } => team.crest !== null && fresh.has(team.crest.seen))
    .map((team) => ({ key: team.crest.seen, at: team.crest.collectedAt, art: <TeamCrest art={team.art} size={40} name={team.name} />, title: `${team.name} crest`, sub: `Crest · ${dateWords(team.crest.collectedAt, timeZone)}`, href: spreadHrefOf({ kind: "team", team: team.team }) }));
  const stickers: NewItem[] = (collection.stickers ?? [])
    .filter((sticker) => fresh.has(sticker.seen))
    .map((sticker) => ({ key: sticker.seen, at: sticker.firstAt, art: <MemberFace face={sticker.face} className="size-10" />, title: sticker.name, sub: `Sticker · ${dateWords(sticker.firstAt, timeZone)}`, href: spreadHrefOf({ kind: "teams" }) }));
  return [...crests, ...teamCrests, ...hoggies, ...stickers].sort((first, second) => second.at - first.at);
}
