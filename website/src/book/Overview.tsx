import { HedgehogReadingIsMagic } from "@posthog/brand/hoggies";
import { IconArrowRight } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import { useId, type ReactNode } from "react";
import { AppLink } from "../AppLink";
import type { LadderCard } from "../shell";
import { useWideScreen } from "../useWideScreen";
import { Bar, QuietBar } from "./Bar";
import { bookHref, chaptersOf, type Chapter } from "./categories";
import { dateWords, tierWords } from "./dates";
import { LadderEmblem } from "./LadderEmblem";
import { Medal } from "./Medal";
import { bestOf, closestNextOf, isNew, recentlyEarned, tiersEarned, type ClosestNext, type Shelved } from "./progress";
import { Tag } from "./Tag";

type OverviewProps = { ladders: LadderCard[]; timeZone: string };

export function Overview({ ladders, timeZone }: OverviewProps) {
  const chapters = chaptersOf(ladders);
  const closest = closestNextOf(ladders);
  return (
    <div className="flex flex-col gap-8">
      <TiersEarned ladders={ladders} />
      {closest !== null && <ClosestNextTier closest={closest} chapters={chapters} />}
      <RecentlyEarned ladders={ladders} chapters={chapters} timeZone={timeZone} />
      <CategoryTiles chapters={chapters} />
    </div>
  );
}

function TiersEarned({ ladders }: { ladders: LadderCard[] }) {
  const { earned, total } = tiersEarned(ladders);
  const sentence = `${earned} of ${total} tiers earned`;
  return (
    <section aria-label="Your tiers">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 sm:flex-row">
          <span data-hog="reading" aria-hidden="true" className="shrink-0">
            <HedgehogReadingIsMagic size={128} title="" />
          </span>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="hud-display text-2xl font-bold leading-tight sm:text-3xl">{sentence}</h2>
              <p className="text-sm text-muted-foreground">Across {ladders.length} ladders.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Bar label={sentence} value={earned} max={total} />
              <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {earned} / {total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ClosestNextTier({ closest: { ladder, tier, toGo }, chapters }: { closest: ClosestNext; chapters: Chapter[] }) {
  const best = bestOf(ladder);
  const ladderLine = `${tierWords[tier.tier]} · ${ladder.name}`;
  return (
    <AppLink
      href={pageOf(ladder, chapters)}
      aria-label={`Closest next tier: ${tier.name}, ${ladderLine}, ${toGo} to go`}
      className="group flex items-center gap-4 rounded-xl border bg-card p-3 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-4"
    >
      <LadderEmblem ladder={ladder.ladder} best={best?.tier ?? null} size={60} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="hud-label">Closest next tier</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag>Next</Tag>
          <Medal tier={tier.tier} earned={false} />
          <span className="hud-display text-lg font-bold leading-tight">{tier.name}</span>
          <span className="text-sm text-muted-foreground">{ladderLine}</span>
        </div>
        <span className="text-sm font-medium tabular-nums">{toGo} to go</span>
      </div>
      <IconArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
    </AppLink>
  );
}

function RecentlyEarned({ ladders, chapters, timeZone }: OverviewProps & { chapters: Chapter[] }) {
  const wide = useWideScreen();
  const headingId = useId();
  const shelf = recentlyEarned(ladders).slice(0, wide ? 5 : 3);
  if (shelf.length === 0) return null;
  const now = Date.now();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading id={headingId} aside="Newest first">
        Recently earned
      </SectionHeading>
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-x-0 top-[68px] h-1.5 rounded-sm bg-muted-foreground" />
        <ol aria-labelledby={headingId} className={`relative grid gap-x-2 ${wide ? "grid-cols-5" : "grid-cols-3"}`}>
          {shelf.map((entry, i) => (
            <ShelfItem key={entry.ladder.ladder} entry={entry} fresh={i === 0 && isNew(entry, now)} href={pageOf(entry.ladder, chapters)} timeZone={timeZone} wide={wide} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function ShelfItem({ entry: { ladder, tier }, fresh, href, timeZone, wide }: { entry: Shelved; fresh: boolean; href: string; timeZone: string; wide: boolean }) {
  return (
    <li className="min-w-0">
      <AppLink
        href={href}
        aria-label={`${tier.name}, ${tierWords[tier.tier]} ${ladder.name}, earned ${dateWords(tier.earnedAt, timeZone)}${fresh ? ", new" : ""}`}
        className="flex flex-col items-center rounded-lg pb-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="relative">
          <LadderEmblem ladder={ladder.ladder} best={tier.tier} size={72} />
          {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
        </span>
        <span className="mt-4 line-clamp-2 w-full text-balance break-words px-1 text-sm font-medium leading-tight">{tier.name}</span>
        <EarnedLine tier={tier} timeZone={timeZone} wide={wide} />
      </AppLink>
    </li>
  );
}

function EarnedLine({ tier, timeZone, wide }: { tier: Shelved["tier"]; timeZone: string; wide: boolean }) {
  const date = dateWords(tier.earnedAt, timeZone);
  return (
    <span className="mt-1 flex w-full items-center justify-center gap-1 px-1 text-[11px] leading-tight tabular-nums text-muted-foreground">
      <Medal tier={tier.tier} earned size={18} />
      {wide ? (
        <span className="truncate">{`${tierWords[tier.tier]} · ${date}`}</span>
      ) : (
        <span className="flex flex-col items-start text-left">
          <span>{tierWords[tier.tier]}</span> <span className="whitespace-nowrap">{date}</span>
        </span>
      )}
    </span>
  );
}

function CategoryTiles({ chapters }: { chapters: Chapter[] }) {
  const headingId = useId();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading id={headingId}>Pages</SectionHeading>
      <ul aria-labelledby={headingId} className="grid gap-3 sm:grid-cols-2">
        {chapters.map((chapter) => (
          <li key={chapter.category.id}>
            <CategoryTile chapter={chapter} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryTile({ chapter: { category, ladders } }: { chapter: Chapter }) {
  const { earned, total } = tiersEarned(ladders);
  return (
    <AppLink
      href={bookHref(category.id)}
      aria-label={`${category.name}, ${earned} of ${total} tiers earned`}
      className="flex h-full items-center gap-3 rounded-xl border bg-card p-3 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span data-hog={category.id} aria-hidden="true" className="shrink-0">
        <category.Emblem size={68} title="" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-display truncate text-lg font-bold leading-tight">{category.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {earned} of {total}
          </span>
        </div>
        <span aria-hidden="true" className="flex flex-wrap gap-1.5">
          {ladders.map((ladder) => (
            <LadderEmblem key={ladder.ladder} ladder={ladder.ladder} best={bestOf(ladder)?.tier ?? null} size={30} />
          ))}
        </span>
        <QuietBar value={earned} max={total} />
      </div>
    </AppLink>
  );
}

function SectionHeading({ id, aside, children }: { id: string; aside?: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="hud-label">
        {children}
      </h2>
      {aside !== undefined && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

function pageOf(ladder: LadderCard, chapters: Chapter[]) {
  const chapter = chapters.find(({ ladders }) => ladders.includes(ladder));
  return chapter === undefined ? bookHref("overview") : bookHref(chapter.category.id);
}
