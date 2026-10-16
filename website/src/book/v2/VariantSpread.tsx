import { IconArrowLeft, IconArrowRight } from "@posthog/icons";
import type { CSSProperties, ReactNode } from "react";
import type { Collection } from "../../collectionRead";
import { rarityWordsOf, type Rarity } from "../../crates/drops";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import type { LadderCard } from "../../shell";
import { QuietBar } from "../Bar";
import { chaptersOf, type CategoryId } from "../categories";
import { dateWords, tierWords } from "../dates";
import { HoggieCoin, nothingFoundYet } from "../HoggieCoin";
import { HoggieTile } from "../HoggieTile";
import { Ladder } from "../Ladder";
import { LadderEmblem } from "../LadderEmblem";
import { latestFindOf } from "../latestFind";
import { PersonSilhouette } from "../PersonSilhouette";
import { closestNextOf, recentlyEarned, tiersEarned } from "../progress";
import { chapterHref, chapterKeyOf, sectionOf, type Chapter } from "./chapters";
import { newItemsOf, Ring } from "./Cover";
import { PackStack } from "./PackStack";
import type { Pack } from "./packs";
import { peopleCountsOf, type TeamAlbum } from "./teamFixtures";
import { TeamSpread } from "./TeamsChapter";

export type SpreadProps = { collection: Collection; albums: TeamAlbum[]; ladders: LadderCard[]; chapter: Chapter; fresh: ReadonlySet<string>; timeZone: string; packs: Pack[]; onPick: (at: number) => void };

const wordsOnly = (rarity: Rarity) => rarityWordsOf(rarity).replace(/^\S+\s/, "");

export function VariantSpread({ collection, albums, ladders, chapter, fresh, timeZone, packs, onPick }: SpreadProps) {
  const section = sectionOf(chapter);
  const tiers = tiersEarned(ladders);
  const tabs = [
    { id: "cover", label: "Cover", href: chapterHref({ kind: "cover" }) },
    { id: "hoggies", label: `Hoggies · ${collection.owned}/${collection.total}`, href: chapterHref({ kind: "hoggies", rarity: "legendary" }) },
    { id: "teams", label: `Teams · ${peopleCountsOf(albums).crests}/${albums.length}`, href: chapterHref({ kind: "teams" }) },
    { id: "achievements", label: `Achievements · ${tiers.earned}/${tiers.total}`, href: chapterHref({ kind: "achievements", category: "all" }) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <h1 className="hud-display text-4xl font-extrabold leading-none">Your book</h1>
        <p className="text-sm text-muted-foreground">Hoggies from crates, teams from the people you thank, achievements from both. Flip the tabs.</p>
      </header>
      <div className="bk-perspective">
        <nav aria-label="Book sections" className="-mb-px flex items-end gap-1 overflow-x-auto px-5">
          {tabs.map((tab) => (
            <a key={tab.id} href={tab.href} data-chapter={tab.id} aria-current={tab.id === section ? "page" : undefined} className="bk-page-tab shrink-0">
              {tab.label}
            </a>
          ))}
        </nav>
        <article key={chapterKeyOf(chapter)} className="bk-book bk-flip-in grid overflow-hidden lg:grid-cols-2">
          {chapter.kind === "cover" && <CoverPages collection={collection} albums={albums} ladders={ladders} fresh={fresh} timeZone={timeZone} />}
          {chapter.kind === "hoggies" && <HoggiePages collection={collection} rarity={chapter.rarity} fresh={fresh} timeZone={timeZone} />}
          {chapter.kind === "teams" && <TeamPages albums={albums} />}
          {chapter.kind === "team" && (
            <div className="lg:col-span-2">
              <TeamSpread albums={albums} team={chapter.team} timeZone={timeZone} framed={false} />
            </div>
          )}
          {chapter.kind === "achievements" && <AchievementPages ladders={ladders} category={chapter.category} timeZone={timeZone} />}
        </article>
      </div>
      {chapter.kind === "team" && (
        <a href={chapterHref({ kind: "teams" })} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Back to all teams
        </a>
      )}
      <section aria-labelledby="crates" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="crates" className="hud-display text-xl font-bold leading-tight">
            Crates
          </h2>
          <span className="text-xs text-muted-foreground">Each pack holds one hoggie, some XP and a few coins.</span>
        </div>
        <PackStack packs={packs} onPick={onPick} />
      </section>
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

type CoverProps = { collection: Collection; albums: TeamAlbum[]; ladders: LadderCard[]; fresh: ReadonlySet<string>; timeZone: string };

function CoverPages({ collection, albums, ladders, fresh, timeZone }: CoverProps) {
  const latest = latestFindOf(collection);
  const mine = albums.find((album) => album.mine) ?? albums[0]!;
  const { collected, total, crests } = peopleCountsOf(albums);
  const tiers = tiersEarned(ladders);
  const fresher = newItemsOf(collection, albums, fresh, timeZone).slice(0, 4);
  return (
    <>
      <Page side="left" number={1}>
        <span className="hud-label">Chapter 1 · Hoggies</span>
        <a href={chapterHref({ kind: "hoggies", rarity: "legendary" })} className="bk-row flex items-center gap-5 rounded-lg p-2 hover:bg-fill-hover">
          <Ring value={collection.owned} max={collection.total} size={116}>
            {latest === null ? <HoggieCoin art={nothingFoundYet} rarity="common" size={92} found={false} /> : <HoggieCoin art={latest.art} rarity={latest.rarity} size={92} />}
          </Ring>
          <span className="flex flex-col">
            <span className="hud-display text-4xl font-extrabold tabular-nums leading-none">{collection.owned}</span>
            <span className="text-sm text-muted-foreground">{`of ${collection.total} hoggies found`}</span>
            {latest !== null && <span className="mt-1 text-xs text-muted-foreground">{`Latest: ${latest.name}`}</span>}
          </span>
        </a>
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
          <Ring value={collected} max={total} size={96}>
            <span className="bk-crest-hover inline-flex">
              <TeamCrest art={mine.art} size={70} />
            </span>
          </Ring>
          <span className="flex flex-col">
            <span className="hud-display text-3xl font-extrabold tabular-nums leading-none">{collected}</span>
            <span className="text-sm text-muted-foreground">{`of ${total} people · ${crests} of ${albums.length} crests`}</span>
          </span>
        </a>
        <span className="hud-label">Chapter 3 · Achievements</span>
        <a href={chapterHref({ kind: "achievements", category: "all" })} className="bk-row flex items-center gap-5 rounded-lg p-2 hover:bg-fill-hover">
          <Ring value={tiers.earned} max={tiers.total} size={72}>
            <span className="hud-display text-lg font-extrabold tabular-nums">{tiers.earned}</span>
          </Ring>
          <span className="flex flex-col">
            <span className="text-sm text-muted-foreground">{`of ${tiers.total} tiers earned across ${ladders.length} ladders`}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              Open the chapter <IconArrowRight className="size-3.5" />
            </span>
          </span>
        </a>
        <span className="hud-label mt-1">New since your last visit</span>
        {fresher.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing new yet. Open a pack or thank a teammate.</p>
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
  const next = rarestFirst[at + 1];
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
        <p className="mt-2 text-xs text-muted-foreground">{`${share.chance}% of packs hold a ${wordsOnly(share.rarity).toLowerCase()} hoggie.`}</p>
      </Page>
      <Page side="right" number={4 + at * 2}>
        <div className="flex items-baseline justify-between" data-chapter="hoggies">
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
          {next && (
            <a href={chapterHref({ kind: "hoggies", rarity: next.rarity })} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              {wordsOnly(next.rarity)} <IconArrowRight className="size-4" />
            </a>
          )}
        </div>
      </Page>
    </>
  );
}

function TeamPages({ albums }: { albums: TeamAlbum[] }) {
  const mine = albums.filter((album) => album.mine);
  const started = albums.filter((album) => !album.mine && album.held > 0);
  const untouched = albums.filter((album) => !album.mine && album.held === 0);
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

function AchievementPages({ ladders, category, timeZone }: { ladders: LadderCard[]; category: CategoryId | "all"; timeZone: string }) {
  const chapters = chaptersOf(ladders);
  const current = chapters.find((chapter) => chapter.category.id === category);
  const closest = closestNextOf(ladders);
  const recent = recentlyEarned(ladders).slice(0, 6);
  const pageAt = current === undefined ? 0 : chapters.indexOf(current) + 1;
  return (
    <>
      <Page side="left" number={15 + pageAt * 2}>
        <span className="hud-label">Chapter 3 · Achievements</span>
        <ol className="flex flex-col gap-1">
          <li>
            <a href={chapterHref({ kind: "achievements", category: "all" })} aria-current={category === "all" ? "page" : undefined} className={`bk-row flex items-center gap-3 rounded-md px-2 py-2 hover:bg-fill-hover ${category === "all" ? "bg-fill-selected font-medium" : ""}`}>
              <span className="w-7" />
              <span className="flex-1 text-sm">Recently earned</span>
              <span className="text-xs tabular-nums text-muted-foreground">{`${tiersEarned(ladders).earned}/${tiersEarned(ladders).total}`}</span>
            </a>
          </li>
          {chapters.map((chapter) => {
            const count = tiersEarned(chapter.ladders);
            const here = chapter.category.id === category;
            return (
              <li key={chapter.category.id}>
                <a href={chapterHref({ kind: "achievements", category: chapter.category.id })} aria-current={here ? "page" : undefined} className={`bk-row flex items-center gap-3 rounded-md px-2 py-2 hover:bg-fill-hover ${here ? "bg-fill-selected font-medium" : ""}`}>
                  <span className="bk-crest-hover inline-flex w-7 justify-center">
                    <chapter.category.Emblem size={28} />
                  </span>
                  <span className="w-28 text-sm">{chapter.category.name}</span>
                  <span className="flex-1">
                    <QuietBar value={count.earned} max={count.total} />
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{`${count.earned}/${count.total}`}</span>
                </a>
              </li>
            );
          })}
        </ol>
        {closest !== null && (
          <div className="bk-slot mt-2 flex items-center gap-3 p-3">
            <LadderEmblem ladder={closest.ladder.ladder} best={closest.tier.tier} />
            <span className="flex min-w-0 flex-col">
              <span className="hud-label">Closest next</span>
              <span className="truncate text-sm font-medium">{`${tierWords[closest.tier.tier]} ${closest.ladder.name}`}</span>
              <span className="text-xs text-muted-foreground">{`${closest.toGo} to go`}</span>
            </span>
          </div>
        )}
      </Page>
      <Page side="right" number={16 + pageAt * 2}>
        {current === undefined ? (
          <>
            <span className="hud-display text-xl font-bold">Recently earned</span>
            <ul className="flex flex-col gap-2">
              {recent.map(({ ladder, tier }) => (
                <li key={`${ladder.ladder}:${tier.tier}`} className="bk-row flex items-center gap-3 rounded-md px-2 py-1.5">
                  <LadderEmblem ladder={ladder.ladder} best={tier.tier} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{`${tierWords[tier.tier]} ${ladder.name}`}</span>
                    <span className="text-xs text-muted-foreground">{dateWords(tier.earnedAt, timeZone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <span className="hud-display text-xl font-bold">{current.category.name}</span>
            {current.category.blurb !== null && <p className="text-xs text-muted-foreground">{current.category.blurb}</p>}
            <div className="flex flex-col gap-3">
              {current.ladders.map((ladder) => (
                <Ladder key={ladder.ladder} ladder={ladder} timeZone={timeZone} />
              ))}
            </div>
          </>
        )}
      </Page>
    </>
  );
}
