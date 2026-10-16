import type { AlbumPerson, Collection, CollectionCrest, CollectionHoggie, GroupAlbum, Sticker } from "../../collectionRead";
import type { CrestArt, Rarity } from "../../crates/drops";
import type { Face } from "../../shell";

export type SlotPicture = { kind: "hoggie"; art: CollectionHoggie["art"]; rarity: Rarity } | { kind: "face"; face: Face; former: boolean };

export type TeamSlot = { key: string; name: string; held: boolean; heldAt: number | null; picture: SlotPicture };

export type TeamPage = { slug: string; name: string; art: CrestArt | null; mine: boolean; held: number; total: number; completedAt: number | null; complete: boolean; seen: string | null; slots: TeamSlot[] };

export type TeamPages = { pages: TeamPage[]; crests: { collected: number; total: number }; stickers: Sticker[] | undefined };

export function teamPagesOf({ crests, albums, stickers, hoggies }: Collection): TeamPages | null {
  if (crests === undefined && albums === undefined && stickers === undefined) return null;
  const byHoggie = new Map(hoggies.map((hoggie) => [hoggie.hoggie, hoggie]));
  const pages = [...(crests ?? []).map((crest) => crestPageOf(crest, byHoggie)), ...(albums ?? []).map(groupPageOf)];
  return { pages, crests: crestCountOf(pages, crests !== undefined), stickers };
}

function crestCountOf(pages: TeamPage[], withCrests: boolean) {
  const counted = withCrests ? pages.filter(({ art }) => art !== null) : pages;
  return { collected: counted.filter(({ complete }) => complete).length, total: counted.length };
}

function crestPageOf(crest: CollectionCrest, hoggies: ReadonlyMap<string, CollectionHoggie>): TeamPage {
  const slots = crest.roster.flatMap((hoggie) => hoggies.get(hoggie) ?? []).map(hoggieSlotOf);
  return { slug: crest.crest, name: crest.name, art: crest.art, mine: false, held: crest.held, total: crest.roster.length, completedAt: crest.collectedAt, complete: crest.collectedAt !== null, seen: crest.seen, slots };
}

function hoggieSlotOf(hoggie: CollectionHoggie): TeamSlot {
  return { key: hoggie.hoggie, name: hoggie.name, held: hoggie.firstAt !== null, heldAt: hoggie.firstAt, picture: { kind: "hoggie", art: hoggie.art, rarity: hoggie.rarity } };
}

export function groupSlugOf(group: string) {
  return `group:${group}`;
}

function groupPageOf(album: GroupAlbum): TeamPage {
  const complete = album.total > 0 && album.held === album.total;
  return { slug: groupSlugOf(album.group), name: album.name, art: null, mine: album.mine, held: album.held, total: album.total, completedAt: null, complete, seen: null, slots: album.people.map(personSlotOf) };
}

function personSlotOf(person: AlbumPerson): TeamSlot {
  return { key: person.key, name: person.name, held: person.held, heldAt: null, picture: { kind: "face", face: person.face, former: person.former } };
}

export function teamPageNamed(pages: TeamPage[], slug: string) {
  return pages.find((page) => page.slug === slug);
}

export function firstStickerNumberOf(pages: TeamPage[], page: TeamPage) {
  return 1 + pages.slice(0, pages.indexOf(page)).reduce((sum, earlier) => sum + earlier.total, 0);
}

export function latestCrestArtOf(pages: TeamPage[]): { art: CrestArt; collected: boolean } | null {
  const crests = pages.filter((page): page is TeamPage & { art: CrestArt } => page.art !== null);
  const latest = crests.filter(({ complete }) => complete).reduce<(TeamPage & { art: CrestArt }) | null>((best, page) => (best === null || (page.completedAt ?? 0) > (best.completedAt ?? 0) ? page : best), null);
  if (latest !== null) return { art: latest.art, collected: true };
  return crests[0] === undefined ? null : { art: crests[0].art, collected: false };
}
