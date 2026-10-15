import { useId } from "react";
import { buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { useCountUp } from "../countUp";
import { heroRingAttributes, heroXpBarAttributes } from "../crates/RewardFlight";
import { MemberFace } from "../Face";
import { LevelRing, levelShare } from "../LevelRing";
import { MaxLine } from "../Max";
import { PageTitle } from "../PageTitle";
import { hasGivenNoKudos } from "./FirstKudosNudge";
import { pageOf } from "../features";
import { SlackLink } from "../SlackLink";
import type { MemberProfile, Progression } from "../shell";
import { SkillPointGlyph } from "../skills/glyphs";
import { skillPointsText } from "../skills/perkWords";

export function Hero({ member }: { member: MemberProfile }) {
  const { progression } = member;
  return (
    <section aria-labelledby="home-title" className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-7 sm:py-4 sm:text-left">
      <MemberFace face={member.face} className="size-28" />
      {progression !== null && <HeroRing progression={progression} />}
      <div className="flex w-full min-w-0 flex-1 flex-col items-center sm:items-start">
        <span className="hud-label">Character</span>
        <div className="mt-1 max-w-full">
          <PageTitle tab="Profile" id="home-title" size="hero">
            {member.name ?? "You"}
          </PageTitle>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Thank someone for work you noticed. Mention them in a Slack message with :{member.kudosEmoji}: and say what they did.
        </p>
        <div className="mt-3">
          <SlackLink chatUrl={member.chatUrl} variant={hasGivenNoKudos(member) ? "outline" : "primary"} size="lg">
            Thank someone in Slack
          </SlackLink>
        </div>
        {progression !== null && <XpBar progression={progression} />}
        <KudosLeftToday allowance={member.allowance} />
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          You've given {member.lifetime.given.toLocaleString()} kudos and received {member.lifetime.received.toLocaleString()}.
        </p>
        {hasSkillPointsToSpend(member) && <SpendSkillPoints points={member.skillPoints} />}
        <div className="mt-4 w-full border-t pt-4">
          <MaxLine>{weekInWords(member.thisWeek)}</MaxLine>
        </div>
      </div>
    </section>
  );
}

function HeroRing({ progression }: { progression: Progression }) {
  return (
    <LevelRing progression={progression} size={120} stroke={12} marker={heroRingAttributes()}>
      <span className="flex flex-col items-center gap-1 leading-none">
        <span className="hud-label">Level</span>
        <span className="hud-display text-4xl font-bold tabular-nums">{progression.level}</span>
      </span>
    </LevelRing>
  );
}

function XpBar({ progression }: { progression: Progression }) {
  const xpId = useId();
  const toNextId = useId();
  const { level, xp, levelStartsAt, nextLevelAt, xpToNextLevel } = progression;
  const counted = useCountUp(xp);
  return (
    <div className="mt-4 w-full">
      <div
        role="progressbar"
        aria-labelledby={`${xpId} ${toNextId}`}
        aria-valuemin={levelStartsAt}
        aria-valuemax={nextLevelAt}
        aria-valuenow={xp}
        className="h-3 w-full overflow-hidden rounded-full border border-muted-foreground p-px"
        {...heroXpBarAttributes()}
      >
        <div data-xp-fill className="h-full rounded-full bg-foreground" style={{ width: `${levelShare(progression)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span id={xpId}>
          <span className="font-medium text-foreground">{counted.toLocaleString()}</span> XP
        </span>
        <span id={toNextId}>
          <span className="font-medium text-foreground">{xpToNextLevel.toLocaleString()} XP</span> to level {level + 1}
        </span>
      </div>
    </div>
  );
}

function KudosLeftToday({ allowance: { left, base, refillsAt } }: { allowance: MemberProfile["allowance"] }) {
  const refill = new Date(refillsAt);
  return (
    <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t pt-4 sm:justify-start">
      <span className="hud-label">Kudos left today</span>
      <span className="hud-display text-2xl font-bold leading-none tabular-nums">
        {left}
        <span className="text-sm text-muted-foreground">/{base}</span>
      </span>
      <span role="img" aria-label={`${left} of ${base} kudos left today`} className="inline-flex items-center gap-1">
        {Array.from({ length: base }, (_, pip) => (
          <span key={pip} className={`h-3.5 w-2.5 rounded-sm ${pip < left ? "bg-foreground" : "border border-muted-foreground"}`} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        Refills at <time dateTime={refill.toISOString()}>{refill.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
      </span>
    </div>
  );
}

function hasSkillPointsToSpend(member: MemberProfile): member is MemberProfile & { skillPoints: number } {
  return member.skillPoints !== null && member.skillPoints > 0;
}

function SpendSkillPoints({ points }: { points: number }) {
  return (
    <AppLink href={pageOf("skillTree").href} className={`mt-4 ${buttonVariants({ variant: "outline" })} border-muted-foreground`}>
      <SkillPointGlyph className="size-4" />
      Spend {skillPointsText(points)}
    </AppLink>
  );
}

function weekInWords({ given, received }: MemberProfile["thisWeek"]) {
  if (given === 0 && received === 0) return "No kudos yet this week, so thank someone in Slack for something they did.";
  return `This week you gave ${given} kudos and received ${received}.`;
}
