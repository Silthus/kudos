import { IconArrowLeft, IconArrowRight } from "@posthog/icons";
import type { CSSProperties, ReactNode } from "react";
import type { Collection } from "../../collectionRead";
import { rarityWordsOf, type Rarity } from "../../crates/drops";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import { QuietBar } from "../Bar";
import { HoggieCoin, nothingFoundYet } from "../HoggieCoin";
import { HoggieTile } from "../HoggieTile";
import { latestFindOf } from "../latestFind";
import { PersonSilhouette } from "../PersonSilhouette";
import { chapterHref, chapterKeyOf, sectionOf, type Chapter } from "./chapters";
import { CrateShelf, newItemsOf, Ring, type OnOpen } from "./Cover";
import { peopleCountsOf, type TeamAlbum } from "./teamFixtures";
import { TeamSpread } from "./TeamsChapter";

type SpreadProps = { collection: Collection; albums: TeamAlbum[]; chapter: Chapter; fresh: ReadonlySet<string>; timeZone: string; coins: number | null; onOpen: OnOpen };

const wordsOnly = (rarity: Rarity) => rarityWordsOf(rarity).replace(/^\S+\s/, "");

export function VariantSpread({ collection, albums, chapter, fresh, timeZone, coins, onOpen }: SpreadProps) {
  const section = sectionOf(chapter);
  const tabs = [
    { id: "cover", label: "Cover", href: chapterHref({ kind: "cover" }) },
    { id: "hoggies", label: `Hoggies · ${collection.owned}/${collection.total}`, href: chapterHref({ kind: "hoggies", rarity: "legendary" }) },
    { id: "teams", label: `Teams · ${peopleCountsOf(albums).crests}/${albums.length}`, href: chapterHref({ kind: "teams" }) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <h1 className="hud-display text-4xl font-extrabold leading-none">Collection</h1>
        <p className="text-sm text-muted-foreground">One open book. Flip between its sections with the tabs on the top edge.</p>
      </header>
      <div className="bk-perspective">
        <nav aria-label="Book sections" className="flex items-end gap-1 px-5">
          {tabs.map((tab) => (
            <a key={tab.id} href={tab.href} data-chapter={tab.id} aria-current={tab.id === section ? "page" : undefined} className="bk-page-tab">
              {tab.label}
            </a>
          ))}
        </nav>
        <article key={chapterKeyOf(chapter)} className="bk-book bk-flip-in grid overflow-hidden lg:grid-cols-2">
          {chapter.kind === "cover" && <CoverPages collection={collection} albums={albums} fresh={fresh} timeZone={timeZone} />}
          {chapter.kind === "hoggies" && <HoggiePages collection={collection} rarity={chapter.rarity} fresh={fresh} timeZone={timeZone} />}
          {chapter.kind === "teams" && <TeamPages albums={albums} timeZone={timeZone} />}
          {chapter.kind === "team" && (
            <div className="lg:col-span-2">
              <TeamSpread albums={albums} team={chapter.team} timeZone={timeZone} framed={false} />
            </div>
          )}
        </article>
      </div>
      {chapter.kind === "team" && (
        <a href={chapterHref({ kind: "teams" })} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Back to all teams
        </a>
      )}
      <CrateShelf collection={collection} coins={coins} onOpen={onOpen} compact />
    </div>
  );
}

function Page({ side, children, number }: { side: "left" | "right"; children: ReactNode; number: number }) {
  return (
    <section className={`bk-paper ${side === "left" ? "bk-page-left" : "bk-page-right"} relative flex min-h-[28rem] flex-col gap-4 p-5 sm:p-7`}>
      {children}
      <span className={`hud-display mt-auto hidden pt-2 text-xs tabular-nums text-muted-foreground lg:block ${side === "left" ? "self-start" : "self-end"}`}>{number}</span>
    </section>
  );
}

function CoverPages({ collection, albums, fresh, timeZone }: Omit<SpreadProps, "chapter" | "coins" | "onOpen">) {
  const latest = latestFindOf(collection);
  const mine = albums.find((album) => album.mine) ?? albums[0]!;
  const { collected, total, crests } = peopleCountsOf(albums);
  const fresher = newItemsOf(collection, albums, fresh, timeZone).slice(0, 4);
  return (
    <>
      <Page side="left" number={1}>
        <span className="hud-label">Chapter 1 · Hoggies</span>
        <div className="flex items-center gap-5">
          <Ring value={collection.owned} max={collection.total} size={116}>
            {latest === null ? <HoggieCoin art={nothingFoundYet} rarity="common" size={92} found={false} /> : <HoggieCoin art={latest.art} rarity={latest.rarity} size={92} />}
          </Ring>
          <div className="flex flex-col">
            <span className="hud-display text-4xl font-extrabold tabular-nums leading-none">{collection.owned}</span>
            <span className="text-sm text-muted-foreground">{`of ${collection.total} hoggies found`}</span>
            {latest !== null && <span className="mt-1 text-xs text-muted-foreground">{`Latest: ${latest.name}`}</span>}
          </div>
        </div>
        <ol className="flex flex-col gap-2">
          {[...collection.rarities].reverse().map(({ rarity, owned, total: all, chance }) => (
            <li key={rarity}>
              <a href={chapterHref({ kind: "hoggies", rarity })} className="bk-row flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fill-hover">
                <span aria-hidden="true" className="bk-rarity-pip size-3" style={{ "--pip": `var(--rarity-${rarity})` } as CSSProperties} />
                <span className="w-24 text-sm font-medium">{wordsOnly(rarity)}</span>
                <span className="flex-1">
                  <QuietBar value={owned} max={all} />
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{`${owned}/${all}`}</span>
                <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{`${chance}%`}</span>
              </a>
            </li>
          ))}
        </ol>
      </Page>
      <Page side="right" number={2}>
        <span className="hud-label">Chapter 2 · Teams</span>
        <a href={chapterHref({ kind: "teams" })} className="bk-row flex items-center gap-5 rounded-lg p-2 hover:bg-fill-hover">
          <Ring value={collected} max={total} size={116}>
            <span className="bk-crest-hover inline-flex">
              <TeamCrest art={mine.art} size={84} />
            </span>
          </Ring>
          <span className="flex flex-col">
            <span className="hud-display text-4xl font-extrabold tabular-nums leading-none">{collected}</span>
            <span className="text-sm text-muted-foreground">{`of ${total} people · ${crests} of ${albums.length} crests`}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium">
              Open the chapter <IconArrowRight className="size-3.5" />
            </span>
          </span>
        </a>
        <span className="hud-label mt-2">New since your last visit</span>
        {fresher.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing new yet. Open a crate or thank a teammate.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {fresher.map((item) => (
              <li key={item.key}>
                <a href={item.href} className="bk-row flex items-center gap-3 rounded-md px-2 py-1 hover:bg-fill-hover">
                  {item.art}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{item.sub}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}

function HoggiePages({ collection, rarity, fresh, timeZone }: { collection: Collection; rarity: Rarity; fresh: ReadonlySet<string>; timeZone: string }) {
  const rarestFirst = [...collection.rarities].reverse();
  const at = Math.max(
    0,
    rarestFirst.findIndex((entry) => entry.rarity === rarity),
  );
  const share = rarestFirst[at]!;
  const hoggies = collection.hoggies.filter((hoggie) => hoggie.rarity === share.rarity);
  const previous = rarestFirst[at - 1];
  const following = rarestFirst[at + 1];
  return (
    <>
      <Page side="left" number={3 + at * 2}>
        <span className="hud-label">Chapter 1 · Hoggies</span>
        <ol className="flex flex-col gap-1">
          {rarestFirst.map((entry, index) => (
            <li key={entry.rarity}>
              <a href={chapterHref({ kind: "hoggies", rarity: entry.rarity })} aria-current={entry.rarity === share.rarity ? "page" : undefined} className={`bk-row flex items-center gap-3 rounded-md px-2 py-2 hover:bg-fill-hover ${entry.rarity === share.rarity ? "bg-fill-selected font-medium" : ""}`}>
                <span aria-hidden="true" className="bk-rarity-pip size-3" style={{ "--pip": `var(--rarity-${entry.rarity})` } as CSSProperties} />
                <span className="w-24 text-sm">{wordsOnly(entry.rarity)}</span>
                <span className="flex-1">
                  <QuietBar value={entry.owned} max={entry.total} />
                </span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{`${entry.owned}/${entry.total}`}</span>
                <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{`p.${4 + index * 2}`}</span>
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">{`${share.chance}% of crates drop a ${wordsOnly(share.rarity).toLowerCase()} hoggie.`}</p>
      </Page>
      <Page side="right" number={4 + at * 2}>
        <div className="flex items-baseline justify-between">
          <span className="hud-display text-xl font-bold">{wordsOnly(share.rarity)}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{`${share.owned} of ${share.total} found`}</span>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {hoggies.map((hoggie) => (
            <HoggieTile key={hoggie.hoggie} hoggie={hoggie} fresh={hoggie.seen !== null && fresh.has(hoggie.seen)} timeZone={timeZone} />
          ))}
        </ul>
        <div className="flex items-center justify-between pt-2 text-sm">
          {previous ? (
            <a href={chapterHref({ kind: "hoggies", rarity: previous.rarity })} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <IconArrowLeft className="size-4" /> {wordsOnly(previous.rarity)}
            </a>
          ) : (
            <span />
          )}
          {following && (
            <a href={chapterHref({ kind: "hoggies", rarity: following.rarity })} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              {wordsOnly(following.rarity)} <IconArrowRight className="size-4" />
            </a>
          )}
        </div>
      </Page>
    </>
  );
}

function TeamPages({ albums, timeZone }: { albums: TeamAlbum[]; timeZone: string }) {
  const mine = albums.filter((album) => album.mine);
  const started = albums.filter((album) => !album.mine && album.held > 0);
  const untouched = albums.filter((album) => !album.mine && album.held === 0);
  void timeZone;
  return (
    <>
      <Page side="left" number={13}>
        <span className="hud-label">Chapter 2 · Your teams</span>
        <ul className="flex flex-col gap-3">
          {mine.map((album) => (
            <li key={album.team}>
              <TeamRow album={album} big />
            </li>
          ))}
        </ul>
        <span className="hud-label mt-3">Pages started</span>
        <ul className="flex flex-col gap-1">
          {started.map((album) => (
            <li key={album.team}>
              <TeamRow album={album} />
            </li>
          ))}
        </ul>
      </Page>
      <Page side="right" number={14}>
        <span className="hud-label">{`Not started · ${untouched.length} teams`}</span>
        <ul className="columns-2 gap-x-4">
          {untouched.map((album) => (
            <li key={album.team} className="break-inside-avoid">
              <a href={chapterHref({ kind: "team", team: album.team })} data-team={album.team} className="bk-row flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-fill-hover">
                <TeamCrest art={album.art} size={26} collected={false} />
                <span className="min-w-0 flex-1 truncate text-xs">{album.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{album.total}</span>
              </a>
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}

function TeamRow({ album, big = false }: { album: TeamAlbum; big?: boolean }) {
  return (
    <a href={chapterHref({ kind: "team", team: album.team })} data-team={album.team} className={`bk-row flex items-center gap-3 rounded-lg hover:bg-fill-hover ${big ? "bk-slot p-3" : "px-2 py-1.5"}`}>
      <span className="bk-crest-hover inline-flex">
        <TeamCrest art={album.art} size={big ? 56 : 36} collected={album.held > 0} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-medium ${big ? "hud-display text-lg" : "text-sm"}`}>{album.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{`${album.held}/${album.total}`}</span>
        </span>
        {big && <QuietBar value={album.held} max={album.total} />}
        {big && (
          <span aria-hidden="true" className="flex gap-1">
            {album.people.map((person) => (
              <span key={person.key} className="bk-face">
                {person.held ? <MemberFace face={person.face} className="size-6" /> : <PersonSilhouette className="size-6" />}
              </span>
            ))}
          </span>
        )}
      </span>
    </a>
  );
}
