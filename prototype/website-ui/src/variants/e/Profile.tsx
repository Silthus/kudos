// Variant E home: the hero and the gear panel on the left; the public card, quests and where you stand on the right. A feature not yet opened shows as a locked card.
import { IconChevronDown, IconMessage } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { me } from "../../data/mock";
import { GearPanel } from "./gear-character";
import { useGearAtLevel } from "./gear-level";
import { CountUp, LevelRing, Panel, SkillPointGlyph, levelProgress, useHud, useMounted } from "./hud";
import { ProfileCardPanel } from "./profile-card";
import { LockedCard } from "./profile-locked";
import { Standing } from "./profile-standing";
import { QuestCard } from "./quests-card";

const xpToNext = me.xpNextLevel - me.xp;

export function Profile({ param }: { param?: string }) {
  useHud();
  const { questsOpen, standingOpen, inventoryOpen } = useGearAtLevel();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Hero />
        {!questsOpen && <FirstKudosNudge />}
        {inventoryOpen ? <GearPanel key={param} initialSide={param === "inventory" ? "inventory" : "character"} /> : <LockedCard feature="inventory" />}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <ProfileCardPanel />
        {questsOpen ? <QuestCard /> : <LockedCard feature="quests" />}
        {standingOpen ? <Standing /> : <LockedCard feature="leaderboard" />}
      </div>
    </div>
  );
}

function Hero() {
  const { hog, level, inventoryOpen, questsOpen, skillsOpen } = useGearAtLevel();
  const progress = levelProgress(me.xp, me.xpThisLevelStart, me.xpNextLevel);
  return (
    <section className="hud-rise flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-7 sm:py-4 sm:text-left">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <div className="absolute inset-x-8 bottom-2 h-4 rounded-full bg-foreground/15 blur-lg" aria-hidden />
          <hog.Art size={168} className="hud-lift relative" title={`Your hedgehog: ${hog.name}`} />
        </div>
        <span className="text-xs font-medium">{hog.name}</span>
        {inventoryOpen && (
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
        <div className="mt-2 text-sm text-muted-foreground">{me.primaryGroup.name}</div>
        <XpBar progress={progress} />
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
          <span>
            <CountUp value={me.xp} className="font-medium text-foreground" /> XP
          </span>
          <span>
            <span className="font-medium text-foreground">{xpToNext.toLocaleString()} XP</span> to level {level + 1}
          </span>
        </div>
        <KudosLeftToday />
        {questsOpen && (
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            You've given {me.kudosGiven.toLocaleString()} kudos and received {me.kudosReceived.toLocaleString()}.
          </p>
        )}
        {skillsOpen && me.skillPointsUnspent > 0 && (
          <Button variant="outline" className="mt-4" onClick={() => (location.hash = "/skills")}>
            <SkillPointGlyph className="size-4" />
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

function KudosLeftToday() {
  const left = me.kudosLeftToday;
  const total = me.dailyAllowance;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t pt-4 sm:justify-start">
      <span className="hud-label">Kudos left today</span>
      <span className="hud-display text-2xl font-bold leading-none tabular-nums">
        {left}
        <span className="text-sm text-muted-foreground">/{total}</span>
      </span>
      <span className="inline-flex items-center gap-1" role="img" aria-label={`${left} of ${total} left`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-3.5 w-2.5 rounded-sm ${i < left ? "bg-foreground" : "bg-muted ring-1 ring-inset ring-border"}`} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">Refills at your midnight</span>
    </div>
  );
}

function FirstKudosNudge() {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-inset ring-border" aria-hidden>
          <IconMessage className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="hud-display text-lg font-bold leading-tight">Give your first kudos in Slack</h2>
          <p className="text-sm text-muted-foreground">React to a teammate's message with the kudos emoji and say why in five words or more. Every kudos earns XP toward level 2.</p>
        </div>
      </div>
    </Panel>
  );
}
