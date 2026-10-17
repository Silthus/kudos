import type { AlbumPerson, Collection, CollectionCrest, CollectionHoggie, CollectionTeamPage, CollectionTeamPerson, GroupAlbum, Sticker } from "../../collectionRead";
import type { CrestArt, Rarity } from "../../crates/drops";
import type { TeamArt } from "../../crates/TeamCrest";
import type { Face } from "../../shell";

export type SlotPicture = { kind: "hoggie"; art: CollectionHoggie["art"]; rarity: Rarity } | { kind: "face"; face: Face; former: boolean };

export type TeamSlot = { key: string; name: string; role: string | null; lead: boolean; held: boolean; heldAt: number | null; picture: SlotPicture };

export type TeamSource = "roster" | "group" | "team";

export type UnmatchedPerson = { name: string; role: string | null };

export type TeamPage = { slug: string; name: string; art: TeamArt; source: TeamSource; mine: boolean; listed: boolean; leads: string[]; unmatched: UnmatchedPerson[]; held: number; total: number; completedAt: number | null; complete: boolean; seen: string | null; slots: TeamSlot[] };

export type Counted = { collected: number; total: number };

export type TeamPages = { source: "today" | "team"; pages: TeamPage[]; crests: Counted | null; albums: Counted | null; people: Counted | null; stickers: Sticker[] | undefined };

export function teamPagesOf({ crests, albums, stickers, hoggies, teams }: Collection): TeamPages | null {
  if (teams !== undefined) return companyTeamPagesOf(teams, stickers);
  if (crests === undefined && albums === undefined && stickers === undefined) return null;
  const byHoggie = new Map(hoggies.map((hoggie) => [hoggie.hoggie, hoggie]));
  const crestPages = (crests ?? []).map((crest) => crestPageOf(crest, byHoggie));
  const albumPages = (albums ?? []).map(groupPageOf);
  return { source: "today", pages: [...crestPages, ...albumPages], crests: crests === undefined ? null : countedOf(crestPages), albums: albums === undefined ? null : countedOf(albumPages), people: null, stickers };
}

function companyTeamPagesOf(teams: CollectionTeamPage[], stickers: Sticker[] | undefined): TeamPages {
  const shown = teams.filter((team) => team.listed || team.crest !== null);
  const pages = [...shown.filter((team) => team.listed), ...shown.filter((team) => !team.listed)].map(companyTeamPageOf);
  return { source: "team", pages, crests: countedOf(pages), albums: null, people: peopleCountedOf(pages), stickers };
}

function countedOf(pages: TeamPage[]): Counted {
  return { collected: pages.filter(crestEarnedOn).length, total: pages.length };
}

function peopleCountedOf(pages: TeamPage[]): Counted {
  return pages.reduce((sum, page) => ({ collected: sum.collected + page.held, total: sum.total + page.total }), { collected: 0, total: 0 });
}

export function crestEarnedOn(page: TeamPage) {
  return page.complete || page.completedAt !== null;
}

export function teamsCountOf({ crests, albums }: TeamPages): { counted: Counted; of: "crests" | "albums" } {
  return crests === null ? { counted: albums ?? { collected: 0, total: 0 }, of: "albums" } : { counted: crests, of: "crests" };
}

function companyTeamPageOf(team: CollectionTeamPage): TeamPage {
  return {
    slug: team.team,
    name: team.name,
    art: team.art,
    source: "team",
    mine: team.mine,
    listed: team.listed,
    leads: team.leads,
    unmatched: team.unmatchedPeople,
    held: team.held,
    total: team.total,
    completedAt: team.crest?.collectedAt ?? null,
    complete: team.complete,
    seen: team.crest?.seen ?? null,
    slots: team.people.map(companyPersonSlotOf),
  };
}

function companyPersonSlotOf(person: CollectionTeamPerson): TeamSlot {
  return { key: person.key, name: person.name, role: person.role, lead: person.lead, held: person.held, heldAt: person.heldAt, picture: { kind: "face", face: person.face, former: false } };
}

function crestPageOf(crest: CollectionCrest, hoggies: ReadonlyMap<string, CollectionHoggie>): TeamPage {
  const slots = crest.roster.flatMap((hoggie) => hoggies.get(hoggie) ?? []).map(hoggieSlotOf);
  return { slug: crest.crest, name: crest.name, art: crest.art, source: "roster", mine: false, listed: true, leads: [], unmatched: [], held: crest.held, total: crest.roster.length, completedAt: crest.collectedAt, complete: crest.collectedAt !== null, seen: crest.seen, slots };
}

function hoggieSlotOf(hoggie: CollectionHoggie): TeamSlot {
  return { key: hoggie.hoggie, name: hoggie.name, role: null, lead: false, held: hoggie.firstAt !== null, heldAt: hoggie.firstAt, picture: { kind: "hoggie", art: hoggie.art, rarity: hoggie.rarity } };
}

export function groupSlugOf(group: string) {
  return `group:${group}`;
}

function groupPageOf(album: GroupAlbum): TeamPage {
  const complete = album.total > 0 && album.held === album.total;
  return { slug: groupSlugOf(album.group), name: album.name, art: null, source: "group", mine: album.mine, listed: true, leads: [], unmatched: [], held: album.held, total: album.total, completedAt: null, complete, seen: null, slots: album.people.map(personSlotOf) };
}

function personSlotOf(person: AlbumPerson): TeamSlot {
  return { key: person.key, name: person.name, role: null, lead: false, held: person.held, heldAt: null, picture: { kind: "face", face: person.face, former: person.former } };
}

export function teamPageNamed(pages: TeamPage[], slug: string) {
  return pages.find((page) => page.slug === slug);
}

export function firstStickerNumberOf(pages: TeamPage[], page: TeamPage) {
  return 1 + pages.slice(0, pages.indexOf(page)).reduce((sum, earlier) => sum + earlier.total, 0);
}

export function latestCrestArtOf(pages: TeamPage[]): { art: CrestArt; collected: boolean } | null {
  const crests = pages.filter((page): page is TeamPage & { art: CrestArt } => page.art?.kind === "crest");
  const latest = crests.filter(({ complete }) => complete).reduce<(TeamPage & { art: CrestArt }) | null>((best, page) => (best === null || (page.completedAt ?? 0) > (best.completedAt ?? 0) ? page : best), null);
  if (latest !== null) return { art: latest.art, collected: true };
  return crests[0] === undefined ? null : { art: crests[0].art, collected: false };
}

export function ownCrestOf(pages: TeamPage[]): TeamPage | undefined {
  return pages.find((page) => page.mine) ?? pages.find(crestEarnedOn) ?? pages[0];
}
