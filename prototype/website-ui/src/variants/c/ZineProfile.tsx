// Zine profile: the member's own issue, a cover and four numbered sections, with the card teammates see at the end.
import { useState } from "react";
import { Label, Switch } from "@posthog/quill";
import { HedgehogReading } from "@posthog/brand/hoggies";
import { IconArrowRight } from "@posthog/icons";
import { ladders, me, members } from "../../data/mock";
import type { Tier } from "../../data/types";
import { Initials, Rarity, TierMedal } from "../../ui";
import { Band, Display, Figure, Kicker, Private, PullQuote, SectionHead } from "./zine";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

const received = [
  { text: "thanks for pairing on the flaky test all afternoon, you found the race in ten minutes", by: members[0].name, when: "Tuesday" },
  { text: "you turned my ten-line error message into one sentence and the tickets stopped", by: members[2].name, when: "Last week" },
  { text: "for taking the on-call swap without blinking", by: members[9].name, when: "September" },
];

const dark = { background: "#141414", color: "#ffffff" };

export function ZineProfile(_props: { param?: string }) {
  return (
    <article className="flex flex-col gap-16 md:gap-24">
      <Cover />
      <Numbers />
      <Quotes />
      <ThisWeek />
      <WhatTheySee />
      <Colophon />
    </article>
  );
}

function Cover() {
  const toNext = me.xpNextLevel - me.xp;
  const progress = ((me.xp - me.xpThisLevelStart) / (me.xpNextLevel - me.xpThisLevelStart)) * 100;
  return (
    <Band ink="tangerine">
      <Kicker>
        {me.name}'s edition · Vol. {me.level} · {me.primaryGroup.name}
      </Kicker>
      <div className="mt-6 grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <Display as="h1" className="text-[clamp(3.25rem,11vw,8.5rem)]">
            {me.name.split(" ").map((part) => (
              <span key={part} className="block">
                {part}
              </span>
            ))}
          </Display>
          <p className="mt-6 max-w-md text-lg font-medium leading-snug md:text-xl">
            The {me.loadout.title} of {me.primaryGroup.name}, level {me.level}, {me.kudosGiven} thank-yous in.
          </p>
          <div className="mt-8 max-w-md">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-semibold uppercase tracking-[0.18em]">Level {me.level}</span>
              <span>
                <span className="font-semibold tabular-nums">{toNext} XP</span> to level {me.level + 1}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full bg-black/15" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the next level">
              <div className="h-full bg-current" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums opacity-70">
              <span>{me.xp.toLocaleString()} XP</span>
              <span>{me.xpNextLevel.toLocaleString()} XP</span>
            </div>
          </div>
          {me.skillPointsUnspent > 0 && (
            <a href="#/skills" style={dark} className="mt-8 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:opacity-90">
              Spend {me.skillPointsUnspent} skill points
              <IconArrowRight className="size-4" />
            </a>
          )}
        </div>
        <HedgehogReading size={300} title="A hedgehog reading" className="h-auto w-44 justify-self-end md:w-72" />
      </div>
    </Band>
  );
}

function Numbers() {
  return (
    <section className="px-1 md:px-2">
      <SectionHead no="01" title="By the numbers" />
      <div className="mt-8">
        <Figure size="xl" value={me.kudosGiven} caption="kudos given. That's a lot of hugs." note="All time, counting today." />
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        <Figure value={me.kudosReceived} caption="kudos received." note={<Private />} />
        <Figure
          value={
            <>
              {me.kudosLeftToday}
              <span className="text-3xl opacity-60 md:text-4xl"> of {me.dailyAllowance}</span>
            </>
          }
          caption="kudos left today."
          note="Refills at your midnight."
        />
        <Figure value={me.coins} caption="coins in the jar." note="From thoughtful kudos." />
      </div>
    </section>
  );
}

function Quotes() {
  const [featured, ...rest] = received;
  return (
    <Band ink="lemon">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead no="02" title="In their words" className="flex-1 min-w-48" />
        <Private>Only you see these</Private>
      </div>
      <div className="mt-8 flex flex-col gap-10">
        <PullQuote featured {...featured} />
        <div className="grid gap-8 border-t border-black/20 pt-8 md:grid-cols-2">
          {rest.map((q) => (
            <PullQuote key={q.text} {...q} />
          ))}
        </div>
      </div>
    </Band>
  );
}

function ThisWeek() {
  return (
    <Band ink="blue">
      <SectionHead no="03" title="This week" />
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {!me.streak.hidden && (
          <div>
            <Display as="p" className="text-[clamp(5rem,16vw,11rem)] tabular-nums">
              {me.streak.days}
            </Display>
            <p className="mt-2 text-lg font-semibold md:text-xl">workdays running.</p>
            <p className="mt-1 text-sm opacity-80">
              Best {me.streak.best} · {me.streak.freezesHeld} streak freeze in your pocket.
            </p>
          </div>
        )}
        <ul className="flex flex-col divide-y divide-white/25 self-end">
          {me.boosters.map((b) => (
            <li key={b.name} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-sm opacity-80">{b.state === "running" ? `Running, ${b.endsIn} left` : "Ready when you are"}</div>
              </div>
              {b.state === "running" ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <span className="size-2 animate-pulse rounded-full bg-current" />
                  Running
                </span>
              ) : (
                <button type="button" className="border-2 border-current px-3 py-1 text-sm font-semibold hover:bg-white/10">
                  Switch on
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="font-semibold">{me.loadout.card}</div>
              <div className="text-sm opacity-80">Equipped card</div>
            </div>
            <Rarity rarity="uncommon" />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="font-semibold">{me.loadout.title}</div>
              <div className="text-sm opacity-80">Equipped title</div>
            </div>
            <a href="#/collection" className="text-sm font-semibold underline underline-offset-4">
              Change
            </a>
          </li>
        </ul>
      </div>
    </Band>
  );
}

function WhatTheySee() {
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const bestTiers = ladders
    .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
    .filter((t): t is Tier => t !== undefined)
    .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
    .slice(0, 4);
  return (
    <section className="px-1 md:px-2">
      <SectionHead no="04" title="What they see of you" />
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-center">
        <div className="flex justify-center md:justify-start">
          <div className="w-full max-w-md -rotate-1 border-2 border-foreground bg-card p-5 shadow-[6px_6px_0_0_var(--foreground)]">
            <Kicker className="text-muted-foreground">Profile card · as teammates see it</Kicker>
            <div className="mt-4 flex items-center gap-4">
              <Initials name={me.name} size={52} />
              <div className="min-w-0 flex-1">
                <Display as="p" className="text-2xl">
                  {me.name}
                </Display>
                <p className="mt-1 text-sm text-muted-foreground">
                  {me.loadout.title} · {me.primaryGroup.name}
                  {!hideLevel && ` · Level ${me.level}`}
                </p>
              </div>
            </div>
            {!hideAchievements && (
              <div className="mt-4 flex items-center gap-1.5 border-t border-foreground/20 pt-3">
                {bestTiers.map((t, i) => (
                  <TierMedal key={i} tier={t} earned size={22} />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">best tiers</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">All that teammates see. Never your XP, coins, perks, streak, or kudos given and received.</p>
          <Label className="flex items-center justify-between gap-3 border-t border-foreground/20 pt-4 text-sm font-medium">
            Hide my level
            <Switch checked={hideLevel} onCheckedChange={setHideLevel} />
          </Label>
          <Label className="flex items-center justify-between gap-3 border-t border-foreground/20 pt-4 text-sm font-medium">
            Hide my achievements
            <Switch checked={hideAchievements} onCheckedChange={setHideAchievements} />
          </Label>
        </div>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <p className="border-t-2 border-foreground pt-4 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      Printed for {me.name} alone · {me.kudosGiven} thank-yous and counting
    </p>
  );
}
