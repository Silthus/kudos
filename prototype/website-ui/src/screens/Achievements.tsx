// PROTOTYPE achievements screen: a summary, the closest next tiers, a privacy stub, and every ladder.
import { useState } from "react";
import { ladders, me } from "../data/mock";
import type { Tier } from "../data/types";
import { Bubble, Hand, Hog, Panel, Squiggle, TierMedal } from "../ui";
import { LadderCard, nextTierOf, toGo } from "./achievements/LadderCard";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

export function Achievements(_props: { param?: string }) {
  return (
    <div className="space-y-6">
      <Summary />
      <div className="grid gap-4 lg:grid-cols-2">
        {ladders.map((l) => (
          <LadderCard key={l.id} ladder={l} />
        ))}
      </div>
    </div>
  );
}

function Summary() {
  const allTiers = ladders.flatMap((l) => l.tiers);
  const earned = allTiers.filter((t) => t.earned).length;
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-ph">
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight">Achievements</h1>
            <p className="mt-1 text-sm text-muted">
              <span className="marker font-bold text-ink">
                {earned} of {allTiers.length} tiers
              </span>{" "}
              earned across {ladders.length} ladders.
            </p>
            <Squiggle className="mt-1" width={140} />
          </div>
          <ul className="grid grid-cols-4 gap-2 sm:max-w-md">
            {tierOrder.map((tier) => {
              const ofTier = allTiers.filter((t) => t.tier === tier);
              const got = ofTier.filter((t) => t.earned).length;
              return (
                <li key={tier} className="flex flex-col items-center rounded-md border border-line bg-surface-2 px-1 py-2 text-center">
                  <TierMedal tier={tier} earned={got > 0} size={32} />
                  <span className="font-display text-lg font-black leading-none">
                    {got}
                    <span className="text-xs font-semibold text-faint">/{ofTier.length}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{tier}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">Every tier unlocks an exclusive cosmetic. That's the whole prize: no XP, no skill points, no coins. Just nice things to show off.</p>
        </div>
        <ClosestNext />
      </div>
      <PrivacyStub />
    </section>
  );
}

function ClosestNext() {
  const closest = ladders
    .flatMap((l) => {
      const next = nextTierOf(l);
      return next ? [{ ladder: l, tier: next, closeness: l.count / next.threshold }] : [];
    })
    .sort((a, b) => b.closeness - a.closeness)
    .slice(0, 3);
  const [top] = closest;
  if (!top) return null;
  return (
    <div className="space-y-3 md:w-72">
      <div className="flex items-end gap-2">
        <Hog size={64} mood="happy" className="shrink-0" />
        <Bubble className="mb-6">
          {top.ladder.name} is {toGo(top.ladder, top.tier)} away from {top.tier.name}. So close I can smell it.
        </Bubble>
      </div>
      <div>
        <Hand className="text-lg">closest next tiers</Hand>
        <ul className="mt-1 space-y-1.5">
          {closest.map(({ ladder, tier }) => (
            <li key={ladder.id} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm">
              <TierMedal tier={tier.tier} earned={false} size={24} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-bold">{tier.name}</span> <span className="text-muted">· {ladder.name}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-orange">{toGo(ladder, tier)} to go</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PrivacyStub() {
  const [hidden, setHidden] = useState(me.privacy.hideAchievements);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
      <button
        role="switch"
        aria-checked={hidden}
        onClick={() => setHidden((h) => !h)}
        className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 py-1 pl-1 pr-3 text-sm font-semibold"
      >
        <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${hidden ? "bg-orange" : "bg-line-strong"}`}>
          <span className={`size-4 rounded-full bg-surface shadow transition ${hidden ? "translate-x-4" : ""}`} />
        </span>
        Hidden from teammates: {hidden ? "on" : "off"}
      </button>
      <p className="min-w-0 flex-1 basis-64 text-xs text-muted">
        {hidden
          ? "Done. Your achievements, and any you earn later, never show to anyone else. You still see them here. (Prototype: nothing was saved.)"
          : "Switch it on and your achievements never show to anyone else. You'll still see them here."}
      </p>
    </div>
  );
}
