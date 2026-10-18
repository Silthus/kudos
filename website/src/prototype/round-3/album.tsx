// PROTOTYPE (#625, round 3): the collection-first album world. People are the collection, hoggies are the surprise. In memory only. Never merge to main.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LadderId } from "../../../../convex/achievements/ladders";
import { catalogue, rarities, type Rarity } from "../../../../convex/hoggies/catalogue";
import { levelOf, xpToReach } from "../../../../convex/progression/levels";
import type { TeamArt } from "../../crates/TeamCrest";
import type { Face } from "../../shell";
import { teamPages, teamStickers } from "../../teamPagesFixtures";

export type PersonStats = { firstThankedAt: number | null; kudosGiven: number; kudosReceived: number; hugsGiven: number; hugsReceived: number; bestMessage: string | null };

export type Person = { key: string; name: string; face: Face; role: string | null; teams: string[]; lead: boolean; collectedAt: number | null; stats: PersonStats; packedThisWeek: boolean };

export type Team = { team: string; name: string; art: TeamArt; mine: boolean; people: string[]; leads: string[]; held: number; total: number; complete: boolean; completedAt: number | null };

export type Hoggie = { hoggie: string; name: string; rarity: Rarity; count: number; firstAt: number | null };

export type Pack = { id: string; person: string; earnedAt: number; message: string };

export type PackOpening = {
  pack: Pack;
  person: { key: string; name: string; face: Face; isNew: boolean; teams: string[] };
  hoggie: { hoggie: string; name: string; rarity: Rarity; isNew: boolean; copy: number };
  xp: { gained: number; before: number; after: number; levelBefore: number; levelAfter: number };
  teams: { team: string; name: string; held: number; total: number; justCompleted: boolean }[];
};

export type JourneyStep = { step: "hug" | "thoughtful" | "first-pack" | "complete-team"; goal: string; done: boolean };

export type MilestoneTier = { tier: "bronze" | "silver" | "gold" | "diamond"; at: number; name: string; earnedAt: number | null };

export type Milestone = { id: string; name: string; counts: string; emblem: LadderId; count: number; tiers: MilestoneTier[] };

export type Level = { level: number; xp: number; startsAt: number; nextAt: number; toNext: number; progress: number };

export type BoardRow = { rank: number; name: string; face: Face; thoughtful: number; you: boolean };

export type Moment =
  | { kind: "thoughtful-given"; at: number; person: string; message: string; packed: boolean }
  | { kind: "thoughtful-received"; at: number; person: string; message: string }
  | { kind: "hug-given"; at: number; person: string }
  | { kind: "hug-received"; at: number; person: string }
  | { kind: "pack-opened"; at: number; person: string; hoggie: string; newPerson: boolean };

export type SlackEcho = { kind: "thread-reply"; at: number; person: string; message: string; packed: boolean; personIsNew: boolean } | null;

export type Album = {
  me: { name: string; face: Face; key: string };
  level: Level;
  people: Person[];
  collected: number;
  teams: Team[];
  hoggies: Hoggie[];
  hoggiesFound: number;
  packs: Pack[];
  journey: JourneyStep[];
  milestones: Milestone[];
  board: BoardRow[];
  moments: Moment[];
  lastSlack: SlackEcho;
  lastOpening: PackOpening | null;
};

export type Give = { kind: "packed"; pack: Pack; personIsNew: boolean } | { kind: "already-this-week"; person: string };

export type AlbumActions = {
  giveThoughtfulKudos(person: string, message?: string): Give;
  hug(person: string): void;
  openPack(id: string): PackOpening | null;
  forgetOpening(): void;
  reset(): void;
};

const now = Date.parse("2026-10-18T10:00:00Z");

const day = 86_400_000;

const me = { name: "Sam Example", face: { kind: "initials", initials: "SE" } as Face, key: "k:me" };

const kindWords = [
  "Thanks for pairing on the release checklist, it saved us a whole afternoon.",
  "Your write-up of the incident made it so easy to follow what happened and why.",
  "You jumped into my ask thread at 7pm and unblocked the whole launch. Thank you.",
  "The demo today was brilliant, the way you explained the data model clicked for everyone.",
  "Thank you for reviewing my first PR so kindly, I learned a lot from your comments.",
  "You stayed calm through the migration and kept everyone in the loop. Much appreciated.",
  "Your onboarding doc is the reason I shipped in my first week.",
  "Thanks for covering support on Friday so I could make it to my kid's play.",
];

function hashOf(text: string) {
  return [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
}

function statsFor(key: string, collectedAt: number | null): PersonStats {
  if (collectedAt === null) return { firstThankedAt: null, kudosGiven: 0, kudosReceived: hashOf(key) % 3, hugsGiven: hashOf(key) % 4, hugsReceived: hashOf(key + "r") % 3, bestMessage: null };
  const n = hashOf(key);
  return { firstThankedAt: collectedAt, kudosGiven: 1 + (n % 6), kudosReceived: n % 5, hugsGiven: 2 + (n % 11), hugsReceived: 1 + ((n * 7) % 9), bestMessage: kindWords[n % kindWords.length]! };
}

function peopleFromTeams(): Person[] {
  const collectedAt = new Map(teamStickers.map(({ key, firstAt }) => [key, firstAt]));
  const byKey = new Map<string, Person>();
  for (const page of teamPages.filter(({ listed }) => listed)) {
    for (const person of page.people) {
      const known = byKey.get(person.key);
      if (known !== undefined) {
        known.teams.push(page.team);
        known.lead ||= person.lead;
        continue;
      }
      const at = collectedAt.get(person.key) ?? null;
      byKey.set(person.key, { key: person.key, name: person.name, face: person.face, role: person.role, teams: [page.team], lead: person.lead, collectedAt: at, stats: statsFor(person.key, at), packedThisWeek: false });
    }
  }
  return [...byKey.values()];
}

function teamsOf(people: Person[]): Team[] {
  return teamPages
    .filter(({ listed }) => listed)
    .map((page) => {
      const members = people.filter(({ teams }) => teams.includes(page.team));
      const held = members.filter(({ collectedAt }) => collectedAt !== null);
      const complete = members.length > 0 && held.length === members.length;
      return { team: page.team, name: page.name, art: page.art, mine: page.mine, people: members.map(({ key }) => key), leads: page.leads, held: held.length, total: members.length, complete, completedAt: complete ? Math.max(...held.map(({ collectedAt }) => collectedAt!)) : null };
    });
}

const startingHoggies: Hoggie[] = catalogue.hoggies.map(({ hoggie, name, rarity }, index) => {
  const found = index % 4 === 0 || index % 7 === 0;
  return { hoggie, name, rarity, count: found ? 1 + (index % 3) : 0, firstAt: found ? now - (index % 40) * day : null };
});

const rollOrder: Rarity[] = ["uncommon", "common", "rare", "common", "epic", "common", "uncommon", "legendary", "common", "rare"];

function rollHoggie(hoggies: Hoggie[], rolls: number): Hoggie {
  const rarity = rollOrder[rolls % rollOrder.length]!;
  const ofRarity = hoggies.filter((hoggie) => hoggie.rarity === rarity);
  const missing = ofRarity.filter(({ count }) => count === 0);
  const pool = rolls % 3 === 2 || missing.length === 0 ? ofRarity : missing;
  return pool[(rolls * 7) % pool.length]!;
}

const xpPerThoughtful = 10;

const xpPerHug = 1;

const xpPerPack = 15;

export function levelAt(xp: number): Level {
  const level = levelOf(xp);
  const startsAt = xpToReach(level);
  const nextAt = xpToReach(level + 1);
  return { level, xp, startsAt, nextAt, toNext: nextAt - xp, progress: (xp - startsAt) / (nextAt - startsAt) };
}

const tiers = ["bronze", "silver", "gold", "diamond"] as const;

function milestoneOf(id: string, name: string, counts: string, emblem: LadderId, count: number, steps: [number, number, number, number], names: [string, string, string, string]): Milestone {
  return { id, name, counts, emblem, count, tiers: tiers.map((tier, index) => ({ tier, at: steps[index]!, name: names[index]!, earnedAt: count >= steps[index]! ? now - (4 - index) * 9 * day : null })) };
}

function milestonesOf(people: Person[], teams: Team[], hoggies: Hoggie[], thoughtful: number): Milestone[] {
  const collected = people.filter(({ collectedAt }) => collectedAt !== null).length;
  const completed = teams.filter(({ complete }) => complete).length;
  const found = hoggies.filter(({ count }) => count > 0).length;
  const teamsTouched = teams.filter(({ held }) => held > 0).length;
  return [
    milestoneOf("people", "Faces in the album", "people collected", "connections", collected, [1, 10, 25, 50], ["First face", "Familiar faces", "Full of friends", "Everyone's album"]),
    milestoneOf("teams", "Full pages", "team pages completed", "team-spirit", completed, [1, 3, 5, 7], ["First full page", "Three teams strong", "Most of the company", "Every page"]),
    milestoneOf("reach", "Across the company", "teams you've thanked someone in", "old-friends", teamsTouched, [2, 4, 6, 7], ["Next door", "Bridge builder", "Well travelled", "All hands"]),
    milestoneOf("hoggies", "Hoggie hunter", "hoggies found", "recognition", found, [10, 40, 100, 151], ["Curious", "Collector", "Hoarder", "Completionist"]),
    milestoneOf("thoughtful", "Kind words", "thoughtful kudos given", "generosity", thoughtful, [1, 25, 100, 500], ["First thank-you", "Generous soul", "Heart of the team", "Patron of praise"]),
  ];
}

const boardNames = ["Ada Lindqvist", "Bo Okafor", "Cleo Marchetti", "Dev Rao", "Eli Brandt", "Fay Mensah", "Gus Park"];

function boardOf(thoughtfulThisWeek: number): BoardRow[] {
  const others = boardNames.map((name, index) => ({ name, face: { kind: "initials", initials: name.split(" ").map((word) => word[0]).join("") } as Face, thoughtful: 9 - index, you: false }));
  const rows = [...others, { name: me.name, face: me.face, thoughtful: thoughtfulThisWeek, you: true }].toSorted((first, second) => second.thoughtful - first.thoughtful || Number(second.you) - Number(first.you));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

type Inner = { xp: number; people: Person[]; hoggies: Hoggie[]; packs: Pack[]; rolls: number; thoughtful: number; thoughtfulThisWeek: number; hugged: boolean; openedAPack: boolean; moments: Moment[]; lastSlack: SlackEcho; lastOpening: PackOpening | null };

function initial(): Inner {
  const people = peopleFromTeams();
  const noor = people.find(({ key }) => key === "k:noor")!;
  const mei = people.find(({ key }) => key === "k:mei")!;
  const omar = people.find(({ key }) => key === "k:omar")!;
  const hana = people.find(({ key }) => key === "k:hana")!;
  noor.packedThisWeek = true;
  hana.collectedAt = now - 6 * day;
  hana.stats = statsFor(hana.key, hana.collectedAt);
  const tomas = people.find(({ key }) => key === "k:tomas")!;
  tomas.collectedAt = null;
  tomas.stats = statsFor(tomas.key, null);
  return {
    xp: 1180,
    people,
    hoggies: startingHoggies,
    packs: [
      { id: "pack:omar:1", person: omar.key, earnedAt: now - 3 * 3_600_000, message: kindWords[2]! },
      { id: "pack:mei:1", person: mei.key, earnedAt: now - 26 * 3_600_000, message: kindWords[3]! },
    ],
    rolls: 0,
    thoughtful: 31,
    thoughtfulThisWeek: 4,
    hugged: true,
    openedAPack: true,
    moments: [
      { kind: "thoughtful-given", at: now - 3 * 3_600_000, person: omar.key, message: kindWords[2]!, packed: true },
      { kind: "hug-received", at: now - 5 * 3_600_000, person: "k:priya" },
      { kind: "thoughtful-received", at: now - 20 * 3_600_000, person: "k:felix", message: kindWords[4]! },
      { kind: "thoughtful-given", at: now - 26 * 3_600_000, person: mei.key, message: kindWords[3]!, packed: true },
      { kind: "thoughtful-given", at: now - 2 * day, person: noor.key, message: kindWords[0]!, packed: true },
      { kind: "hug-given", at: now - 2 * day, person: "k:sofia" },
    ],
    lastSlack: null,
    lastOpening: null,
  };
}

function albumOf(inner: Inner): Album {
  const teams = teamsOf(inner.people);
  return {
    me,
    level: levelAt(inner.xp),
    people: inner.people,
    collected: inner.people.filter(({ collectedAt }) => collectedAt !== null).length,
    teams,
    hoggies: inner.hoggies,
    hoggiesFound: inner.hoggies.filter(({ count }) => count > 0).length,
    packs: inner.packs,
    journey: [
      { step: "hug", goal: "React to a teammate's message with the kudos emoji.", done: inner.hugged },
      { step: "thoughtful", goal: "Give a thoughtful kudos: thank someone and say why.", done: inner.thoughtful > 0 },
      { step: "first-pack", goal: "Open your first pack.", done: inner.openedAPack },
      { step: "complete-team", goal: "Complete a team page.", done: teams.some(({ complete }) => complete) },
    ],
    milestones: milestonesOf(inner.people, teams, inner.hoggies, inner.thoughtful),
    board: boardOf(inner.thoughtfulThisWeek),
    moments: inner.moments,
    lastSlack: inner.lastSlack,
    lastOpening: inner.lastOpening,
  };
}

const AlbumContext = createContext<{ album: Album; actions: AlbumActions } | null>(null);

export function AlbumProvider({ children }: { children: ReactNode }) {
  const [inner, setInner] = useState(initial);

  const giveThoughtfulKudos = useCallback(
    (key: string, message?: string): Give => {
      const person = inner.people.find((entry) => entry.key === key);
      if (person === undefined) return { kind: "already-this-week", person: key };
      const words = message ?? kindWords[(hashOf(key) + inner.thoughtful) % kindWords.length]!;
      const base = { ...inner, xp: inner.xp + xpPerThoughtful, thoughtful: inner.thoughtful + 1, thoughtfulThisWeek: inner.thoughtfulThisWeek + 1 };
      const personIsNew = person.collectedAt === null && !inner.packs.some((pack) => pack.person === key);
      if (person.packedThisWeek) {
        setInner({ ...base, moments: [{ kind: "thoughtful-given", at: Date.now(), person: key, message: words, packed: false }, ...inner.moments], lastSlack: { kind: "thread-reply", at: Date.now(), person: key, message: words, packed: false, personIsNew: false } });
        return { kind: "already-this-week", person: key };
      }
      const pack: Pack = { id: `pack:${key}:${inner.thoughtful + 1}`, person: key, earnedAt: Date.now(), message: words };
      const people = inner.people.map((entry) => (entry.key === key ? { ...entry, packedThisWeek: true, stats: { ...entry.stats, kudosGiven: entry.stats.kudosGiven + 1, bestMessage: entry.stats.bestMessage ?? words } } : entry));
      setInner({ ...base, people, packs: [...inner.packs, pack], moments: [{ kind: "thoughtful-given", at: Date.now(), person: key, message: words, packed: true }, ...inner.moments], lastSlack: { kind: "thread-reply", at: Date.now(), person: key, message: words, packed: true, personIsNew } });
      return { kind: "packed", pack, personIsNew };
    },
    [inner],
  );

  const hug = useCallback((key: string) => {
    setInner((current) => ({ ...current, xp: current.xp + xpPerHug, hugged: true, people: current.people.map((entry) => (entry.key === key ? { ...entry, stats: { ...entry.stats, hugsGiven: entry.stats.hugsGiven + 1 } } : entry)), moments: [{ kind: "hug-given", at: Date.now(), person: key }, ...current.moments] }));
  }, []);

  const openPack = useCallback(
    (id: string): PackOpening | null => {
      const pack = inner.packs.find((entry) => entry.id === id);
      const person = pack === undefined ? undefined : inner.people.find(({ key }) => key === pack.person);
      if (pack === undefined || person === undefined) return null;
      const isNew = person.collectedAt === null;
      const rolled = rollHoggie(inner.hoggies, inner.rolls);
      const at = Date.now();
      const people = inner.people.map((entry) => (entry.key === person.key ? { ...entry, collectedAt: entry.collectedAt ?? at, stats: { ...entry.stats, kudosGiven: Math.max(1, entry.stats.kudosGiven), firstThankedAt: entry.stats.firstThankedAt ?? pack.earnedAt, bestMessage: entry.stats.bestMessage ?? pack.message } } : entry));
      const hoggies = inner.hoggies.map((entry) => (entry.hoggie === rolled.hoggie ? { ...entry, count: entry.count + 1, firstAt: entry.firstAt ?? at } : entry));
      const xpAfter = inner.xp + xpPerPack;
      const teamsBefore = teamsOf(inner.people);
      const teamsAfter = teamsOf(people);
      const opening: PackOpening = {
        pack,
        person: { key: person.key, name: person.name, face: person.face, isNew, teams: person.teams },
        hoggie: { hoggie: rolled.hoggie, name: rolled.name, rarity: rolled.rarity, isNew: rolled.count === 0, copy: rolled.count + 1 },
        xp: { gained: xpPerPack, before: inner.xp, after: xpAfter, levelBefore: levelOf(inner.xp), levelAfter: levelOf(xpAfter) },
        teams: teamsAfter.filter(({ team }) => person.teams.includes(team)).map((team) => ({ team: team.team, name: team.name, held: team.held, total: team.total, justCompleted: team.complete && !teamsBefore.find(({ team: before }) => before === team.team)!.complete })),
      };
      setInner({ ...inner, xp: xpAfter, people, hoggies, rolls: inner.rolls + 1, openedAPack: true, packs: inner.packs.filter((entry) => entry.id !== id), moments: [{ kind: "pack-opened", at, person: person.key, hoggie: rolled.hoggie, newPerson: isNew }, ...inner.moments], lastOpening: opening });
      return opening;
    },
    [inner],
  );

  const forgetOpening = useCallback(() => setInner((current) => ({ ...current, lastOpening: null })), []);

  const reset = useCallback(() => setInner(initial()), []);

  const value = useMemo(() => ({ album: albumOf(inner), actions: { giveThoughtfulKudos, hug, openPack, forgetOpening, reset } }), [inner, giveThoughtfulKudos, hug, openPack, forgetOpening, reset]);
  return <AlbumContext.Provider value={value}>{children}</AlbumContext.Provider>;
}

export function useAlbum() {
  const value = useContext(AlbumContext);
  if (value === null) throw new Error("useAlbum needs an AlbumProvider.");
  return value;
}

export function personOf(album: Album, key: string) {
  return album.people.find((person) => person.key === key);
}

export const rarityWeights = rarities;
