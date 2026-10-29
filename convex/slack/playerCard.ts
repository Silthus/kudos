import { v, type Infer } from "convex/values";
import { milestoneTierValidator } from "../album/records";
import { productName } from "../feedback/naming";
import { rarityValidator, rarityWord } from "../album/hoggies/catalogue";
import type { PersonPreview } from "../website/linkPreviews";
import { escaped, mrkdwn, slackDayOf } from "./blocks";

const drawingVersion = 3;

const faceValidator = v.object({ picture: v.union(v.string(), v.null()), initials: v.string() });

const rarestValidator = v.object({ name: v.string(), rarity: rarityValidator, picture: v.string(), foundAt: v.number() });

export const drawnCardValidator = v.object({
  name: v.string(),
  face: faceValidator,
  level: v.union(v.object({ level: v.number(), xp: v.number(), share: v.number() }), v.null()),
  team: v.union(v.object({ name: v.string(), crest: v.union(v.string(), v.null()) }), v.null()),
  place: v.union(v.object({ rank: v.number(), tied: v.boolean(), thoughtful: v.number() }), v.null()),
  hoggies: v.union(v.object({ found: v.number(), total: v.number(), rarest: v.union(rarestValidator, v.null()) }), v.null()),
  people: v.object({ held: v.number(), newest: v.array(faceValidator) }),
  emojis: v.object({ count: v.number(), pictures: v.array(v.string()) }),
  medals: v.object({ count: v.number(), best: v.array(milestoneTierValidator) }),
});

export type DrawnCard = Infer<typeof drawnCardValidator>;

export type DrawnFace = DrawnCard["face"];

const foundOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function isAQuietCard({ hoggies, people, emojis, medals }: DrawnCard) {
  return (hoggies?.found ?? 0) + people.held + emojis.count + medals.count === 0;
}

export function quietLineOf(name: string) {
  return `${firstNameOf(name)}'s album is just getting started.`;
}

export function placeWordsOf(place: DrawnCard["place"]) {
  return place === null ? "Not on this week's board yet" : `No. ${place.rank}${place.tied ? " tied" : ""} this week`;
}

export function foundDayOf(at: number) {
  return foundOn.format(at);
}

export function counted(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export async function cardKeyOf(card: DrawnCard): Promise<string> {
  const facts = new TextEncoder().encode(JSON.stringify({ drawingVersion, card }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", facts));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function pictureBlocksOf(preview: PersonPreview, card: DrawnCard, picture: string, asOf: number) {
  return [
    { type: "image", image_url: picture, alt_text: altTextOf(card) },
    { type: "context", elements: [mrkdwn(`*<${preview.page}|${escaped(preview.name)}>* · ${productName} album · as of ${slackDayOf(asOf)}`)] },
  ];
}

export function altTextOf(card: DrawnCard): string {
  const facts = [`${card.name}'s player card`, ...levelFactsOf(card), card.team?.name ?? "No team yet", placeFactOf(card), ...(isAQuietCard(card) ? [quietLineOf(card.name)] : statFactsOf(card)), ...rarestFactsOf(card)];
  return facts.map((fact) => (fact.endsWith(".") ? fact : `${fact}.`)).join(" ");
}

function levelFactsOf({ level }: DrawnCard) {
  return level === null ? [] : [`Level ${level.level}, ${level.xp.toLocaleString("en-GB")} XP`];
}

function placeFactOf({ place }: DrawnCard) {
  return place === null ? placeWordsOf(place) : `${placeWordsOf(place)}, ${counted(place.thoughtful, "thoughtful kudos", "thoughtful kudos")}`;
}

function statFactsOf({ hoggies, people, emojis, medals }: DrawnCard) {
  return [
    ...(hoggies === null ? [] : [`${hoggies.found} of ${hoggies.total} hoggies found`]),
    `${counted(people.held, "person", "people")} in their album`,
    `${counted(emojis.count, "emoji", "emojis")} unlocked`,
    counted(medals.count, "medal", "medals"),
  ];
}

function rarestFactsOf({ hoggies }: DrawnCard) {
  if (hoggies === null) return [];
  const { rarest } = hoggies;
  return rarest === null ? ["No hoggie found yet"] : [`Rarest find: ${rarest.name}, ${rarityWord(rarest.rarity)}, found ${foundDayOf(rarest.foundAt)}`];
}

function firstNameOf(name: string) {
  return name.split(/\s+/, 1)[0] ?? name;
}
