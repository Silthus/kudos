// Variant E profile: the hero with the equipped hedgehog, a Max line, the stats, one gear panel that swirls between character and inventory, active effects, the public card, then streak and standing; primary is spent on the level and the next action only.
import { useState, type ReactNode } from "react";
import { IconChevronDown, IconLock } from "@posthog/icons";
import { Button, Switch } from "@posthog/quill";
import { ladders, me, perks } from "../../data/mock";
import type { Tier } from "../../data/types";
import { TierMedal } from "../../ui";
import { MaxLine } from "../a/insight";
import { GearPanel } from "./gear-character";
import { ActiveEffects } from "./gear-effects";
import { useGear } from "./hedgehogs";
import { CoinGlyph, CountUp, LevelRing, Panel, SkillPointGlyph, levelProgress, useHud, useMounted } from "./hud";
import { StreakPanel } from "./profile-streak";
import { Standing } from "./profile-standing";
import { RarityName } from "./rarity";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

const bestTiers = ladders
  .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
  .filter((t): t is Tier => t !== undefined)
  .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
  .slice(0, 4);

const readyPerk = perks.find((p) => p.id === "rhythm" && p.state.kind === "available");

const maxFacts = [`${(me.xpNextLevel - me.xp).toLocaleString()} XP to level ${me.level + 1}.`, readyPerk && `${readyPerk.name} is ready to buy and pays off on full weeks.`].filter(Boolean).join(" ");

export function Profile({ param }: { param?: string }) {
  useHud();
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);

  return (
    <div className="flex flex-col gap-6">
      <Hero progress={progress} />
      <MaxLine>{maxFacts}</MaxLine>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock label="Kudos left today" hint="Refills at your midnight">
          <div className="flex items-baseline gap-3">
            <span className="hud-display text-3xl font-bold tabular-nums">
              {me.kudosLeftToday}
              <span className="text-base text-muted-foreground">/{me.dailyAllowance}</span>
            </span>
            <AllowancePips left={me.kudosLeftToday} total={me.dailyAllowance} />
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
        <GearPanel key={param} initialSide={param === "inventory" ? "inventory" : "character"} />
        <div className="flex flex-col gap-6">
          <ActiveEffects />
          <Panel label="What teammates see">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        {!me.streak.hidden && <StreakPanel />}
        <div className="lg:col-start-2">
          <Standing />
        </div>
      </div>
    </div>
  );
}

function Hero({ progress }: { progress: number }) {
  const xpToNext = me.xpNextLevel - me.xp;
  const { hog: equipped, itemIn } = useGear();
  const title = itemIn("title", 0);
  return (
    <section className="hud-rise flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <div className="absolute inset-x-8 bottom-2 h-4 rounded-full bg-foreground/15 blur-lg" aria-hidden />
          <equipped.Art size={176} className="hud-lift relative" title={`Your hedgehog: ${equipped.name}`} />
        </div>
        <RarityName rarity={equipped.rarity} className="text-xs">
          {equipped.name}
        </RarityName>
        <button type="button" onClick={() => document.getElementById("gear")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Change gear
          <IconChevronDown className="size-3 transition-transform group-hover:translate-y-0.5" />
        </button>
      </div>
      <LevelRing level={me.level} progress={progress} size={128} stroke={9} />
      <div className="min-w-0 flex-1">
        <div className="hud-label">Character</div>
        <h1 className="hud-display mt-1 text-4xl font-bold leading-none">{me.name}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {title && (
            <span key={title.id} className="hud-fade inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-sm">
              <RarityName rarity={title.rarity}>{title.name}</RarityName>
            </span>
          )}
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
      <div className="hud-fill h-full rounded-full bg-foreground" style={{ width: `${mounted ? progress : 0}%` }} />
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

function AllowancePips({ left, total }: { left: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${left} of ${total} left`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-3.5 w-2.5 rounded-sm ${i < left ? "bg-foreground" : "bg-muted ring-1 ring-inset ring-border"}`} />
      ))}
    </span>
  );
}

function PublicCard({ hideLevel, hideAchievements }: { hideLevel: boolean; hideAchievements: boolean }) {
  const { hog: equipped, itemIn } = useGear();
  const title = itemIn("title", 0);
  return (
    <div className="hud-lift relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted p-4 shadow-md">
      <div className="flex items-start justify-between">
        <span className="hud-label">Profile card</span>
        {!hideLevel && <span className="hud-display text-lg font-bold leading-none">Lv {me.level}</span>}
      </div>
      <span key={equipped.id} className="hud-pop mx-auto my-2 flex w-fit">
        <equipped.Art size={96} title={equipped.name} />
      </span>
      <div className="text-center">
        <div className="hud-display text-xl font-bold leading-tight">{me.name}</div>
        {title && (
          <div key={title.id} className="hud-fade text-sm font-medium">
            {title.name}
          </div>
        )}
        <div className="text-xs text-muted-foreground">{me.primaryGroup.name}</div>
      </div>
      {!hideAchievements && (
        <div className="mt-3 flex justify-center gap-1.5" aria-label="Best achievement tiers">
          {bestTiers.map((t, i) => (
            <TierMedal key={i} tier={t} earned size={22} />
          ))}
        </div>
      )}
    </div>
  );
}
