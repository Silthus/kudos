import { useCallback, useEffect, useMemo, useState } from "react";
import type { Collection } from "../../collectionRead";
import type { Drop } from "../../crates/drops";
import { boughtCrateOf, type BoughtCrate } from "../../crates/readyCrates";
import { PageTitle } from "../../PageTitle";
import type { LadderCard } from "../../shell";
import { useFreshKeys } from "../useFreshKeys";
import { BookLanding } from "./BookLanding";
import { chapterHref, chapterKeyOf, sectionOf, useChapter, type Chapter } from "./chapters";
import { Cover } from "./Cover";
import { HoggieLanding } from "./HoggieLanding";
import { HoggiesChapter } from "./HoggiesChapter";
import { LootReveal } from "./LootReveal";
import { packsFor, type Pack } from "./packs";
import { PackSession } from "./PackSession";
import { goTo, isPrototypeShell, usePrototypeParams } from "./prototype";
import { PrototypeBar, type MomentTrigger } from "./PrototypeBar";
import { SpinReveal } from "./SpinReveal";
import { StickerMoment } from "./StickerMoment";
import { albumsWith, personNamed, type TeamAlbum } from "./teamFixtures";
import { TeamSpread, TeamsChapter } from "./TeamsChapter";
import { VariantShelf } from "./VariantShelf";
import { VariantSpread } from "./VariantSpread";
import "./book.css";

type CollectionBookProps = { collection: Collection; ladders: LadderCard[]; timeZone: string; coins: number | null; fallback?: Chapter };

type Moment = { kind: "session"; startAt: number } | { kind: "single"; pack: Pack } | { kind: "landing"; opened: Pack[] } | { kind: "single-landing"; drop: Drop } | { kind: "sticker"; key: string; team: string };

export function CollectionBook({ collection: given, ladders, timeZone, coins, fallback }: CollectionBookProps) {
  const chapter = useChapter(fallback);
  const { structure, crate } = usePrototypeParams();
  const [alsoHeld, setAlsoHeld] = useState<ReadonlyMap<string, number>>(new Map());
  const [found, setFound] = useState<ReadonlyMap<string, number>>(new Map());
  const [packs, setPacks] = useState<Pack[]>(() => packsFor(4));
  const [moment, setMoment] = useState<Moment>();
  const albums = useMemo(() => albumsWith(alsoHeld), [alsoHeld]);
  const collection = useMemo(() => withFound(given, found, packs.length), [given, found, packs.length]);
  const fresh = useFreshKeys([...collection.hoggies, ...(collection.crests ?? []), ...(collection.stickers ?? []), ...albums].flatMap(({ seen }) => seen ?? []));
  useScrollToTopOn(chapterKeyOf(chapter));

  const pick = useCallback(
    (at: number) => {
      const pack = packs[at];
      if (pack === undefined) return;
      setMoment(crate === "pack" ? { kind: "session", startAt: at } : { kind: "single", pack });
    },
    [packs, crate],
  );
  const openCrate = useCallback((bought: BoughtCrate) => pick(Math.min(bought.target.n - 1, packs.length - 1)), [pick, packs.length]);
  const finishSession = useCallback((opened: Pack[]) => setMoment(opened.length === 0 ? undefined : { kind: "landing", opened }), []);
  const landed = useCallback((pack: Pack) => {
    setFound((before) => new Map([...before, [pack.drop.hoggie, Date.now()]]));
    setPacks((before) => before.filter((other) => other.n !== pack.n));
  }, []);
  const landSingle = useCallback((pack: Pack) => {
    goTo(`#hoggies/${pack.drop.rarity}`);
    setMoment({ kind: "single-landing", drop: pack.drop });
    landed(pack);
  }, [landed]);
  const stick = useCallback((key: string, team: string) => {
    goTo(`#teams/${team}`);
    setTimeout(() => setMoment({ kind: "sticker", key, team }), 150);
  }, []);
  const stuck = useCallback((key: string) => setAlsoHeld((before) => new Map([...before, [key, Date.now()]])), []);
  const done = useCallback(() => setMoment(undefined), []);

  const triggers = useMemo<MomentTrigger[]>(() => {
    const missingOn = (album: TeamAlbum) => album.people.find((person) => !person.held);
    const mine = albums.filter((album) => album.mine);
    const partial = mine.find((album) => album.people.filter((person) => !person.held).length > 1) ?? mine.find((album) => missingOn(album) !== undefined);
    const nearlyDone = mine.find((album) => album.people.filter((person) => !person.held).length === 1);
    return [
      ...(packs.length > 0 ? [{ label: "Open the packs", run: () => pick(0) }] : []),
      ...(partial && missingOn(partial) ? [{ label: `Collect a sticker (${partial.name})`, run: () => stick(missingOn(partial)!.key, partial.team) }] : []),
      ...(nearlyDone && missingOn(nearlyDone) ? [{ label: `Complete a team (${nearlyDone.name})`, run: () => stick(missingOn(nearlyDone)!.key, nearlyDone.team) }] : []),
    ];
  }, [albums, packs.length, pick, stick]);

  const stickerPerson = moment?.kind === "sticker" ? personNamed(albums, moment.key) : undefined;
  const stickerAlbum = moment?.kind === "sticker" ? albums.find((album) => album.team === moment.team) : undefined;
  const Single = crate === "spin" ? SpinReveal : LootReveal;

  return (
    <>
      {structure === "a" && <StructureA collection={collection} albums={albums} chapter={chapter} fresh={fresh} timeZone={timeZone} coins={coins} onOpen={openCrate} />}
      {structure === "b" && <VariantSpread collection={collection} albums={albums} ladders={ladders} chapter={chapter} fresh={fresh} timeZone={timeZone} packs={packs} onPick={pick} />}
      {structure === "c" && <VariantShelf collection={collection} albums={albums} chapter={chapter} fresh={fresh} timeZone={timeZone} coins={coins} onOpen={openCrate} />}
      {moment?.kind === "session" && <PackSession packs={packs} startAt={moment.startAt} onFinish={finishSession} />}
      {moment?.kind === "single" && <Single label={`Crate ${moment.pack.n} · a crate you bought`} drop={moment.pack.drop} othersReady={packs.length - 1} onClose={() => landSingle(moment.pack)} onNext={() => landSingle(moment.pack)} />}
      {moment?.kind === "landing" && <BookLanding opened={moment.opened} onLanded={landed} onDone={done} />}
      {moment?.kind === "single-landing" && <HoggieLanding drop={moment.drop} onDone={done} />}
      {moment?.kind === "sticker" && stickerPerson !== undefined && stickerAlbum !== undefined && <StickerMoment key={moment.key} person={stickerPerson} album={stickerAlbum} completes={stickerAlbum.people.filter((person) => !person.held).length === 1} onStuck={() => stuck(moment.key)} onDone={done} />}
      {isPrototypeShell && <PrototypeBar structure={structure} crate={crate} moments={triggers} />}
    </>
  );
}

type PageProps = { collection: Collection; albums: TeamAlbum[]; chapter: Chapter; fresh: ReadonlySet<string>; timeZone: string; coins: number | null; onOpen: (crate: BoughtCrate) => void };

function StructureA({ collection, albums, chapter, fresh, timeZone, coins, onOpen }: PageProps) {
  return (
    <>
      <Header chapter={chapter} collection={collection} albums={albums} />
      <ChapterTabs chapter={chapter} collection={collection} albums={albums} />
      {(chapter.kind === "cover" || chapter.kind === "achievements") && <Cover collection={collection} albums={albums} fresh={fresh} timeZone={timeZone} coins={coins} onOpen={onOpen} />}
      {chapter.kind === "hoggies" && <HoggiesChapter collection={collection} rarity={chapter.rarity} fresh={fresh} timeZone={timeZone} />}
      {chapter.kind === "teams" && <TeamsChapter albums={albums} fresh={fresh} timeZone={timeZone} />}
      {chapter.kind === "team" && <TeamSpread albums={albums} team={chapter.team} timeZone={timeZone} />}
    </>
  );
}

function withFound(collection: Collection, found: ReadonlyMap<string, number>, waiting: number): Collection {
  const bought = Array.from({ length: waiting }, (_, at) => `bought:${at + 1}`);
  const hoggies = collection.hoggies.map((hoggie) => {
    const at = found.get(hoggie.hoggie);
    if (at === undefined) return hoggie;
    const firstAt = hoggie.firstAt ?? at;
    return { ...hoggie, count: hoggie.count + 1, firstAt, seen: `hoggie:${hoggie.hoggie}:${firstAt}` };
  });
  const owned = hoggies.filter((hoggie) => hoggie.count > 0).length;
  const rarities = collection.rarities.map((share) => ({ ...share, owned: hoggies.filter((hoggie) => hoggie.rarity === share.rarity && hoggie.count > 0).length }));
  return { ...collection, hoggies, owned, rarities, bought, crateStore: collection.crateStore ?? { price: 50, next: waiting + 1 } };
}

function useScrollToTopOn(key: string) {
  const [last, setLast] = useState(key);
  useEffect(() => {
    if (last === key) return;
    setLast(key);
    window.scrollTo({ top: 0 });
  }, [key, last]);
}

const titles: Record<ReturnType<typeof sectionOf>, { label: string; title: string; lede: string }> = {
  cover: { label: "Book", title: "Collection", lede: "Hoggies drop from crates. Team pages fill with the people you thank." },
  hoggies: { label: "Chapter 1", title: "Hoggies", lede: "Every crate you open drops one hoggie. Rarer ones drop less often." },
  teams: { label: "Chapter 2", title: "Teams", lede: "Every team on posthog.com has a page. Thank its people to fill it and earn the crest." },
  achievements: { label: "Chapter 3", title: "Achievements", lede: "Tiers you earn by thanking colleagues and being thanked." },
};

function Header({ chapter, collection, albums }: { chapter: Chapter; collection: Collection; albums: TeamAlbum[] }) {
  const section = sectionOf(chapter);
  const { label, title, lede } = titles[section];
  const crests = albums.filter((album) => album.collectedAt !== null).length;
  const people = new Set(albums.flatMap((album) => album.people.filter((person) => person.held).map((person) => person.key))).size;
  const total = new Set(albums.flatMap((album) => album.people.map((person) => person.key))).size;
  const aside = section === "hoggies" ? `${collection.owned} of ${collection.total} found` : section === "teams" ? `${crests} of ${albums.length} crests · ${people} of ${total} people` : null;
  return (
    <header className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <PageTitle tab={section === "cover" ? "Book · Collection" : `Book · Collection · ${title}`} size="display">
          {title}
        </PageTitle>
        {aside !== null && <span className="text-sm tabular-nums text-muted-foreground">{aside}</span>}
      </div>
      <p className="text-sm text-muted-foreground">{lede}</p>
    </header>
  );
}

export function collectionChaptersOf(chapter: Chapter, collection: Collection, albums: TeamAlbum[] = albumsWith(new Map())) {
  const section = sectionOf(chapter);
  const crests = albums.filter((album) => album.collectedAt !== null).length;
  return [
    { id: "cover", label: "Cover", href: chapterHref({ kind: "cover" }), count: null, current: section === "cover" },
    { id: "hoggies", label: "Hoggies", href: chapterHref({ kind: "hoggies", rarity: "legendary" }), count: `${collection.owned}/${collection.total}`, current: section === "hoggies" },
    { id: "teams", label: "Teams", href: chapterHref({ kind: "teams" }), count: `${crests}/${albums.length}`, current: section === "teams" },
  ];
}

function ChapterTabs({ chapter, collection, albums }: { chapter: Chapter; collection: Collection; albums: TeamAlbum[] }) {
  return (
    <nav aria-label="Chapters" className="lg:hidden">
      <ul className="flex gap-1.5">
        {collectionChaptersOf(chapter, collection, albums).map((entry) => (
          <li key={entry.id}>
            <a href={entry.href} aria-current={entry.current ? "page" : undefined} className="bk-tab inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {entry.label}
              {entry.count !== null && <span className="text-xs tabular-nums opacity-70">{entry.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { boughtCrateOf };
