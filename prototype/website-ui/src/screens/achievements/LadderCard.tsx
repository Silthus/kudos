// PROTOTYPE one achievement ladder: its count, progress to the next tier, and the four tiers with rewards.
import type { Ladder, LadderTier } from "../../data/types";
import { Hand, Progress, TierMedal } from "../../ui";

export const nextTierOf = (ladder: Ladder) => ladder.tiers.find((t) => !t.earned);

export const toGo = (ladder: Ladder, tier: LadderTier) => tier.threshold - ladder.count;

export function splitReward(reward: string) {
  const [kind, ...rest] = reward.split(": ");
  return { kind, name: rest.join(": ") };
}

const tierWord = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" } as const;

export function LadderCard({ ladder }: { ladder: Ladder }) {
  const next = nextTierOf(ladder);
  const floor = [...ladder.tiers].reverse().find((t) => t.earned)?.threshold ?? 0;
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-ph sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-black leading-tight">{ladder.name}</h3>
          <p className="text-xs text-muted">Counts {ladder.counts}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-black leading-none">{ladder.count}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">so far</div>
        </div>
      </header>
      {next ? (
        <div className="space-y-1.5">
          <Progress value={ladder.count - floor} max={next.threshold - floor} height={10} />
          <p className="text-sm">
            <span className="font-bold">{toGo(ladder, next)} to go</span> <span className="text-muted">to {next.name} ({ladder.count} of {next.threshold})</span>
          </p>
        </div>
      ) : (
        <Hand className="text-lg">every tier done. show-off.</Hand>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {ladder.tiers.map((t) => (
          <TierTile key={t.tier} tier={t} isNext={t === next} />
        ))}
      </ul>
    </article>
  );
}

function TierTile({ tier, isNext }: { tier: LadderTier; isNext: boolean }) {
  const reward = splitReward(tier.reward);
  const diamond = tier.tier === "diamond";
  const frame = diamond ? "border-teal/60 bg-teal/10" : tier.earned ? "border-line-strong bg-surface" : "border-line bg-surface-2";
  return (
    <li className={`relative flex gap-2 rounded-md border p-2.5 ${frame} ${isNext ? "border-dashed !border-orange" : ""}`}>
      {diamond && (
        <span className="pointer-events-none absolute right-1.5 top-1 text-xs text-teal" aria-hidden>
          ✦
        </span>
      )}
      <div className="shrink-0">
        <TierMedal tier={tier.tier} earned={tier.earned} size={34} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-faint">
          {tierWord[tier.tier]} · {tier.threshold}
        </div>
        <div className={`truncate text-sm font-bold leading-tight ${tier.earned ? "" : "text-muted"}`} title={tier.name}>
          {tier.name}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-muted">
          <span className="font-semibold text-ink/80">{reward.kind}</span> {reward.name}
        </div>
        <div className={`mt-1 text-[11px] font-bold ${tier.earned ? "text-[#1f8a35] dark:text-green" : isNext ? "text-orange" : "text-faint"}`}>
          {tier.earned ? "✓ Earned" : isNext ? "Up next" : "Not yet"}
        </div>
      </div>
    </li>
  );
}
