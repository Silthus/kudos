import { IconArrowRight } from "@posthog/icons";
import { Button } from "@posthog/quill";
import type { CSSProperties, ReactNode } from "react";
import type { Collection, CollectionHoggie } from "../../collectionRead";
import { rarityWordsOf, type Rarity } from "../../crates/drops";
import { TeamCrest } from "../../crates/TeamCrest";
import { boughtCrateOf, type BoughtCrate } from "../../crates/readyCrates";
import { MemberFace } from "../../Face";
import { CoinGlyph } from "../../skills/glyphs";
import { dateWords } from "../dates";
import { HoggieCoin, nothingFoundYet } from "../HoggieCoin";
import { latestFindOf } from "../latestFind";
import { chapterHref } from "./chapters";
import { LootCrate } from "./LootCrate";
import { peopleCollected, peopleOnTeams, teamAlbums } from "./teamFixtures";

type CoverProps = { collection: Collection; fresh: ReadonlySet<string>; timeZone: string; coins: number | null; onOpen: (crate: BoughtCrate) => void };

export function Cover({ collection, fresh, timeZone, coins, onOpen }: CoverProps) {
  return (
    <div className="bk-rise flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <HoggiesCard collection={collection} />
        <TeamsCard />
      </div>
      <WhatsNew collection={collection} fresh={fresh} timeZone={timeZone} />
      <CrateShelf collection={collection} coins={coins} onOpen={onOpen} />
    </div>
  );
}

function ChapterCard({ href, label, title, art, children }: { href: string; label: string; title: string; art: ReactNode; children: ReactNode }) {
  return (
    <a href={href} aria-label={`${title} chapter`} className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <div className="flex items-start gap-4">
        {art}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="hud-label">{label}</span>
          <span className="hud-display text-2xl font-bold leading-tight">{title}</span>
        </div>
        <IconArrowRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {children}
    </a>
  );
}

function Ring({ value, max, size, fill, children }: { value: number; max: number; size: number; fill?: string; children: ReactNode }) {
  const share = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <span aria-hidden="true" className="bk-ring absolute inset-0 rounded-full" style={{ "--share": `${share}%`, "--ring-fill": fill } as CSSProperties} />
      {children}
    </span>
  );
}

function HoggiesCard({ collection }: { collection: Collection }) {
  const latest = latestFindOf(collection);
  return (
    <ChapterCard
      href={chapterHref({ kind: "hoggies", rarity: "legendary" })}
      label="Chapter 1"
      title="Hoggies"
      art={
        <Ring value={collection.owned} max={collection.total} size={76}>
          {latest === null ? <HoggieCoin art={nothingFoundYet} rarity="common" size={60} found={false} /> : <HoggieCoin art={latest.art} rarity={latest.rarity} size={60} />}
        </Ring>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="hud-display text-3xl font-extrabold tabular-nums leading-none">{collection.owned}</span>
        <span className="text-sm text-muted-foreground">{`of ${collection.total} found`}</span>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
        {[...collection.rarities].reverse().map(({ rarity, owned, total }) => (
          <li key={rarity} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="bk-rarity-pip" style={{ "--pip": `var(--rarity-${rarity})` } as CSSProperties} />
            <span className="sr-only">{rarityWordsOf(rarity)}</span>
            {`${owned}/${total}`}
          </li>
        ))}
      </ul>
    </ChapterCard>
  );
}

function TeamsCard() {
  const mine = teamAlbums.find((album) => album.mine) ?? teamAlbums[0]!;
  const crests = teamAlbums.filter((album) => album.collectedAt !== null).length;
  const faces = teamAlbums.flatMap((album) => album.people.filter((person) => person.held)).filter((person, at, all) => all.findIndex((other) => other.key === person.key) === at);
  return (
    <ChapterCard
      href={chapterHref({ kind: "teams" })}
      label="Chapter 2"
      title="Teams"
      art={
        <Ring value={peopleCollected} max={peopleOnTeams} size={76}>
          <TeamCrest art={mine.art} size={56} />
        </Ring>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="hud-display text-3xl font-extrabold tabular-nums leading-none">{peopleCollected}</span>
        <span className="text-sm text-muted-foreground">{`of ${peopleOnTeams} people · ${crests} of ${teamAlbums.length} crests`}</span>
      </div>
      <ul aria-hidden="true" className="flex items-center gap-1">
        {faces.slice(0, 8).map((person) => (
          <li key={person.key} className="sticker-face inline-flex rounded-full">
            <MemberFace face={person.face} className="size-7" />
          </li>
        ))}
        {faces.length > 8 && <li className="grid size-7 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">{`+${faces.length - 8}`}</li>}
      </ul>
    </ChapterCard>
  );
}

type NewItem = { key: string; art: ReactNode; title: string; sub: string; href: string };

function newItemsOf(collection: Collection, fresh: ReadonlySet<string>, timeZone: string): NewItem[] {
  const hoggies: NewItem[] = collection.hoggies
    .filter((hoggie): hoggie is CollectionHoggie & { seen: string; firstAt: number } => hoggie.seen !== null && fresh.has(hoggie.seen) && hoggie.firstAt !== null)
    .toSorted((first, second) => second.firstAt - first.firstAt)
    .map((hoggie) => ({ key: hoggie.seen, art: <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={44} />, title: hoggie.name, sub: `${rarityWordsOf(hoggie.rarity)} · ${dateWords(hoggie.firstAt, timeZone)}`, href: chapterHref({ kind: "hoggies", rarity: hoggie.rarity }) }));
  const crests: NewItem[] = (collection.crests ?? [])
    .filter((crest) => crest.seen !== null && fresh.has(crest.seen))
    .map((crest) => ({ key: crest.seen!, art: <TeamCrest art={crest.art} size={44} />, title: `${crest.name} crest`, sub: "Team complete", href: chapterHref({ kind: "team", team: crest.crest }) }));
  const stickers: NewItem[] = (collection.stickers ?? [])
    .filter((sticker) => fresh.has(sticker.seen))
    .map((sticker) => ({ key: sticker.seen, art: <MemberFace face={sticker.face} className="size-11" />, title: sticker.name, sub: `Sticker · ${dateWords(sticker.firstAt, timeZone)}`, href: chapterHref({ kind: "teams" }) }));
  return [...crests, ...hoggies, ...stickers].slice(0, 12);
}

function WhatsNew({ collection, fresh, timeZone }: { collection: Collection; fresh: ReadonlySet<string>; timeZone: string }) {
  const items = newItemsOf(collection, fresh, timeZone);
  return (
    <section aria-labelledby="whats-new" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="whats-new" className="hud-display text-xl font-bold leading-tight">
          New since your last visit
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length === 0 ? "Nothing new" : `${items.length} new`}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nothing new yet. Open a crate below, or thank a teammate to fill a team page.</p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {items.map((item) => (
            <li key={item.key} className="shrink-0">
              <a href={item.href} className="flex w-44 items-center gap-3 rounded-lg border bg-card p-3 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
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
    </section>
  );
}

function CrateShelf({ collection, coins, onOpen }: { collection: Collection; coins: number | null; onOpen: (crate: BoughtCrate) => void }) {
  const waiting = (collection.bought ?? []).flatMap((crate) => boughtCrateOf(crate) ?? []);
  const offer = collection.crateStore ?? null;
  if (waiting.length === 0 && offer === null) return null;
  const short = Math.max(0, (offer?.price ?? 0) - (coins ?? 0));
  return (
    <section aria-labelledby="crates" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="crates" className="hud-display text-xl font-bold leading-tight">
          Crates
        </h2>
        <span className="text-xs text-muted-foreground">{waiting.length === 0 ? "Each one drops a hoggie. Contents unknown until opened." : `${waiting.length} waiting · each drops one hoggie`}</span>
      </div>
      <div className="flex flex-col gap-0">
        <ul className="flex flex-wrap items-end justify-center gap-x-10 gap-y-6 px-6 pb-2 sm:justify-start">
          {waiting.map((crate, at) => (
            <li key={crate.crate} className="flex flex-col items-center gap-3">
              <LootCrate phase="closed" rarity="common" width={132} idle={at === 0} />
              <Button variant={at === 0 ? "primary" : "outline"} size="sm" onClick={() => onOpen(crate)}>
                {`Open crate ${crate.target.n}`}
              </Button>
            </li>
          ))}
          {offer !== null && (
            <li className="flex flex-col items-center gap-3">
              <span className="grid h-[121px] w-[132px] place-items-end">
                <span className="grid h-[88px] w-[112px] place-items-center rounded-xl border-2 border-dashed border-muted-foreground text-xs font-medium text-muted-foreground">Next crate</span>
              </span>
              <Button variant="outline" size="sm" aria-disabled={short > 0 || undefined}>
                Buy · <CoinGlyph className="size-3.5" /> {offer.price}
              </Button>
            </li>
          )}
        </ul>
        <div className="bk-shelf h-3" />
        {short > 0 && offer !== null && <p className="pt-2 text-xs text-muted-foreground">{`${short} more coins for the next crate. Coins are never refunded.`}</p>}
      </div>
    </section>
  );
}

export function rarityOfCrate(crate: BoughtCrate): Extract<Rarity, "legendary" | "rare"> {
  return crate.target.n % 2 === 1 ? "legendary" : "rare";
}
