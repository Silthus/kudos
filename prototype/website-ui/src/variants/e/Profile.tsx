// Variant E profile: the hero beside the public card on top, the stats and one gear panel in the wide column, and a rail of active effects, streak and standing; what is not unlocked yet shows as a calm teaser, and primary is spent on the level and the next action only.
import type { ReactNode } from "react";
import { IconChevronDown, IconLock } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { me, perks } from "../../data/mock";
import { MaxLine } from "../a/insight";
import { GearPanel } from "./gear-character";
import { ActiveEffects } from "./gear-effects";
import { useGearAtLevel } from "./gear-level";
import { CoinGlyph, CountUp, LevelRing, Panel, SkillPointGlyph, levelProgress, useHud, useMounted } from "./hud";
import { ProfileCardPanel } from "./profile-card";
import { StreakPanel } from "./profile-streak";
import { Standing } from "./profile-standing";
import { RarityName } from "./rarity";
import { unlockOf } from "./unlocks";

const readyPerk = perks.find((p) => p.id === "rhythm" && p.state.kind === "available");

const xpToNext = me.xpNextLevel - me.xp;

export function Profile({ param }: { param?: string }) {
  useHud();
  const { level, skillsOpen } = useGearAtLevel();
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);
  const maxFacts = [`${xpToNext.toLocaleString()} XP to level ${level + 1}.`, skillsOpen && readyPerk && `${readyPerk.name} is ready to buy and pays off on full weeks.`].filter(Boolean).join(" ");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Hero progress={progress} />
        <MaxLine>{maxFacts}</MaxLine>
        <Stats />
        <GearPanel key={param} initialSide={param === "inventory" ? "inventory" : "character"} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <ProfileCardPanel />
        <ActiveEffects />
        {!me.streak.hidden && <StreakPanel />}
        <Standing />
      </div>
    </div>
  );
}

function Hero({ progress }: { progress: number }) {
  const { hog, title, level, gearOpen, skillsOpen } = useGearAtLevel();
  return (
    <section className="hud-rise flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-7 sm:py-4 sm:text-left">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <div className="absolute inset-x-8 bottom-2 h-4 rounded-full bg-foreground/15 blur-lg" aria-hidden />
          <hog.Art size={168} className="hud-lift relative" title={`Your hedgehog: ${hog.name}`} />
        </div>
        <RarityName rarity={hog.rarity} className="text-xs">
          {hog.name}
        </RarityName>
        {gearOpen && (
          <button type="button" onClick={() => document.getElementById("gear")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Change gear
            <IconChevronDown className="size-3 transition-transform group-hover:translate-y-0.5" />
          </button>
        )}
      </div>
      <LevelRing level={level} progress={progress} size={120} stroke={9} />
      <div className="w-full min-w-0 flex-1">
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
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
          <span>
            <CountUp value={me.xp} className="font-medium text-foreground" /> XP
          </span>
          <span>
            <span className="font-medium text-foreground">{xpToNext.toLocaleString()} XP</span> to level {level + 1}
          </span>
        </div>
        {skillsOpen && me.skillPointsUnspent > 0 && (
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

function Stats() {
  const { coinsOpen } = useGearAtLevel();
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatBlock label="Kudos left today" hint="Refills at your midnight">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
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
      {coinsOpen ? (
        <StatBlock label="Coins" hint="From thoughtful kudos">
          <span className="flex items-center gap-2">
            <CoinGlyph className="size-5" />
            <CountUp value={me.coins} className="hud-display text-3xl font-bold" />
          </span>
        </StatBlock>
      ) : (
        <CoinsTeaser />
      )}
    </div>
  );
}

function CoinsTeaser() {
  const coins = unlockOf("coins");
  return (
    <Panel
      label={
        <>
          <IconLock className="size-3" /> Coins
        </>
      }
      className="border-dashed"
    >
      <div className="text-sm font-semibold leading-tight">Coins unlock at level {coins.level}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{coins.how}</div>
    </Panel>
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
