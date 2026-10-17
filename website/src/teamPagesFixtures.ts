import type { CollectionTeamPage, CollectionTeamPerson } from "./collectionRead";
import { stickers, teammateOf } from "./stickerBookFixtures";
import type { Face } from "./shell";

type MadeUpTeam = { team: string; name: string; art: CollectionTeamPage["art"]; mine?: boolean; listed?: boolean; leads: string[]; people: string[]; unmatched?: Array<{ name: string; role: string | null }>; crest?: { collectedAt: number; seen: string } | null };

const roles = ["Product Engineer", "Product Engineer", "Product Manager", "Designer", "Technical Writer", "Support Engineer", "Product Engineer"];

const at = (iso: string) => Date.parse(iso);

const drawnCrest = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M32 4 58 14v22c0 12-12 20-26 26C18 56 6 48 6 36V14z' fill='#8ad1c3'/><circle cx='32' cy='30' r='10' fill='#23251f'/></svg>")}`;

const strangerNames = ["Aisha Adeyemi", "Bruno Bergström", "Chiara Castillo", "Dmitri Dubois", "Esme Eriksen", "Farid Ferreira", "Greta Gallo", "Hugo Horvat", "Ines Iqbal", "Jamal Jansen", "Kenji Kimura", "Lotte Lindqvist", "Mateo Moreau", "Nadia Novak", "Oskar Okafor", "Pilar Petrova", "Quinn Adeyemi", "Rosa Bergström", "Sven Castillo", "Talia Dubois", "Umar Eriksen", "Vera Ferreira", "Wren Gallo", "Ximena Horvat", "Yusuf Iqbal", "Zoe Jansen", "Anil Kimura", "Bea Lindqvist", "Cato Moreau", "Dana Novak"];

const strangers = new Map(strangerNames.map((name, index) => [`k:stranger-${index}`, name]));

const heldAt = new Map(stickers.map(({ key, firstAt }) => [key, firstAt]));

const heldStrangers = new Map([
  ["k:stranger-0", at("2026-10-11T09:00:00Z")],
  ["k:stranger-1", at("2026-10-03T09:00:00Z")],
]);

const teams: readonly MadeUpTeam[] = [
  { team: "workflows", name: "Workflows", art: { kind: "crest", slug: "workflows" }, mine: true, leads: ["Noor Haddad"], people: ["k:noor", "k:felix", "k:priya", "k:hana", "k:omar"], unmatched: [{ name: "Quill Harper", role: "Product Engineer" }] },
  { team: "cloud-platform", name: "Cloud Platform", art: { kind: "crest", slug: "cloud-platform" }, mine: true, leads: ["Aisha Adeyemi"], people: [...strangers.keys()] },
  { team: "platform-features", name: "Platform Features", art: { kind: "crest", slug: "platform-features" }, leads: ["Mei Tanaka"], people: ["k:mei", "k:tomas", "k:felix"] },
  { team: "editorial", name: "Editorial", art: { kind: "crest", slug: "editorial" }, leads: ["Sofia Esposito", "Ivy Chen"], people: ["k:sofia", "k:ivy", "k:kai", "k:zara"], crest: { collectedAt: at("2026-09-20T09:00:00Z"), seen: "crest:editorial:1789894800000" } },
  { team: "support", name: "Support", art: { kind: "crest", slug: "support" }, leads: ["Leo Fischer"], people: ["k:leo", "k:amara", "k:ben"], unmatched: [{ name: "Rae Lindqvist", role: "Support Engineer" }, { name: "Sol Novak", role: null }] },
  { team: "hedgehog-labs", name: "Hedgehog Labs", art: { kind: "image", url: drawnCrest }, leads: [], people: ["k:diego", "k:lina"] },
  { team: "night-shift", name: "Night Shift", art: null, leads: ["Kai Nakamura"], people: ["k:kai", "k:elin"] },
  { team: "people-ops", name: "People & Ops", art: { kind: "crest", slug: "people-ops" }, listed: false, leads: [], people: [], crest: { collectedAt: at("2026-10-02T09:00:00Z"), seen: "crest:people-ops:1790931600000" } },
];

function faceOf(key: string): { name: string; face: Face } {
  const stranger = strangers.get(key);
  if (stranger !== undefined) return { name: stranger, face: { kind: "initials", initials: stranger.split(" ").map((word) => word[0]!).join("") } };
  const { name, face } = teammateOf(key);
  return { name, face };
}

function personOf(key: string, index: number, leads: string[]): CollectionTeamPerson {
  const { name, face } = faceOf(key);
  const since = heldAt.get(key) ?? heldStrangers.get(key) ?? null;
  return { key, name, role: roles[index % roles.length]!, face, lead: leads.includes(name), held: since !== null, heldAt: since };
}

function pageOf({ team, name, art, mine = false, listed = true, leads, people, unmatched = [], crest = null }: MadeUpTeam): CollectionTeamPage {
  const shown = people.map((key, index) => personOf(key, index, leads));
  const held = shown.filter((person) => person.held).length;
  return { team, name, art, mine, listed, leads, held, total: shown.length, unmatched: unmatched.length, complete: shown.length > 0 && held === shown.length, people: shown, unmatchedPeople: unmatched, crest };
}

function mineFirstThenByName(first: CollectionTeamPage, second: CollectionTeamPage) {
  return Number(second.mine) - Number(first.mine) || first.name.localeCompare(second.name);
}

export const teamPages: CollectionTeamPage[] = teams.map(pageOf).toSorted(mineFirstThenByName);
