import { crateStoreOf, waitingCratesOf, type CrateStore } from "../hoggies/boughtCrates";
import { collectionOf, type HeldCrest, type HeldHoggie, type RarityShare } from "../hoggies/collection";
import { crateStoreShownTo, crestsShownTo, hoggiesShownTo } from "../hoggies/flag";
import { groupsShownTo, type GroupId } from "../groups/groups";
import type { QueryCtx } from "../_generated/server";
import { albumsOf, isFilled, type Album } from "../stickers/albums";
import { completionsOf, type RecordedCompletion } from "../stickers/completions";
import { stickersShownTo, teamSpiritShownTo } from "../stickers/flag";
import { stickersNewestFirst, type HeldSticker } from "../stickers/records";
import { peopleIn, type MemberId, type People } from "../workspace/directory";
import { bookPageOf } from "./book";
import { teammateOf, type Face } from "./faces";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import type { PageWaits } from "./unlockPath";

export type CollectionHoggie = HeldHoggie & { seen: string | null };

export type CollectionCrest = HeldCrest & { seen: string | null };

export type Teammate = { name: string; face: Face; former: boolean };

export type Sticker = Teammate & { key: string; firstAt: number; seen: string };

export type AlbumPerson = Teammate & { key: string; held: boolean };

export type AlbumCompletion = { complete: boolean; completedAt: number | null; seen: string | null };

export type GroupAlbum = Omit<Album, "people"> & { people: AlbumPerson[] } & Partial<AlbumCompletion>;

export type StickerBook = { stickers?: Sticker[]; albums?: GroupAlbum[] };

export type BoughtCrates = { bought?: string[]; crateStore?: CrateStore | null };

export type CollectionAnswer = { kind: "not-found" } | PageWaits | ({ kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number; crests?: CollectionCrest[] } & BoughtCrates & StickerBook);

export const getCollection = memberQuery(async (ctx, me): Promise<CollectionAnswer> => {
  if (!(await hoggiesShownTo(ctx, me.member))) return { kind: "not-found" };
  const page = await bookPageOf(ctx, me);
  if (page.kind !== "open") return page;
  const { rarities, hoggies, owned, total, crests } = await collectionOf(ctx, me.member, { crests: await crestsShownTo(ctx, me.member) });
  const collection = { kind: "collection" as const, rarities, hoggies: await Promise.all(hoggies.map((hoggie) => seenBy(me.member, hoggie))), owned, total };
  const withCrests = crests === undefined ? collection : { ...collection, crests: await Promise.all(crests.map((crest) => crestSeenBy(me.member, crest))) };
  return { ...withCrests, ...(await boughtCratesOf(ctx, me.member)), ...(await stickerBookOf(ctx, me)) };
});

async function stickerBookOf(ctx: QueryCtx, me: VerifiedMember): Promise<StickerBook> {
  if (!(await stickersShownTo(ctx, me.member))) return {};
  const people = await peopleIn(ctx, me.workspace);
  const held = await stickersNewestFirst(ctx, me.member);
  const keyOf = stickerKeysOf(me.member);
  const stickers = await Promise.all(held.map((sticker) => stickerOf(me.member, people, keyOf, sticker)));
  if (!(await groupsShownTo(ctx, me.member))) return { stickers };
  const albums = await albumsOf(ctx, me, people, held);
  const recorded = await completionsShownTo(ctx, me.member);
  return { stickers, albums: await Promise.all(albums.map(async (album) => ({ ...(await groupAlbumOf(people, keyOf, album)), ...(recorded && (await completionOf(me.member, album, recorded))) }))) };
}

async function completionsShownTo(ctx: QueryCtx, member: MemberId): Promise<Map<GroupId, RecordedCompletion> | null> {
  return (await teamSpiritShownTo(ctx, member)) ? completionsOf(ctx, member) : null;
}

async function completionOf(member: MemberId, album: Album, recorded: Map<GroupId, RecordedCompletion>): Promise<AlbumCompletion> {
  const completedAt = recorded.get(album.group)?.completedAt ?? null;
  const seen = completedAt === null ? null : await seenKeyOf(member, `album:${album.group}:${completedAt}`);
  return { complete: completedAt !== null || isFilled(album), completedAt, seen };
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

function teammateIn(people: People, person: MemberId): Teammate {
  const { name, picture, former } = people.get(person) ?? { name: undefined, picture: null, former: true };
  return { ...teammateOf(name, picture), former };
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
