import type { GroupId } from "./shell";
import type { AlbumPerson, GroupAlbum, Sticker } from "./collectionRead";
import type { Face } from "./shell";

type MadeUpLook = { kind: "initials" } | { kind: "photo"; hue: number } | { kind: "cutout"; colour: string };

type MadeUpTeammate = { key: string; name: string; look: MadeUpLook; former?: boolean };

const initials: MadeUpLook = { kind: "initials" };

const photo = (hue: number): MadeUpLook => ({ kind: "photo", hue });

const cutout = (colour: string): MadeUpLook => ({ kind: "cutout", colour });

const teammates: readonly MadeUpTeammate[] = [
  { key: "k:noor", name: "Noor Haddad", look: cutout("#f7a35c") },
  { key: "k:felix", name: "Felix Brandt", look: initials },
  { key: "k:priya", name: "Priya Natarajan", look: photo(262) },
  { key: "k:tomas", name: "Tomás Rivera", look: cutout("#8ad1c3") },
  { key: "k:mei", name: "Mei Tanaka", look: initials },
  { key: "k:jonas", name: "Jonas Weber", look: photo(205) },
  { key: "k:amara", name: "Amara Okonkwo", look: cutout("#e8b4d8") },
  { key: "k:leo", name: "Leo Fischer", look: initials },
  { key: "k:sofia", name: "Sofia Esposito", look: photo(40) },
  { key: "k:gone", name: "A teammate", look: initials, former: true },
  { key: "k:ivy", name: "Ivy Chen", look: photo(190) },
  { key: "k:rafael", name: "Rafael Costa", look: cutout("#b8c4f0"), former: true },
  { key: "k:hana", name: "Hana Kowalski", look: photo(95) },
  { key: "k:omar", name: "Omar Siddiqui", look: cutout("#f6d365") },
  { key: "k:elin", name: "Elin Sørensen", look: photo(220) },
  { key: "k:kai", name: "Kai Nakamura", look: initials },
  { key: "k:zara", name: "Zara Ahmed", look: photo(60) },
  { key: "k:diego", name: "Diego Alvarez", look: cutout("#c3e6a4") },
  { key: "k:lina", name: "Lina Petrov", look: photo(350) },
  { key: "k:ben", name: "Ben Oduya", look: initials },
];

const firstThanks: readonly [string, string][] = [
  ["k:noor", "2026-10-14T15:00:00Z"],
  ["k:felix", "2026-10-12T09:00:00Z"],
  ["k:priya", "2026-10-09T09:00:00Z"],
  ["k:tomas", "2026-10-05T09:00:00Z"],
  ["k:mei", "2026-09-30T09:00:00Z"],
  ["k:jonas", "2026-09-24T09:00:00Z"],
  ["k:amara", "2026-09-18T09:00:00Z"],
  ["k:leo", "2026-09-11T09:00:00Z"],
  ["k:sofia", "2026-09-04T09:00:00Z"],
  ["k:gone", "2026-08-28T09:00:00Z"],
  ["k:ivy", "2026-08-20T09:00:00Z"],
  ["k:rafael", "2026-08-12T09:00:00Z"],
];

const groups: readonly { group: string; name: string; mine: boolean; people: string[] }[] = [
  { group: "platform", name: "Platform", mine: true, people: ["k:felix", "k:hana", "k:jonas", "k:noor", "k:omar", "k:priya"] },
  { group: "support", name: "Support", mine: true, people: ["k:amara", "k:leo", "k:mei", "k:sofia", "k:tomas"] },
  { group: "design", name: "Design", mine: false, people: ["k:elin", "k:ivy", "k:kai", "k:zara"] },
  { group: "growth", name: "Growth", mine: false, people: ["k:ben", "k:diego", "k:felix", "k:lina", "k:mei", "k:noor", "k:omar"] },
  { group: "new-starters", name: "New starters", mine: false, people: [] },
];

function initialsOf(name: string) {
  return name === "A teammate" ? "?" : name.split(/\s+/).map((word) => word[0]!.toUpperCase()).slice(0, 2).join("");
}

const drawnFace = (hue: number) => `<circle cx='32' cy='26' r='13' fill='hsl(${hue} 30% 78%)'/><path d='M19 24a13 13 0 0 1 26 0v-4a13 13 0 0 0-26 0z' fill='hsl(${hue} 25% 28%)'/><path d='M8 64a24 24 0 0 1 48 0z' fill='hsl(${hue} 30% 78%)'/>`;

function pictureOf(body: string, background: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${background}${body}</svg>`)}`;
}

function madeUpFace(initials: string, look: MadeUpLook): Face {
  if (look.kind === "initials") return { kind: "initials", initials };
  if (look.kind === "photo") return { kind: "slack", image: pictureOf(drawnFace(look.hue), `<rect width='64' height='64' fill='hsl(${look.hue} 45% 52%)'/>`), initials };
  return { kind: "company-profile", image: pictureOf(drawnFace(20), ""), colour: look.colour, initials };
}

export function teammateOf(key: string) {
  const teammate = teammates.find((entry) => entry.key === key)!;
  return { key, name: teammate.name, face: madeUpFace(initialsOf(teammate.name), teammate.look), former: teammate.former ?? false };
}

function stickerOf([key, iso]: [string, string]): Sticker {
  const firstAt = Date.parse(iso);
  return { ...teammateOf(key), firstAt, seen: `${key}:${firstAt}` };
}

export const stickers: Sticker[] = firstThanks.map(stickerOf);

const held = new Set(stickers.map(({ key }) => key));

function albumPersonOf(key: string): AlbumPerson {
  return { ...teammateOf(key), held: held.has(key) };
}

export const albums: GroupAlbum[] = groups.map(({ group, people, ...album }) => {
  const shown = people.map(albumPersonOf);
  return { ...album, group: group as GroupId, held: shown.filter((person) => person.held).length, total: shown.length, people: shown };
});
