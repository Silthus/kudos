// Variant B profile: the character sheet, with the hero hedgehog, level ring, stat blocks, loadout slots, active effects and the public card.
import { useState, type ReactNode } from "react";
import { IconLock } from "@posthog/icons";
import { Button, Switch } from "@posthog/quill";
import { HedgehogSuperhero } from "@posthog/brand/hoggies";
import { cosmetics, ladders, me } from "../../data/mock";
import type { CosmeticKind, Tier } from "../../data/types";
import { Rarity, TierMedal } from "../../ui";
import { CoinGlyph, CountUp, LevelRing, Panel, Pips, SkillPointGlyph, Tag, levelProgress, useHud, useMounted } from "./hud";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

const bestTiers = ladders
  .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
  .filter((t): t is Tier => t !== undefined)
  .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
  .slice(0, 4);

const cosmeticNamed = (kind: CosmeticKind, name: string) => cosmetics.find((c) => c.kind === kind && (c.name === name || c.preview === name));

type Slot = { kind: CosmeticKind; label: string; name: string };

const slots: Slot[] = [
  { kind: "title", label: "Title", name: me.loadout.title },
  { kind: "card", label: "Card", name: me.loadout.card },
  ...me.loadout.quips.map((q) => ({ kind: "quip" as const, label: "Quip", name: q })),
  ...me.loadout.emoji.map((e) => ({ kind: "emoji" as const, label: "Emoji", name: e })),
];

export function Profile(_props: { param?: string }) {
  useHud();
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);

  return (
    <div className="flex flex-col gap-6">
      <Hero progress={progress} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock label="Kudos left today" hint="Refills at your midnight">
          <div className="flex items-baseline gap-3">
            <span className="hud-display text-3xl font-bold tabular-nums">
              {me.kudosLeftToday}
              <span className="text-base text-muted-foreground">/{me.dailyAllowance}</span>
            </span>
            <Pips filled={me.kudosLeftToday} total={me.dailyAllowance} />
          </div>
        </StatBlock>
        <StatBlock label="Kudos given" hint="All time">
          <CountUp value={me.kudosGiven} className="hud-display text-3xl font-bold" />
        </StatBlock>
        <StatBlock
          label={
            <>
              <IconLock className="size-3" /> Kudos received
            </>
          }
          hint="Only you see this"
        >
          <CountUp value={me.kudosReceived} className="hud-display text-3xl font-bold" />
        </StatBlock>
        <StatBlock label="Coins" hint="From thoughtful kudos">
          <span className="flex items-center gap-2">
            <CoinGlyph className="size-5" />
            <CountUp value={me.coins} className="hud-display text-3xl font-bold" />
          </span>
        </StatBlock>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <Panel label={`Loadout · ${slots.length} slots`} action={<span className="text-xs text-muted-foreground">What your kudos wear</span>}>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((slot, i) => (
                <InventorySlot key={`${slot.kind}-${i}`} slot={slot} />
              ))}
            </ul>
          </Panel>
          <Panel label="Active effects">
            <ul className="flex flex-col divide-y">
              {!me.streak.hidden && (
                <Effect glyph="🔥" name={`${me.streak.days} workday streak`} detail={`Best ${me.streak.best} · ${me.streak.freezesHeld} streak freeze held`} />
              )}
              {me.boosters.map((b) => (
                <Effect
                  key={b.name}
                  glyph={b.name === "Discovery Lantern" ? "🔍" : "⚡"}
                  name={b.name}
                  detail={b.state === "running" ? `Running · ${b.endsIn} left` : "Ready when you are"}
                  action={b.state === "running" ? <Tag variant="success">Running</Tag> : <Button variant="outline" size="sm">Switch on</Button>}
                />
              ))}
            </ul>
          </Panel>
        </div>

        <Panel label="What teammates see" className="lg:sticky lg:top-24">
          <div className="flex flex-col gap-4">
            <PublicCard hideLevel={hideLevel} hideAchievements={hideAchievements} />
            <label className="flex items-center justify-between gap-3 text-sm">
              Hide my level
              <Switch checked={hideLevel} onCheckedChange={setHideLevel} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              Hide my achievements
              <Switch checked={hideAchievements} onCheckedChange={setHideAchievements} />
            </label>
            <p className="text-xs text-muted-foreground">Hidden things never show to anyone. The card never shows your XP, coins, perks, streak, or kudos given and received.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Hero({ progress }: { progress: number }) {
  const title = cosmeticNamed("title", me.loadout.title);
  const xpToNext = me.xpNextLevel - me.xp;
  return (
    <section className="hud-rise flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
      <div className="relative shrink-0">
        <div className="absolute inset-x-6 bottom-2 h-5 rounded-full bg-primary/30 blur-lg" aria-hidden />
        <HedgehogSuperhero size={176} className="hud-lift relative" title="Your hedgehog" />
      </div>
      <LevelRing level={me.level} progress={progress} size={128} stroke={9} />
      <div className="min-w-0 flex-1">
        <div className="hud-label">Character</div>
        <h1 className="hud-display mt-1 text-4xl font-bold leading-none">{me.name}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-sm font-semibold">
            {me.loadout.title}
            {title && <Rarity rarity={title.rarity} className="text-muted-foreground" />}
          </span>
          <span className="text-sm text-muted-foreground">{me.primaryGroup.name}</span>
        </div>
        <XpBar progress={progress} />
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            <CountUp value={me.xp} className="font-medium text-foreground" /> XP
          </span>
          <span>
            <span className="font-medium text-foreground">{xpToNext.toLocaleString()} XP</span> to level {me.level + 1}
          </span>
        </div>
        {me.skillPointsUnspent > 0 && (
          <Button variant="primary" className="mt-4" onClick={() => (location.hash = "/skills")}>
            <SkillPointGlyph className="size-4 text-primary-foreground" />
            Spend {me.skillPointsUnspent} skill points
          </Button>
        )}
      </div>
    </section>
  );
}

function XpBar({ progress }: { progress: number }) {
  const mounted = useMounted();
  return (
    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border" role="progressbar" aria-label="Progress to the next level" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
      <div className="hud-xp hud-fill h-full rounded-full bg-primary" style={{ width: `${mounted ? progress : 0}%` }} />
    </div>
  );
}

function StatBlock({ label, hint, children }: { label: ReactNode; hint: string; children: ReactNode }) {
  return (
    <Panel label={label} className="hud-lift">
      <div className="leading-none">{children}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
    </Panel>
  );
}

function InventorySlot({ slot }: { slot: Slot }) {
  const cosmetic = cosmeticNamed(slot.kind, slot.name);
  const preview = slot.kind === "emoji" ? slot.name : (cosmetic?.preview ?? "✦");
  return (
    <li className="hud-lift flex min-h-28 flex-col rounded-lg border bg-background p-2.5">
      <span className="hud-label">{slot.label}</span>
      <span className="my-auto block py-1 text-center text-3xl leading-none" aria-hidden>
        {slot.kind === "title" ? <span className="hud-display block text-base font-bold leading-tight">{slot.name}</span> : preview}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium">{slot.kind === "title" ? "Equipped title" : slot.kind === "emoji" ? (cosmetic?.name ?? "Emoji") : slot.name}</span>
        {cosmetic && <Rarity rarity={cosmetic.rarity} className="shrink-0 text-[11px] text-muted-foreground" />}
      </span>
    </li>
  );
}

function Effect({ glyph, name, detail, action }: { glyph: string; name: string; detail: string; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg ring-1 ring-inset ring-border" aria-hidden>
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      {action}
    </li>
  );
}

function PublicCard({ hideLevel, hideAchievements }: { hideLevel: boolean; hideAchievements: boolean }) {
  const card = cosmeticNamed("card", me.loadout.card);
  return (
    <div className="hud-lift relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted p-4 shadow-md">
      <div className="absolute -right-8 -top-8 size-28 rounded-full bg-primary/15 blur-2xl" aria-hidden />
      <div className="flex items-start justify-between">
        <span className="hud-label">Profile card</span>
        {!hideLevel && <span className="hud-display text-lg font-bold leading-none">Lv {me.level}</span>}
      </div>
      <HedgehogSuperhero size={96} className="mx-auto my-2" title="" />
      <div className="text-center">
        <div className="hud-display text-xl font-bold leading-tight">{me.name}</div>
        <div className="text-sm font-medium">{me.loadout.title}</div>
        <div className="text-xs text-muted-foreground">{me.primaryGroup.name}</div>
      </div>
      {!hideAchievements && (
        <div className="mt-3 flex justify-center gap-1.5" aria-label="Best achievement tiers">
          {bestTiers.map((t, i) => (
            <TierMedal key={i} tier={t} earned size={22} />
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{card?.preview}</span>
          <span className="font-medium">{me.loadout.card}</span>
        </span>
        {card && <Rarity rarity={card.rarity} className="text-muted-foreground" />}
      </div>
    </div>
  );
}
