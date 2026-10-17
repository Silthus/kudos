import { companyFaceOfProfile } from "../companyProfiles/faces";
import { teamPagesShownTo } from "../companyProfiles/flag";
import { crateStoreOf, waitingCratesOf, type CrateStore } from "../hoggies/boughtCrates";
import { collectionOf, type HeldCrest, type HeldHoggie, type RarityShare } from "../hoggies/collection";
import { crateStoreShownTo, crestsShownTo, hoggiesShownTo, packsShownTo } from "../hoggies/flag";
import { waitingPacksOf, type WaitingPacks } from "../hoggies/waitingPacks";
import { groupsShownTo } from "../groups/groups";
import type { QueryCtx } from "../_generated/server";
import { albumsOf, type Album } from "../stickers/albums";
import { completionsOf } from "../stickers/completionRecords";
import { stickersShownTo, teamSpiritShownTo } from "../stickers/flag";
import { stickersNewestFirst, type HeldSticker } from "../stickers/records";
import { teamPagesOf, type CollectedCrest, type PageCrest, type PersonOnPage, type TeamPageOf } from "../stickers/teamPages";
import { memberRowsIn, peopleOf, type MemberId, type MemberRows, type People } from "../workspace/directory";
import { bookPageOf } from "./book";
import { noLaunchWaitsFor } from "./flag";
import { companyTeammateOf, teammateOf, type Face } from "./faces";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import type { PageWaits } from "./unlockPath";

export type CollectionHoggie = HeldHoggie & { seen: string | null };

export type CollectionCrest = HeldCrest & { seen: string | null };

export type Teammate = { name: string; face: Face; former: boolean };

export type Sticker = Teammate & { key: string; firstAt: number; seen: string };

export type AlbumPerson = Teammate & { key: string; held: boolean };

export type GroupAlbum = Omit<Album, "people"> & { people: AlbumPerson[] };

export type TeamPerson = { key: string; name: string; role: string | null; face: Face; lead: boolean; held: boolean; heldAt: number | null };

export type TeamPage = Omit<TeamPageOf, "people" | "crest" | "completion"> & { people: TeamPerson[]; crest: { collectedAt: number; seen: string } | null; completion?: { at: number; seen: string } | null };

export type StickerBook = { stickers?: Sticker[]; albums?: GroupAlbum[]; teams?: TeamPage[] };

export type BoughtCrates = { bought?: string[]; crateStore?: CrateStore | null };

export type PackStack = Partial<WaitingPacks>;

export type CollectionAnswer = { kind: "not-found" } | PageWaits | ({ kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number; crests?: CollectionCrest[] } & BoughtCrates & PackStack & StickerBook);

export const getCollection = memberQuery(async (ctx, me): Promise<CollectionAnswer> => {
  if (!(await hoggiesShownTo(ctx, me.member))) return { kind: "not-found" };
  const page = await bookPageOf(ctx, me);
  if (page.kind !== "open") return page;
  const { rarities, hoggies, owned, total, crests } = await collectionOf(ctx, me.member, { crests: await crestsShownTo(ctx, me.member) });
  const collection = { kind: "collection" as const, rarities, hoggies: await Promise.all(hoggies.map((hoggie) => seenBy(me.member, hoggie))), owned, total };
  const teamPages = (await teamPagesShownTo(ctx, me.member)) ? { crests: collectedCrestsIn(crests ?? []) } : null;
  const withCrests = crests === undefined || teamPages !== null ? collection : { ...collection, crests: await Promise.all(crests.map((crest) => crestSeenBy(me.member, crest))) };
  return { ...withCrests, ...(await boughtCratesOf(ctx, me.member)), ...(await packStackOf(ctx, me)), ...(await stickerBookOf(ctx, me, teamPages)) };
});

type TeamPagesShown = { crests: CollectedCrest[] };

async function stickerBookOf(ctx: QueryCtx, me: VerifiedMember, teamPages: TeamPagesShown | null): Promise<StickerBook> {
  if (!(await stickersShownTo(ctx, me.member))) return {};
  const members = await memberRowsIn(ctx, me.workspace);
  const people = peopleOf(members);
  const held = await stickersNewestFirst(ctx, me.member);
  const keyOf = stickerKeysOf(me.member);
  const stickers = await Promise.all(held.map((sticker) => stickerOf(me.member, people, keyOf, sticker)));
  if (teamPages !== null) return { stickers, teams: await teamsOf(ctx, me, { members, people, keyOf, held }, teamPages) };
  if (!(await groupsShownTo(ctx, me.member))) return { stickers };
  const albums = await albumsOf(ctx, me, people, held);
  return { stickers, albums: await Promise.all(albums.map((album) => groupAlbumOf(people, keyOf, album))) };
}

type StickerKeys = (person: MemberId) => Promise<string>;

function stickerKeysOf(member: MemberId): StickerKeys {
  const keys = new Map<MemberId, Promise<string>>();
  return (person) => {
    const key = keys.get(person) ?? seenKeyOf(member, `sticker:${person}`);
    keys.set(person, key);
    return key;
  };
}

async function stickerOf(member: MemberId, people: People, keyOf: StickerKeys, { person, firstAt }: HeldSticker): Promise<Sticker> {
  return { ...teammateIn(people, person), key: await keyOf(person), firstAt, seen: await seenKeyOf(member, `sticker:${person}:${firstAt}`) };
}

async function groupAlbumOf(people: People, keyOf: StickerKeys, { people: albumPeople, ...album }: Album): Promise<GroupAlbum> {
  const shown = await Promise.all(albumPeople.map(async ({ person, held }) => ({ ...teammateIn(people, person), key: await keyOf(person), held })));
  return { ...album, people: shown.toSorted((first, second) => first.name.localeCompare(second.name)) };
}

type Directory = { members: MemberRows; people: People; keyOf: StickerKeys; held: HeldSticker[] };

async function teamsOf(ctx: QueryCtx, me: VerifiedMember, { members, people, keyOf, held }: Directory, { crests }: TeamPagesShown): Promise<TeamPage[]> {
  const completions = (await teamSpiritShownTo(ctx, me.member)) ? await completionsOf(ctx, me.member) : undefined;
  const pages = await teamPagesOf(ctx, me, { members, stickers: held, crests, ...(completions !== undefined && { completions }) });
  return Promise.all(pages.map((page) => teamPageOf(me.member, people, keyOf, page)));
}

async function teamPageOf(member: MemberId, people: People, keyOf: StickerKeys, { people: onPage, crest, completion, ...page }: TeamPageOf): Promise<TeamPage> {
  return {
    ...page,
    people: await Promise.all(onPage.map((person) => teamPersonOf(people, keyOf, person))),
    crest: crest === null ? null : { collectedAt: crest.collectedAt, seen: await crestSeenKeyOf(member, page.team, crest) },
    ...(completion !== undefined && { completion: completion === null ? null : { at: completion.at, seen: await seenKeyOf(member, `page:${page.team}:${completion.at}`) } }),
  };
}

function crestSeenKeyOf(member: MemberId, team: string, { collectedAt, by }: PageCrest) {
  return seenKeyOf(member, by === "page" ? `team:${team}:${collectedAt}` : `crest:${team}:${collectedAt}`);
}

async function teamPersonOf(people: People, keyOf: StickerKeys, { person, profile, lead, held, heldAt }: PersonOnPage): Promise<TeamPerson> {
  const { name, picture } = people.get(person) ?? { name: undefined, picture: null };
  return { key: await keyOf(person), ...companyTeammateOf(name, picture, companyFaceOfProfile(profile)), role: profile.role ?? null, lead, held, heldAt };
}

function collectedCrestsIn(crests: HeldCrest[]): CollectedCrest[] {
  return crests.flatMap(({ crest, collectedAt }) => (collectedAt === null ? [] : [{ crest, collectedAt }]));
}

function teammateIn(people: People, person: MemberId): Teammate {
  const { name, picture, former } = people.get(person) ?? { name: undefined, picture: null, former: true };
  return { ...teammateOf(name, picture), former };
}

async function packStackOf(ctx: QueryCtx, me: VerifiedMember): Promise<PackStack> {
  if (!(await packsShownTo(ctx, me.member))) return {};
  return (await noLaunchWaitsFor(ctx, me)) ? waitingPacksOf(ctx, me.member) : { packs: [], morePacks: false };
}

async function boughtCratesOf(ctx: QueryCtx, member: MemberId): Promise<BoughtCrates> {
  const storeShown = await crateStoreShownTo(ctx, member);
  const bought = await waitingCratesOf(ctx, member);
  return { ...((storeShown || bought.length > 0) && { bought }), ...(storeShown && { crateStore: await crateStoreOf(ctx, member) }) };
}

async function seenBy(member: MemberId, hoggie: HeldHoggie): Promise<CollectionHoggie> {
  return { ...hoggie, seen: hoggie.firstAt === null ? null : await seenKeyOf(member, `hoggie:${hoggie.hoggie}:${hoggie.firstAt}`) };
}

async function crestSeenBy(member: MemberId, crest: HeldCrest): Promise<CollectionCrest> {
  return { ...crest, seen: crest.collectedAt === null ? null : await seenKeyOf(member, `crest:${crest.crest}:${crest.collectedAt}`) };
}
