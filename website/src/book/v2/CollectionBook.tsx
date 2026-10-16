import { useEffect, useState } from "react";
import type { Collection } from "../../collectionRead";
import type { Drop } from "../../crates/drops";
import type { BoughtCrate } from "../../crates/readyCrates";
import { PageTitle } from "../../PageTitle";
import { useFreshKeys } from "../useFreshKeys";
import { chapterHref, chapterKeyOf, sectionOf, useChapter, type Chapter } from "./chapters";
import { Cover, rarityOfCrate } from "./Cover";
import { HoggiesChapter } from "./HoggiesChapter";
import { LootReveal } from "./LootReveal";
import { peopleCollected, peopleOnTeams, teamAlbums } from "./teamFixtures";
import { TeamSpread, TeamsChapter } from "./TeamsChapter";
import "./book.css";

type CollectionBookProps = { collection: Collection; timeZone: string; coins: number | null };

const fixtureDrops: Record<"legendary" | "rare", Drop> = {
  legendary: { hoggie: "wizard", name: "Wizard", rarity: "legendary", art: { kind: "hoggie", slug: "wizard" }, copy: 1, isNew: true, crest: null },
  rare: { hoggie: "doctor", name: "Doctor", rarity: "rare", art: { kind: "hoggie", slug: "doctor" }, copy: 2, isNew: false, crest: null },
};

export function CollectionBook({ collection, timeZone, coins }: CollectionBookProps) {
  const chapter = useChapter();
  const fresh = useFreshKeys([...collection.hoggies, ...(collection.crests ?? []), ...(collection.stickers ?? []), ...teamAlbums].flatMap(({ seen }) => seen ?? []));
  const [opening, setOpening] = useState<BoughtCrate>();
  const waiting = collection.bought?.length ?? 0;
  useScrollToTopOn(chapterKeyOf(chapter));
  return (
    <>
      <Header chapter={chapter} collection={collection} />
      <ChapterTabs chapter={chapter} collection={collection} />
      {chapter.kind === "cover" && <Cover collection={collection} fresh={fresh} timeZone={timeZone} coins={coins} onOpen={setOpening} />}
      {chapter.kind === "hoggies" && <HoggiesChapter collection={collection} rarity={chapter.rarity} fresh={fresh} timeZone={timeZone} />}
      {chapter.kind === "teams" && <TeamsChapter fresh={fresh} timeZone={timeZone} />}
      {chapter.kind === "team" && <TeamSpread team={chapter.team} timeZone={timeZone} />}
      {opening !== undefined && <LootReveal label={`Crate ${opening.target.n} · a crate you bought`} drop={fixtureDrops[rarityOfCrate(opening)]} othersReady={waiting - 1} onClose={() => setOpening(undefined)} onNext={() => setOpening(undefined)} />}
    </>
  );
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
};

function Header({ chapter, collection }: { chapter: Chapter; collection: Collection }) {
  const section = sectionOf(chapter);
  const { label, title, lede } = titles[section];
  const crests = teamAlbums.filter((album) => album.collectedAt !== null).length;
  const aside = section === "hoggies" ? `${collection.owned} of ${collection.total} found` : section === "teams" ? `${crests} of ${teamAlbums.length} crests · ${peopleCollected} of ${peopleOnTeams} people` : null;
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

export function collectionChaptersOf(chapter: Chapter, collection: Collection) {
  const section = sectionOf(chapter);
  const crests = teamAlbums.filter((album) => album.collectedAt !== null).length;
  return [
    { id: "cover", label: "Cover", href: chapterHref({ kind: "cover" }), count: null, current: section === "cover" },
    { id: "hoggies", label: "Hoggies", href: chapterHref({ kind: "hoggies", rarity: "legendary" }), count: `${collection.owned}/${collection.total}`, current: section === "hoggies" },
    { id: "teams", label: "Teams", href: chapterHref({ kind: "teams" }), count: `${crests}/${teamAlbums.length}`, current: section === "teams" },
  ];
}

function ChapterTabs({ chapter, collection }: { chapter: Chapter; collection: Collection }) {
  return (
    <nav aria-label="Chapters" className="lg:hidden">
      <ul className="flex gap-1.5">
        {collectionChaptersOf(chapter, collection).map((entry) => (
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
