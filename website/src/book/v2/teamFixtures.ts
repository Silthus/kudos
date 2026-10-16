import { catalogue } from "../../../../convex/hoggies/catalogue";
import type { CrestArt } from "../../crates/drops";
import type { Face } from "../../shell";
import { albums, stickers } from "../../stickerBookFixtures";

export type TeamPerson = { key: string; name: string; role: string; face: Face; lead: boolean; held: boolean; heldAt: number | null };

export type TeamAlbum = { team: string; name: string; art: CrestArt; mine: boolean; lead: string | null; held: number; total: number; unmatched: number; people: TeamPerson[]; collectedAt: number | null; seen: string | null };

const roles = ["Product Engineer", "Product Engineer", "Product Engineer", "Product Manager", "Designer", "Technical Writer", "Support Engineer"];

const everyone = new Map<string, { key: string; name: string; face: Face; former: boolean }>();
for (const person of [...stickers, ...albums.flatMap((album) => album.people)]) if (!person.former) everyone.set(person.key, person);

const held = new Map(stickers.map((sticker) => [sticker.key, sticker.firstAt]));

const givenNames = ["Aisha", "Bruno", "Chiara", "Dmitri", "Esme", "Farid", "Greta", "Hugo", "Ines", "Jamal", "Kenji", "Lotte", "Mateo", "Nadia", "Oskar", "Pilar", "Quinn", "Rosa", "Sven", "Talia", "Umar", "Vera", "Wren", "Ximena", "Yusuf", "Zoe"];

const familyNames = ["Adeyemi", "Bergström", "Castillo", "Dubois", "Eriksen", "Ferreira", "Gallo", "Horvat", "Iqbal", "Jansen", "Kimura", "Lindqvist", "Moreau", "Novak", "Okafor", "Petrova"];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0]!)
    .join("");

const strangers = Array.from({ length: 70 }, (_, at) => {
  const name = `${givenNames[at % givenNames.length]} ${familyNames[(at * 7) % familyNames.length]}`;
  return { key: `k:stranger-${at}`, name, face: { kind: "initials" as const, initials: initialsOf(name) }, former: false };
});

for (const stranger of strangers) everyone.set(stranger.key, stranger);

const people = [...everyone.values()];

const myTeams: Record<string, string[]> = {
  workflows: ["k:noor", "k:felix", "k:priya", "k:hana"],
  website: ["k:tomas", "k:elin"],
};

const knownRosters: Record<string, string[]> = {
  ...myTeams,
  "managed-warehouse": ["k:amara", "k:priya"],
  "platform-features": ["k:mei", "k:tomas", "k:felix"],
  "ai-research": ["k:noor", "k:stranger-1", "k:stranger-2", "k:stranger-3"],
  support: ["k:leo", "k:stranger-4", "k:stranger-5", "k:stranger-6", "k:stranger-7", "k:stranger-8"],
  replay: ["k:jonas", "k:stranger-9", "k:stranger-10"],
  editorial: ["k:sofia", "k:ivy", "k:stranger-11", "k:stranger-12"],
};

const unmatchedIn: Record<string, number> = { support: 2, "cloud-platform": 1 };

function seeded(seed: string) {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
}

function rosterOf(team: string, size: number): string[] {
  const known = knownRosters[team];
  if (known !== undefined) return known;
  const random = seeded(team);
  const pool = strangers.slice(13).sort(() => random() - 0.5);
  return pool.slice(0, size).map(({ key }) => key);
}

function personOf(key: string, at: number, lead: boolean): TeamPerson {
  const person = everyone.get(key)!;
  const heldAt = held.get(key) ?? null;
  return { key, name: person.name, role: roles[at % roles.length]!, face: person.face, lead, held: heldAt !== null, heldAt };
}

function albumOf({ crest, name, roster }: { crest: string; name: string; roster: readonly string[] }, at: number): TeamAlbum {
  const keys = rosterOf(crest, Math.min(people.length, roster.length + (at % 3)));
  const members = keys.map((key, index) => personOf(key, index + at, index === 0));
  const heldCount = members.filter((person) => person.held).length;
  const collectedAt = heldCount === members.length && members.length > 0 ? Math.max(...members.map((person) => person.heldAt ?? 0)) : null;
  return {
    team: crest,
    name,
    art: { kind: "crest", slug: crest },
    mine: myTeams[crest] !== undefined,
    lead: members[0]?.name ?? null,
    held: heldCount,
    total: members.length,
    unmatched: unmatchedIn[crest] ?? 0,
    people: members,
    collectedAt,
    seen: collectedAt === null ? null : `team:${crest}:${collectedAt}`,
  };
}

export const teamAlbums: TeamAlbum[] = catalogue.crests.map(albumOf).toSorted((first, second) => Number(second.mine) - Number(first.mine) || Number(second.collectedAt !== null) - Number(first.collectedAt !== null) || first.name.localeCompare(second.name));

export const peopleCollected = new Set(teamAlbums.flatMap((album) => album.people.filter((person) => person.held).map((person) => person.key))).size;

export const peopleOnTeams = new Set(teamAlbums.flatMap((album) => album.people.map((person) => person.key))).size;
