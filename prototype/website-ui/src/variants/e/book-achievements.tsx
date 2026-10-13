// Variant E book achievements, public to teammates: an overview with the closest next tier, a trophy shelf and hedgehog category tiles, and category pages where every unfinished ladder marks its next tier in primary and its bar says in plain words what earns it.
import type { ReactNode } from "react";
import { HedgehogSelfie } from "@posthog/brand/hoggies";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import type { Ladder, LadderTier } from "../../data/types";
import { TierMedal, tierLabel } from "../../ui";
import { albumsMineFirst, bookLadders, categories, closestNext, earnedDate, formatDate, laddersIn, nextTierOf, recentlyEarned, tierCount, type Category, type Earned, type NextUp } from "./book-data";
import { artOfCategory, BookArt, LadderEmblem } from "./book-emblems";
import { requirementOf } from "./book-requirements";
import { rewardOf, rewardText } from "./book-rewards";
import { CoinGlyph } from "./hud";

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const today = "2026-10-13";
const daysBefore = (iso: string, days: number) => new Date(`${iso}T12:00:00`).getTime() > new Date(`${today}T12:00:00`).getTime() - days * 86_400_000;

export function BookBar({ value, max, label, count, className = "" }: { value: number; max: number; label: ReactNode; count?: ReactNode; className?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border ${count ? "min-h-6" : "h-5"} ${className}`} role={count ? undefined : "img"} aria-label={count ? undefined : `${value} of ${max}`}>
      <div className={`bk-bar-fill hud-fill absolute inset-y-0 left-0 rounded-md`} style={{ width: `${percent}%` }} />
      {count ? (
        <span className="relative flex min-h-6 items-center justify-between gap-3 px-2 py-0.5">
          <span className="min-w-0 text-xs font-semibold leading-tight">{label}</span>
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">{count}</span>
        </span>
      ) : (
        <span className="relative flex h-full items-center justify-center px-2 text-[11px] font-semibold tabular-nums">{label}</span>
      )}
    </div>
  );
}

export function NextMark({ className = "" }: { className?: string }) {
  return <span className={`hud-label rounded-full bg-primary px-1.5 py-0.5 !text-[9px] !text-primary-foreground ${className}`}>Next</span>;
}

function RewardLine({ ladder, tier, muted = false }: { ladder: Ladder; tier: LadderTier; muted?: boolean }) {
  const reward = rewardOf(ladder, tier);
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${muted ? "opacity-70" : ""}`} title={rewardText(reward)}>
      {reward.coins && (
        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums">
          <CoinGlyph className="size-3" />
          {reward.hedgehog ? reward.coins : `${reward.coins} coins`}
        </span>
      )}
      {reward.coins && reward.hedgehog && <span className="text-muted-foreground">+</span>}
      {reward.emoji && (
        <span className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-sm leading-none">{reward.emoji}</span>
          <span className="truncate font-medium">Kudos emoji</span>
        </span>
      )}
      {reward.hedgehog && (
        <span className="flex min-w-0 items-center gap-1">
          <reward.hedgehog.Art size={18} className="-my-1 shrink-0" title="" />
          <span className="truncate font-medium">{reward.hedgehog.name}</span>
        </span>
      )}
    </span>
  );
}

const categoryOf = (ladder: Ladder) => categories.find((c) => c.ladderIds.includes(ladder.id));

export function Overview() {
  const all = tierCount(bookLadders);
  const next = closestNext(bookLadders);
  return (
    <div className="bk-paper bk-book flex flex-col gap-8 p-4 sm:p-7">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <BookArt size={128} className="bk-hog mx-auto shrink-0 sm:mx-0" title="" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <span className="hud-label">Achievements</span>
            <h2 className="hud-display text-3xl font-bold leading-tight">
              {all.earned} of {all.total} tiers earned
            </h2>
            <p className="text-sm text-muted-foreground">
              Across {bookLadders.length} ladders. Tiers reward coins, kudos emoji and hedgehogs.
            </p>
          </div>
          <BookBar value={all.earned} max={all.total} label={`${all.earned} / ${all.total}`} />
        </div>
      </section>

      {next && <NextUpCard next={next} />}

      <TrophyShelf />

      <section className="flex flex-col gap-3">
        <h3 className="hud-label">Pages</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryTile category={category} />
            </li>
          ))}
          <li className="sm:col-span-2">
            <AlbumsTile />
          </li>
        </ul>
      </section>
    </div>
  );
}

function NextUpCard({ next }: { next: NextUp }) {
  const { ladder, tier } = next;
  const category = categoryOf(ladder);
  return (
    <a href={category ? `#/achievements/${category.id}` : "#/achievements"} className="group hud-lift flex items-center gap-4 rounded-xl border bg-card p-3 sm:p-4">
      <LadderEmblem ladder={ladder} size={60} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="hud-label">Closest next tier</span>
        <div className="flex flex-wrap items-center gap-x-2">
          <NextMark />
          <TierMedal tier={tier.tier} earned={false} size={18} />
          <span className="hud-display text-lg font-bold leading-tight">{tier.name}</span>
          <span className="text-sm text-muted-foreground">
            {tierLabel[tier.tier]} {ladder.name}
          </span>
        </div>
        <BookBar value={ladder.count} max={tier.threshold} label={requirementOf(ladder, tier)} count={`${ladder.count.toLocaleString()} / ${tier.threshold.toLocaleString()}`} />
        <RewardLine ladder={ladder} tier={tier} />
      </div>
      <IconArrowRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </a>
  );
}

function latestPerLadder(): Earned[] {
  const seen = new Set<string>();
  return recentlyEarned.filter(({ ladder }) => !seen.has(ladder.id) && seen.add(ladder.id));
}

const shelfEmblem = 76;

function TrophyShelf() {
  const shelf = latestPerLadder().slice(0, 5);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="hud-label">Recently earned</h3>
        <span className="text-xs text-muted-foreground">Newest first</span>
      </div>
      <ol className="relative grid grid-cols-3 gap-x-2 sm:grid-cols-5">
        <span className="bk-plank absolute inset-x-0 h-3 rounded-sm" style={{ top: shelfEmblem - 6 }} aria-hidden />
        {shelf.map((entry, i) => (
          <ShelfItem key={entry.ladder.id} entry={entry} fresh={i === 0 && daysBefore(entry.date, 7)} className={i >= 3 ? "hidden sm:flex" : "flex"} />
        ))}
      </ol>
    </section>
  );
}

function ShelfItem({ entry, fresh, className }: { entry: Earned; fresh: boolean; className: string }) {
  const { ladder, tier, date } = entry;
  const category = categoryOf(ladder);
  return (
    <li className={`${className} min-w-0 flex-col items-center text-center`}>
      <a href={category ? `#/achievements/${category.id}` : "#/achievements"} className="relative z-10 flex flex-col items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
        <LadderEmblem ladder={ladder} size={shelfEmblem} className={fresh ? "bk-emblem-earn" : ""} />
        {fresh && <span className="hud-label absolute -left-1 -top-1 rounded-full bg-foreground px-1.5 py-0.5 !text-[9px] !text-background">New</span>}
      </a>
      <div className="mt-3 flex w-full min-w-0 flex-col items-center gap-0.5 px-1">
        <span className="w-full truncate text-sm font-medium leading-tight">{tier.name}</span>
        <span className="w-full truncate text-[11px] text-muted-foreground">
          {tierLabel[tier.tier]} · {formatDate(date)}
        </span>
        <span className="flex w-full justify-center">
          <RewardLine ladder={ladder} tier={tier} />
        </span>
      </div>
    </li>
  );
}

function CategoryTile({ category }: { category: Category }) {
  const shown = laddersIn(category);
  const count = tierCount(shown);
  const Hog = artOfCategory(category.id);
  return (
    <a href={`#/achievements/${category.id}`} className="bk-tile hud-lift flex h-full items-center gap-3 rounded-xl border bg-card p-3 hover:bg-fill-hover">
      <Hog size={68} className="bk-hog shrink-0" title="" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-display truncate text-lg font-bold leading-tight">{category.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {count.earned}/{count.total}
          </span>
        </div>
        <div className="flex gap-1.5">
          {shown.map((ladder) => (
            <LadderEmblem key={ladder.id} ladder={ladder} size={30} />
          ))}
        </div>
        <BookBar value={count.earned} max={count.total} label="" className="!h-1.5 !ring-0" />
      </div>
    </a>
  );
}

function AlbumsTile() {
  const held = albumsMineFirst.reduce((sum, a) => sum + a.held, 0);
  const pages = albumsMineFirst.reduce((sum, a) => sum + a.pages, 0);
  const complete = albumsMineFirst.filter((a) => a.complete).length;
  return (
    <a href="#/stickers" className="bk-tile hud-lift flex h-full items-center gap-3 rounded-xl border bg-card p-3 hover:bg-fill-hover">
      <HedgehogSelfie size={68} className="bk-hog shrink-0" title="" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-display truncate text-lg font-bold leading-tight">Sticker albums</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {held}/{pages}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {complete} of {albumsMineFirst.length} albums complete
        </span>
        <BookBar value={held} max={pages} label="" className="!h-1.5 !ring-0" />
      </div>
    </a>
  );
}

export function CategoryPage({ category }: { category: Category }) {
  const shown = laddersIn(category);
  const count = tierCount(shown);
  const Hog = artOfCategory(category.id);
  return (
    <div className="bk-paper bk-book flex flex-col gap-5 p-4 sm:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Hog size={104} className="bk-hog mx-auto shrink-0 sm:mx-0" title="" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <span className="hud-label">Achievements</span>
            <h2 className="hud-display text-3xl font-bold leading-tight">{category.name}</h2>
            <p className="text-sm text-muted-foreground">{category.blurb}</p>
          </div>
          <BookBar value={count.earned} max={count.total} label={`${count.earned} / ${count.total} tiers`} />
        </div>
      </header>
      <ol className="flex flex-col gap-3">
        {shown.map((ladder) => (
          <LadderRow key={ladder.id} ladder={ladder} />
        ))}
      </ol>
    </div>
  );
}

function LadderRow({ ladder }: { ladder: Ladder }) {
  const next = nextTierOf(ladder);
  const bestIndex = (next ? ladder.tiers.indexOf(next) : ladder.tiers.length) - 1;
  const best = ladder.tiers[bestIndex];
  const latest = bestIndex >= 0 ? earnedDate(ladder, bestIndex) : undefined;
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <LadderEmblem ladder={ladder} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="hud-display text-xl font-bold leading-tight">{ladder.name}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{latest && best ? `${tierLabel[best.tier]} earned ${formatDate(latest)}` : "Not started"}</span>
          </div>
          <p className="-mt-1.5 text-sm text-muted-foreground">{sentenceCase(ladder.counts)}</p>
          {next ? (
            <BookBar value={ladder.count} max={next.threshold} label={requirementOf(ladder, next)} count={`${ladder.count.toLocaleString()} / ${next.threshold.toLocaleString()}`} />
          ) : (
            <BookBar value={1} max={1} label={<span className="flex items-center gap-1"><IconCheck className="size-3.5" /> Complete</span>} count={`All four tiers · ${ladder.count.toLocaleString()} ${ladder.counts}`} />
          )}
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ladder.tiers.map((tier, i) => (
          <TierCell key={tier.tier} ladder={ladder} tier={tier} date={earnedDate(ladder, i)} counts={ladder.counts} next={tier === next} />
        ))}
      </ol>
    </li>
  );
}

function TierCell({ ladder, tier, date, counts, next }: { ladder: Ladder; tier: LadderTier; date?: string; counts: string; next: boolean }) {
  const look = tier.earned ? "bg-muted/70" : next ? "bg-card ring-2 ring-primary" : "bk-slot";
  return (
    <li className={`relative flex flex-col gap-1.5 rounded-lg p-2.5 ${look}`}>
      {next && <NextMark className="absolute -top-2 right-2" />}
      <div className="flex items-center gap-2">
        <TierMedal tier={tier.tier} earned={tier.earned} size={24} />
        <div className="min-w-0">
          <div className="hud-label">{tierLabel[tier.tier]}</div>
          <div className={`text-sm font-medium leading-tight ${tier.earned || next ? "" : "text-muted-foreground"}`}>{tier.name}</div>
        </div>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground" title={`${tier.threshold} ${counts}`}>
        {tier.earned && date ? `Earned ${formatDate(date)}` : `At ${tier.threshold.toLocaleString()}`}
      </div>
      <RewardLine ladder={ladder} tier={tier} muted={!tier.earned && !next} />
    </li>
  );
}
