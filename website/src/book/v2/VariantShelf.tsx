import type { CSSProperties, ReactNode } from "react";
import type { Collection, CollectionHoggie } from "../../collectionRead";
import { rarityWordsOf, type Rarity } from "../../crates/drops";
import { TeamCrest } from "../../crates/TeamCrest";
import { HoggieCoin, nothingFoundYet } from "../HoggieCoin";
import { latestFindOf } from "../latestFind";
import { chapterHref, type Chapter } from "./chapters";
import { CrateShelf, newItemsOf, Ring, type OnOpen } from "./Cover";
import { peopleCountsOf, type TeamAlbum } from "./teamFixtures";
import { TeamSpread } from "./TeamsChapter";

type ShelfProps = { collection: Collection; albums: TeamAlbum[]; chapter: Chapter; fresh: ReadonlySet<string>; timeZone: string; coins: number | null; onOpen: OnOpen };

const wordsOnly = (rarity: Rarity) => rarityWordsOf(rarity).replace(/^\S+\s/, "");

export function VariantShelf({ collection, albums, chapter, fresh, timeZone, coins, onOpen }: ShelfProps) {
  const latest = latestFindOf(collection);
  const { collected, total, crests } = peopleCountsOf(albums);
  const fresher = newItemsOf(collection, albums, fresh, timeZone);
  return (
    <div className="flex flex-col gap-8">
      <section className="night-band flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center">
        <Ring value={collection.owned} max={collection.total} size={132} fill="var(--band-lemon)">
          {latest === null ? <HoggieCoin art={nothingFoundYet} rarity="common" size={104} found={false} /> : <HoggieCoin art={latest.art} rarity={latest.rarity} size={104} />}
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="hud-label">Trophy room</span>
          <h1 className="hud-display text-4xl font-extrabold leading-none">Collection</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <strong className="hud-display text-2xl font-extrabold tabular-nums">{collection.owned}</strong>
              <span className="night-band-quiet">{` of ${collection.total} hoggies`}</span>
            </span>
            <span>
              <strong className="hud-display text-2xl font-extrabold tabular-nums">{collected}</strong>
              <span className="night-band-quiet">{` of ${total} people`}</span>
            </span>
            <span>
              <strong className="hud-display text-2xl font-extrabold tabular-nums">{crests}</strong>
              <span className="night-band-quiet">{` of ${albums.length} crests`}</span>
            </span>
          </div>
          <span className="night-band-quiet text-xs">{fresher.length === 0 ? "Nothing new since your last visit." : `${fresher.length} new since your last visit, marked below.`}</span>
        </div>
      </section>
      {[...collection.rarities].reverse().map((share) => (
        <Shelf key={share.rarity} title={wordsOnly(share.rarity)} aside={`${share.owned} of ${share.total} · ${share.chance}% per crate`} pip={share.rarity}>
          {collection.hoggies
            .filter((hoggie) => hoggie.rarity === share.rarity)
            .map((hoggie) => (
              <HoggieStand key={hoggie.hoggie} hoggie={hoggie} fresh={hoggie.seen !== null && fresh.has(hoggie.seen)} />
            ))}
        </Shelf>
      ))}
      <Shelf title="Teams" aside={`${crests} of ${albums.length} crests · the people you thank`} id="teams">
        {albums.map((album) => (
          <CrestStand key={album.team} album={album} current={chapter.kind === "team" && chapter.team === album.team} />
        ))}
      </Shelf>
      {chapter.kind === "team" && <TeamSpread albums={albums} team={chapter.team} timeZone={timeZone} />}
      <CrateShelf collection={collection} coins={coins} onOpen={onOpen} />
    </div>
  );
}

function Shelf({ title, aside, pip, id, children }: { title: string; aside: string; pip?: Rarity; id?: string; children: ReactNode }) {
  return (
    <section aria-label={title} data-chapter={id} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="hud-display flex items-center gap-2 text-lg font-bold leading-tight">
          {pip !== undefined && <span aria-hidden="true" className="bk-rarity-pip size-3" style={{ "--pip": `var(--rarity-${pip})` } as CSSProperties} />}
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>
      </div>
      <div className="bk-shelf-row -mx-2 flex items-end gap-3 overflow-x-auto px-4 pb-1 pt-3">{children}</div>
      <div className="bk-shelf h-3" />
    </section>
  );
}

function HoggieStand({ hoggie, fresh }: { hoggie: CollectionHoggie; fresh: boolean }) {
  const found = hoggie.firstAt !== null;
  return (
    <a href={chapterHref({ kind: "hoggies", rarity: hoggie.rarity })} data-hoggie={hoggie.hoggie} data-held={found ? "found" : "missing"} data-rarity={hoggie.rarity} title={hoggie.name} className="bk-stand relative flex w-[5.5rem] shrink-0 snap-start flex-col items-center gap-1.5" style={{ "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={72} found={found} />
      <span className={`w-full truncate text-center text-[11px] ${found ? "font-medium" : "text-muted-foreground"}`}>{hoggie.name}</span>
      {hoggie.count > 1 && <span className="absolute right-0 top-0 rounded-full border bg-card px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{`×${hoggie.count}`}</span>}
      {fresh && <span className="absolute left-0 top-0 rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">New</span>}
    </a>
  );
}

function CrestStand({ album, current }: { album: TeamAlbum; current: boolean }) {
  const complete = album.collectedAt !== null;
  return (
    <a href={chapterHref({ kind: "team", team: album.team })} data-team={album.team} aria-current={current ? "true" : undefined} title={`${album.name}: ${album.held} of ${album.total}`} className={`bk-stand relative flex w-24 shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg p-1 ${current ? "bg-fill-selected" : ""}`}>
      <span className="bk-crest-hover inline-flex">
        <TeamCrest art={album.art} size={72} collected={complete} />
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium">{album.name}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${complete ? "bg-foreground text-background" : "border bg-card text-muted-foreground"}`}>{complete ? "✓" : `${album.held}/${album.total}`}</span>
      {album.mine && <span className="absolute left-0 top-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">Yours</span>}
    </a>
  );
}
