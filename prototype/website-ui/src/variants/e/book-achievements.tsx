// Variant E book achievements: WoW-style pages with one row per ladder, its progress bar, four tier medals and rewards, plus the overview of category bars and recent tiers.
import type { ReactNode } from "react";
import { HedgehogStar } from "@posthog/brand/hoggies";
import { IconEmoji, IconLock, IconQuote, IconRibbon } from "@posthog/icons";
import { Switch } from "@posthog/quill";
import { ladders } from "../../data/mock";
import type { Ladder, LadderTier } from "../../data/types";
import { TierMedal, tierLabel } from "../../ui";
import { albumsMineFirst, categories, earnedDate, formatDate, laddersIn, recentlyEarned, rewardOf, tierCount, type Category } from "./book-data";

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const rewardIcon: Record<string, ReactNode> = {
  Title: <IconRibbon className="size-3.5 shrink-0" />,
  Quip: <IconQuote className="size-3.5 shrink-0" />,
  Emoji: <IconEmoji className="size-3.5 shrink-0" />,
};

export function BookBar({ value, max, label, className = "" }: { value: number; max: number; label: ReactNode; className?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`relative h-5 overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border ${className}`} role="img" aria-label={`${value} of ${max}`}>
      <div className="bk-bar-fill hud-fill absolute inset-y-0 left-0 rounded-md" style={{ width: `${percent}%` }} />
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

export function Overview({ hidden, onHidden }: { hidden: boolean; onHidden: (hidden: boolean) => void }) {
  const all = tierCount(ladders);
  const held = albumsMineFirst.reduce((sum, a) => sum + a.held, 0);
  const pages = albumsMineFirst.reduce((sum, a) => sum + a.pages, 0);
  const complete = albumsMineFirst.filter((a) => a.complete).length;
  return (
    <div className="bk-paper bk-book flex flex-col gap-7 p-4 sm:p-7">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <HedgehogStar size={112} className="mx-auto shrink-0 sm:mx-0" title="" />
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

      <section className="flex flex-col gap-3">
        <h3 className="hud-label">Categories</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => {
            const count = tierCount(laddersIn(category));
            return (
              <li key={category.id}>
                <SummaryLink href={`#/achievements/${category.id}`} name={category.name} value={count.earned} max={count.total} />
              </li>
            );
          })}
          <li>
            <SummaryLink href="#/stickers" name={`Sticker albums · ${complete} of ${albumsMineFirst.length} complete`} value={held} max={pages} />
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="hud-label">Recently earned</h3>
        <ol className="flex flex-col divide-y rounded-xl border bg-card">
          {recentlyEarned.slice(0, 5).map(({ ladder, tier, date }) => {
            const reward = rewardOf(tier.reward);
            return (
              <li key={`${ladder.id}-${tier.tier}`} className="flex items-center gap-3 px-4 py-3">
                <TierMedal tier={tier.tier} earned size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{tier.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {tierLabel[tier.tier]} · {ladder.name} · {reward.kind}: {reward.name}
                  </div>
                </div>
                <time dateTime={date} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDate(date)}
                </time>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function SummaryLink({ href, name, value, max }: { href: string; name: string; value: number; max: number }) {
  return (
    <a href={href} className="hud-lift flex flex-col gap-2 rounded-xl border bg-card p-3 hover:bg-fill-hover">
      <span className="text-sm font-medium">{name}</span>
      <BookBar value={value} max={max} label={`${value} / ${max}`} />
    </a>
  );
}

export function CategoryPage({ category, hidden }: { category: Category; hidden: boolean }) {
  const shown = laddersIn(category);
  const count = tierCount(shown);
  return (
    <div className="bk-paper bk-book flex flex-col gap-4 p-4 sm:p-7">
      <header className="flex flex-col gap-3">
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
  const nextIndex = ladder.tiers.findIndex((t) => !t.earned);
  const next = ladder.tiers[nextIndex];
  const bestIndex = (nextIndex === -1 ? ladder.tiers.length : nextIndex) - 1;
  const best = ladder.tiers[bestIndex];
  const latest = bestIndex >= 0 ? earnedDate(ladder, bestIndex) : undefined;
  return (
    <li className={`rounded-xl border bg-card p-4 ${next ? "" : "ring-1 ring-success-foreground/40"}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <TierMedal tier={best?.tier ?? "bronze"} earned={best !== undefined} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="hud-display text-xl font-bold leading-tight">{ladder.name}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{latest ? `${best ? tierLabel[best.tier] : ""} earned ${formatDate(latest)}` : "Not started"}</span>
          </div>
          <p className="-mt-1.5 text-sm text-muted-foreground">{sentenceCase(ladder.counts)}</p>
          <BookBar value={next ? ladder.count : 1} max={next ? next.threshold : 1} label={next ? `${ladder.count} / ${next.threshold} · next: ${next.name}` : `All four tiers · ${ladder.count} ${ladder.counts}`} />
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ladder.tiers.map((tier, i) => (
          <TierCell key={tier.tier} tier={tier} date={earnedDate(ladder, i)} counts={ladder.counts} />
        ))}
      </ol>
    </li>
  );
}

function TierCell({ tier, date, counts }: { tier: LadderTier; date?: string; counts: string }) {
  const reward = rewardOf(tier.reward);
  return (
    <li className={`flex flex-col gap-1.5 rounded-lg p-2.5 ${tier.earned ? "bg-muted/70" : "bk-slot"}`}>
      <div className="flex items-center gap-2">
        <TierMedal tier={tier.tier} earned={tier.earned} size={24} />
        <div className="min-w-0">
          <div className="hud-label">{tierLabel[tier.tier]}</div>
          <div className={`text-sm font-medium leading-tight ${tier.earned ? "" : "text-muted-foreground"}`}>{tier.name}</div>
        </div>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground" title={`${tier.threshold} ${counts}`}>
        {tier.earned && date ? `Earned ${formatDate(date)}` : `At ${tier.threshold.toLocaleString()}`}
      </div>
      <div className={`flex min-w-0 items-center gap-1 text-xs ${tier.earned ? "" : "text-muted-foreground"}`}>
        {reward.kind === "Emoji" ? <span className="shrink-0 text-sm leading-none">{reward.name}</span> : rewardIcon[reward.kind]}
        <span className="truncate">{reward.kind === "Emoji" ? "Emoji" : reward.kind === "Quip" ? reward.name : `${reward.kind}: ${reward.name}`}</span>
      </div>
    </li>
  );
}
