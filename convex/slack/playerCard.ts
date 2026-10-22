import { v, type Infer } from "convex/values";
import { productName } from "../feedback/naming";
import { rarityValidator, rarityWord } from "../hoggies/catalogue";
import type { PersonStats } from "../website/linkCardStats";
import type { PersonPreview } from "../website/linkPreviews";
import { escaped, mrkdwn } from "./blocks";

const drawingVersion = 1;

const placeValidator = v.object({ rank: v.number(), tied: v.boolean(), thoughtful: v.number() });

export const playerCardValidator = v.object({
  name: v.string(),
  face: v.union(v.string(), v.null()),
  level: v.union(v.object({ level: v.number(), xp: v.number(), share: v.number() }), v.null()),
  team: v.union(v.object({ name: v.string(), crest: v.union(v.string(), v.null()) }), v.null()),
  place: v.union(placeValidator, v.null()),
  hoggies: v.union(v.object({ found: v.number(), total: v.number() }), v.null()),
  people: v.number(),
  emojis: v.number(),
  medals: v.number(),
  rarest: v.union(v.object({ name: v.string(), rarity: rarityValidator, picture: v.string() }), v.null()),
});

export type PlayerCard = Infer<typeof playerCardValidator>;

export function playerCardOf(preview: PersonPreview, stats: PersonStats, emojis: number): PlayerCard {
  const [team] = stats.teams;
  const [rarest] = stats.rarest;
  return {
    name: preview.name,
    face: preview.picture,
    level: stats.way,
    team: team === undefined ? null : { name: team.name, crest: team.crest },
    place: stats.place,
    hoggies: stats.hoggies,
    people: stats.people,
    emojis,
    medals: preview.medals.length,
    rarest: rarest === undefined ? null : { name: rarest.name, rarity: rarest.rarity, picture: rarest.picture },
  };
}

export function isJustStarting({ place, hoggies, people, emojis, medals, rarest }: PlayerCard) {
  return place === null && (hoggies?.found ?? 0) === 0 && people === 0 && emojis === 0 && medals === 0 && rarest === null;
}

export async function cardKeyOf(card: PlayerCard): Promise<string> {
  const facts = new TextEncoder().encode(JSON.stringify({ drawingVersion, card }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", facts));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function pictureBlocksOf(preview: PersonPreview, card: PlayerCard, picture: string, asOf: number) {
  const seconds = Math.floor(asOf / 1000);
  const day = `<!date^${seconds}^{date_short}|${new Date(seconds * 1000).toISOString().slice(0, 10)}>`;
  return [
    { type: "image", image_url: picture, alt_text: altTextOf(card) },
    { type: "context", elements: [mrkdwn(`*<${preview.page}|${escaped(preview.name)}>* · ${productName} album · as of ${day}`)] },
  ];
}

export function altTextOf(card: PlayerCard): string {
  const facts = [`${card.name}'s player card`, ...levelFactsOf(card), ...(card.team === null ? [] : [card.team.name]), ...(isJustStarting(card) ? [justStarting] : statFactsOf(card))];
  return facts.map((fact) => `${fact}.`).join(" ");
}

export const justStarting = "Just getting started: their first thanks and finds show up here";

function levelFactsOf({ level }: PlayerCard) {
  return level === null ? [] : [`Level ${level.level}, ${level.xp.toLocaleString("en-GB")} XP`];
}

function statFactsOf({ place, hoggies, people, emojis, medals, rarest }: PlayerCard) {
  return [
    ...(place === null ? [] : [`No. ${place.rank}${place.tied ? ", tied," : ""} on the all-time leaderboard, ${place.thoughtful} thoughtful kudos given`]),
    ...(hoggies === null || hoggies.found === 0 ? [] : [`${hoggies.found} of ${hoggies.total} hoggies found`]),
    ...(people === 0 ? [] : [`${people} ${people === 1 ? "person" : "people"} in their album`]),
    ...(emojis === 0 ? [] : [`${emojis} ${emojis === 1 ? "emoji" : "emojis"} unlocked`]),
    ...(medals === 0 ? [] : [`${medals} ${medals === 1 ? "medal" : "medals"}`]),
    ...(rarest === null ? [] : [`Rarest find: ${rarest.name}, ${rarityWord(rarest.rarity)}`]),
  ];
}
