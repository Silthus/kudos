// PROTOTYPE profile: the member's private view, plus the profile card others see (G28, P65).
import { useState } from "react";
import { ladders, me } from "../data/mock";
import { Avatar, Bubble, Button, Hand, Hog, Panel, Pill, Progress, Rarity, Stat, TierMedal } from "../ui";

export function Profile(_props: { param?: string }) {
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const toNext = me.xpNextLevel - me.xp;
  const earnedTiers = ladders.flatMap((l) => l.tiers.filter((t) => t.earned).map((t) => ({ ...t, ladder: l.name })));
  const bestTiers = ladders
    .map((l) => [...l.tiers].reverse().find((t) => t.earned))
    .filter((t) => t !== undefined)
    .sort((a, b) => ["bronze", "silver", "gold", "diamond"].indexOf(b.tier) - ["bronze", "silver", "gold", "diamond"].indexOf(a.tier))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 shadow-ph md:p-8">
        <div className="dotgrid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <Avatar initials={me.initials} hue={me.hue} size={84} ring />
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight md:text-4xl">{me.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="marker font-semibold">{me.loadout.title}</span>
                <span className="text-faint">·</span>
                <span className="text-muted">{me.primaryGroup.name}</span>
              </div>
            </div>
          </div>
          <div className="md:ml-auto md:w-96">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-faint">Level</div>
                <div className="font-display text-6xl font-black leading-none text-orange">{me.level}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{me.xp.toLocaleString()} XP</div>
                <div className="text-muted">
                  Level {me.level + 1} is <span className="font-bold text-ink">{toNext} XP</span> away
                </div>
              </div>
            </div>
            <div className="mt-2">
              <Progress value={me.xp - me.xpThisLevelStart} max={me.xpNextLevel - me.xpThisLevelStart} height={16} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-semibold text-faint">
              <span>L{me.level}</span>
              <span>L{me.level + 1}</span>
            </div>
          </div>
        </div>
        {me.skillPointsUnspent > 0 && (
          <div className="relative mt-6 flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-orange/50 bg-orange/5 p-4 sm:flex-row sm:items-center">
            <span className="text-2xl">🌱</span>
            <div className="flex-1">
              <div className="font-display text-lg font-extrabold">You have {me.skillPointsUnspent} skill points to spend</div>
              <div className="text-sm text-muted">Spend them on a perk now, or save them for something shiny later. They never expire.</div>
            </div>
            <Button tone="orange" onClick={() => (location.hash = "/skills")}>
              Open the skill tree →
            </Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Kudos left today" value={`${me.kudosLeftToday} / ${me.dailyAllowance}`} hint="Refills at your midnight" />
        <Stat label="Kudos given" value={me.kudosGiven} hint="All time" />
        <Stat label="Kudos received" value={me.kudosReceived} hint="Only you see this" />
        <Stat label="Coins" value={`${me.coins} 🪙`} hint="For thoughtful kudos" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Your profile card"
          actions={<Pill tone="blue">What teammates see</Pill>}
        >
          <p className="mb-4 text-sm text-muted">
            This is all anyone else sees of you, in Slack with <code className="font-mono text-xs">/hedgehug</code> on your name, or here. Never your XP, coins, perks, streak, or kudos given and received.
          </p>
          <div className="flex flex-col gap-5 sm:flex-row">
            <ProfileCard hideLevel={hideLevel} hideAchievements={hideAchievements} tiers={bestTiers.map((t) => t.tier)} />
            <div className="flex-1 space-y-3">
              <Toggle label="Hide my level" on={hideLevel} onChange={setHideLevel} />
              <Toggle label="Hide my achievements" on={hideAchievements} onChange={setHideAchievements} />
              <p className="text-xs text-faint">Hidden things show on no surface other people see. You still see everything here and in your DMs.</p>
              <div className="relative pt-2">
                <Hand className="-rotate-2">try the toggles</Hand>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="This week">
          <ul className="space-y-3 text-sm">
            {!me.streak.hidden && (
              <li className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div className="flex-1">
                  <div className="font-bold">{me.streak.days} workday streak</div>
                  <div className="text-muted">
                    {me.streak.freezesHeld} streak freeze held · Best {me.streak.best}
                  </div>
                </div>
              </li>
            )}
            {me.boosters.map((b) => (
              <li key={b.name} className="flex items-center gap-3">
                <span className="text-2xl">{b.name === "XP booster" ? "🚀" : "🏮"}</span>
                <div className="flex-1">
                  <div className="font-bold">{b.name}</div>
                  <div className="text-muted">{b.state === "running" ? `Running, ${b.endsIn} left` : "Waiting for you to switch it on"}</div>
                </div>
                {b.state === "waiting" && (
                  <Button small tone="plain">
                    Switch on
                  </Button>
                )}
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="text-2xl">🃏</span>
              <div className="flex-1">
                <div className="font-bold">Equipped card</div>
                <div className="flex items-center gap-2 text-muted">
                  {me.loadout.card} <Rarity rarity="uncommon" />
                </div>
              </div>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel
        title="Achievements"
        actions={
          <a href="#/achievements" className="text-sm font-bold text-orange hover:underline">
            All 12 ladders →
          </a>
        }
      >
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-3">
            {earnedTiers.slice(-8).reverse().map((t) => (
              <div key={`${t.ladder}-${t.tier}`} className="flex w-20 flex-col items-center text-center" title={`${t.name} (${t.ladder}, ${t.tier})`}>
                <TierMedal tier={t.tier} earned size={44} />
                <span className="mt-1 text-[11px] font-semibold leading-tight">{t.name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 md:ml-auto">
            <Bubble side="right" className="max-w-56">
              {earnedTiers.length} of 48 tiers so far. Recognition's next tier is close.
            </Bubble>
            <Hog size={72} mood="happy" />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ProfileCard({ hideLevel, hideAchievements, tiers }: { hideLevel: boolean; hideAchievements: boolean; tiers: Array<"bronze" | "silver" | "gold" | "diamond"> }) {
  return (
    <div className="w-full shrink-0 -rotate-1 rounded-lg border-2 border-ink bg-surface-2 p-3 shadow-ph transition hover:rotate-0 sm:w-60">
      <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-line bg-gradient-to-br from-lemon/40 to-orange/30 text-6xl">🙌</div>
      <div className="mt-3 font-display text-lg font-extrabold leading-tight">
        {me.name} <span className="font-sans text-sm font-semibold text-muted">· {me.loadout.title}</span>
      </div>
      <div className="text-sm text-muted">
        {me.primaryGroup.name}
        {!hideLevel && <> · Level {me.level}</>}
      </div>
      {!hideAchievements && (
        <div className="mt-2 flex gap-1">
          {tiers.map((t, i) => (
            <TierMedal key={i} tier={t} earned size={26} />
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm font-semibold">
      {label}
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 rounded-full border border-line-strong transition ${on ? "bg-orange" : "bg-surface"}`}
      >
        <span className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
