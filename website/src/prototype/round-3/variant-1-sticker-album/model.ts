// PROTOTYPE (#625, round 3): the sticker album's page plan, sticker numbers and addresses. Never merge to main.
import type { Album, Hoggie, PackOpening, Person, Team } from "../album";

export type Rarity = Hoggie["rarity"];

export const rarityOrder: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export const shinyRarities: ReadonlySet<Rarity> = new Set(["rare", "epic", "legendary"]);

export type Spread = { kind: "contents" } | { kind: "team"; team: Team; colour: string } | { kind: "hoggies"; rarity: Rarity } | { kind: "records" };

export type Place = { view: "packs" } | { view: "album"; index: number; person: string | null };

export type Landing = { opening: PackOpening; step: "person" | "hoggie"; team: string | null };

const teamColours = ["#F54E00", "#1D4AFF", "#F7A501", "#2BA3B8", "#B62AD9", "#2F8F3A", "#D9354E"];

export function spreadsOf(album: Album): Spread[] {
  return [{ kind: "contents" }, ...album.teams.map((team, index): Spread => ({ kind: "team", team, colour: teamColours[index % teamColours.length]! })), ...rarityOrder.map((rarity): Spread => ({ kind: "hoggies", rarity })), { kind: "records" }];
}

export function hrefOfSpread(spread: Spread) {
  if (spread.kind === "team") return `/book#teams/${spread.team.team}`;
  if (spread.kind === "hoggies") return `/book#hoggies/${spread.rarity}`;
  if (spread.kind === "records") return "/book/earned";
  return "/book";
}

export function personHref(key: string) {
  return `/book#people/${key}`;
}

export function placeAt(location: { pathname: string; hash: string }, spreads: Spread[], album: Album): Place {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (location.pathname.endsWith("/book/earned")) return { view: "album", index: spreads.findIndex(({ kind }) => kind === "records"), person: null };
  if (hash === "packs") return { view: "packs" };
  const [section, item] = hash.split("/");
  if (section === "teams") return { view: "album", index: Math.max(0, spreads.findIndex((spread) => spread.kind === "team" && spread.team.team === item)), person: null };
  if (section === "hoggies") {
    const rarity = rarityOrder.includes(item as Rarity) ? (item as Rarity) : "common";
    return { view: "album", index: spreads.findIndex((spread) => spread.kind === "hoggies" && spread.rarity === rarity), person: null };
  }
  if (section === "people" && item !== undefined) {
    const person = album.people.find(({ key }) => key === item);
    if (person === undefined) return { view: "album", index: 0, person: null };
    const index = spreads.findIndex((spread) => spread.kind === "team" && spread.team.team === person.teams[0]);
    return { view: "album", index: Math.max(0, index), person: person.key };
  }
  return { view: "album", index: 0, person: null };
}

export function membersOf(team: Team, album: Album): { captains: Person[]; others: Person[] } {
  const people = team.people.flatMap((key) => album.people.find((person) => person.key === key) ?? []);
  return { captains: people.filter(({ name }) => team.leads.includes(name)), others: people.filter(({ name }) => !team.leads.includes(name)) };
}

export function stickerNumbersOf(album: Album) {
  const numbers = new Map<string, number>();
  let next = 1;
  for (const team of album.teams) {
    const { captains, others } = membersOf(team, album);
    for (const person of [...captains, ...others]) numbers.set(`${team.team}:${person.key}`, next++);
  }
  return numbers;
}

export function pageNumberOf(index: number, side: "left" | "right") {
  return index * 2 + (side === "left" ? 0 : 1);
}

export function tiltOf(text: string) {
  const hash = [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 3);
  return ((hash % 9) - 4) * 0.6;
}

export function landingTeamOf(opening: PackOpening, album: Album) {
  const completed = opening.teams.find(({ justCompleted }) => justCompleted);
  if (completed !== undefined) return completed.team;
  const mine = opening.teams.find(({ team }) => album.teams.find((entry) => entry.team === team)?.mine);
  return mine?.team ?? opening.teams[0]?.team ?? null;
}

const dates = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function dateWords(at: number) {
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(at)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return dates.format(at);
}

function startOfDay(at: number) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function firstNameOf(name: string) {
  return name.split(" ")[0] ?? name;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function motionMs(ms: number) {
  return reducedMotion ? 0 : ms;
}
