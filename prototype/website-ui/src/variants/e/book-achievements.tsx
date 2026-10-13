// Variant E book achievements: an overview with the next tier to earn, a trophy shelf and hedgehog category tiles, and category pages with one emblem row per ladder; primary marks only the next tier.
import type { ReactNode } from "react";
import { HedgehogSelfie } from "@posthog/brand/hoggies";
import { IconArrowRight, IconEmoji, IconLock, IconQuote, IconRibbon } from "@posthog/icons";
import { Switch } from "@posthog/quill";
import { ladders } from "../../data/mock";
import type { Ladder, LadderTier } from "../../data/types";
import { TierMedal, tierLabel } from "../../ui";
import { albumsMineFirst, categories, closestNext, earnedDate, emojiOf, formatDate, laddersIn, nextTierOf, recentlyEarned, rewardOf, tierCount, type Category, type Earned, type NextUp } from "./book-data";
import { artOfCategory, BookArt, LadderEmblem } from "./book-emblems";
import { RarityName } from "./rarity";

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const today = "2026-10-13";
const daysBefore = (iso: string, days: number) => new Date(`${iso}T12:00:00`).getTime() > new Date(`${today}T12:00:00`).getTime() - days * 86_400_000;

const rewardIcon: Record<string, ReactNode> = {
  Title: <IconRibbon className="size-3.5 shrink-0" />,
  Quip: <IconQuote className="size-3.5 shrink-0" />,
  Emoji: <IconEmoji className="size-3.5 shrink-0" />,
};

export function BookBar({ value, max, label, focus = false, className = "" }: { value: number; max: number; label: ReactNode; focus?: boolean; className?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`relative h-5 overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border ${className}`} role="img" aria-label={`${value} of ${max}`}>
      <div className={`${focus ? "bk-bar-focus" : "bk-bar-fill"} hud-fill absolute inset-y-0 left-0 rounded-md`} style={{ width: `${percent}%` }} />
      <span className="relative flex h-full items-center justify-center px-2 text-[11px] font-semibold tabular-nums">{label}</span>
    </div>
  );
}

export function PrivacySwitch({ hidden, onHidden }: { hidden: boolean; onHidden: (hidden: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-3 text-sm">
        Hide my achievements from teammates
        <Switch size="sm" checked={hidden} onCheckedChange={onHidden} />
      </label>
      <p className="text-xs text-muted-foreground">{hidden ? "Hidden. Teammates won't see these, now or later. You still do. Prototype: nothing was saved." : "Teammates see the tiers you've earned on your profile card."}</p>
    </div>
  );
}

function RewardLine({ tier, muted = false }: { tier: LadderTier; muted?: boolean }) {
  const reward = rewardOf(tier);
  const emoji = reward.kind === "Emoji" ? emojiOf(tier) : undefined;
  return (
    <span className={`flex min-w-0 items-center gap-1 text-xs ${muted ? "opacity-70" : ""}`}>
      {emoji ? <span className="shrink-0 text-sm leading-none">{emoji}</span> : <span className="text-muted-foreground">{rewardIcon[reward.kind]}</span>}
      <span className="min-w-0 truncate">
        {reward.kind === "Quip" || reward.kind === "Emoji" ? null : <span className="text-muted-foreground">{reward.kind}: </span>}
        <RarityName rarity={reward.rarity} className="font-medium">
          {reward.kind === "Quip" ? `“${reward.name}”` : reward.name === emoji ? "Emoji" : reward.name}
        </RarityName>
      </span>
    </span>
  );
}

const categoryOf = (ladder: Ladder) => categories.find((c) => c.ladderIds.includes(ladder.id));

export function Overview({ hidden, onHidden }: { hidden: boolean; onHidden: (hidden: boolean) => void }) {
  const all = tierCount(ladders);
  const next = closestNext(ladders);
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
              Across {ladders.length} ladders. Tiers unlock cosmetics, never XP, skill points or coins.
            </p>
          </div>
          <BookBar value={all.earned} max={all.total} label={`${all.earned} / ${all.total}`} />
          <PrivacySwitch hidden={hidden} onHidden={onHidden} />
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
          <li>
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="hud-label">Closest next tier</span>
          <span className="text-xs text-muted-foreground">
            {tier.threshold - ladder.count} more {ladder.counts}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2">
          <TierMedal tier={tier.tier} earned={false} size={18} />
          <span className="hud-display text-lg font-bold leading-tight">{tier.name}</span>
          <span className="text-sm text-muted-foreground">
            {tierLabel[tier.tier]} {ladder.name}
          </span>
        </div>
        <BookBar value={ladder.count} max={tier.threshold} label={`${ladder.count} / ${tier.threshold}`} focus />
        <RewardLine tier={tier} />
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
          <RewardLine tier={tier} />
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

export function CategoryPage({ category, hidden }: { category: Category; hidden: boolean }) {
  const shown = laddersIn(category);
  const count = tierCount(shown);
  const focus = closestNext(shown)?.ladder.id;
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
          {hidden && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconLock className="size-3.5" /> Hidden from teammates.{" "}
              <a href="#/achievements" className="text-foreground underline underline-offset-2">
                Change
              </a>
            </p>
          )}
        </div>
      </header>
      <ol className="flex flex-col gap-3">
        {shown.map((ladder) => (
          <LadderRow key={ladder.id} ladder={ladder} focus={ladder.id === focus} />
        ))}
      </ol>
    </div>
  );
}

function LadderRow({ ladder, focus }: { ladder: Ladder; focus: boolean }) {
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
          <BookBar
            value={next ? ladder.count : 1}
            max={next ? next.threshold : 1}
            focus={focus}
            label={next ? `${ladder.count} / ${next.threshold} · next: ${next.name}` : `All four tiers · ${ladder.count} ${ladder.counts}`}
          />
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ladder.tiers.map((tier, i) => (
          <TierCell key={tier.tier} tier={tier} date={earnedDate(ladder, i)} counts={ladder.counts} focus={focus && tier === next} />
        ))}
      </ol>
    </li>
  );
}

function TierCell({ tier, date, counts, focus }: { tier: LadderTier; date?: string; counts: string; focus: boolean }) {
  const look = tier.earned ? "bg-muted/70" : focus ? "bg-card ring-2 ring-primary" : "bk-slot";
  return (
    <li className={`relative flex flex-col gap-1.5 rounded-lg p-2.5 ${look}`}>
      {focus && <span className="hud-label absolute -top-2 right-2 rounded-full bg-foreground px-1.5 py-0.5 !text-[9px] !text-background">Next</span>}
      <div className="flex items-center gap-2">
        <TierMedal tier={tier.tier} earned={tier.earned} size={24} />
        <div className="min-w-0">
          <div className="hud-label">{tierLabel[tier.tier]}</div>
          <div className={`text-sm font-medium leading-tight ${tier.earned || focus ? "" : "text-muted-foreground"}`}>{tier.name}</div>
        </div>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground" title={`${tier.threshold} ${counts}`}>
        {tier.earned && date ? `Earned ${formatDate(date)}` : `At ${tier.threshold.toLocaleString()}`}
      </div>
      <RewardLine tier={tier} muted={!tier.earned && !focus} />
    </li>
  );
}
