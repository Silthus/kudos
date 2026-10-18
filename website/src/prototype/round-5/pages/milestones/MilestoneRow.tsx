// PROTOTYPE (#625, round 6): one milestone as one row: what it counts, the next goal and the gold emoji on the left, its four medals climbing left to right. Never merge to main.
import { AchievementEmblem } from "../../../art";
import type { Emoji, Milestone, MilestoneTier } from "../../../round-3/album";
import { bestOf, dateWords, nextUpOf, tierWords, type NextUp } from "../../../round-4/pages/milestones/model";
import { climbedShare, goalWords, stepOf, type Step } from "./climb";

export function MilestoneRow({ milestone, goldEmoji }: { milestone: Milestone; goldEmoji: Emoji | null }) {
  const next = nextUpOf(milestone);
  return (
    <li className="r5ms-row">
      <Plaque milestone={milestone} next={next} goldEmoji={goldEmoji} />
      <div className="r5ms-climb">
        <Rail share={climbedShare(milestone)} />
        <ol className="r5ms-steps" aria-label={`${milestone.name} medals, bronze to diamond`}>
          {milestone.tiers.map((tier) => (
            <TierStep key={tier.tier} milestone={milestone} tier={tier} step={stepOf(milestone, tier)} next={next} />
          ))}
        </ol>
      </div>
    </li>
  );
}

function Plaque({ milestone, next, goldEmoji }: { milestone: Milestone; next: NextUp | null; goldEmoji: Emoji | null }) {
  return (
    <div className="r5ms-plaque">
      <AchievementEmblem ladder={milestone.emblem} best={bestOf(milestone)?.tier ?? null} size={64} />
      <div className="r5ms-plaque-words">
        <h3 className="r5ms-row-name">{milestone.name}</h3>
        <p className="r5ms-count r5ms-tabular">
          <strong>{milestone.count}</strong> <span className="r5ms-quiet">{milestone.counts}</span>
        </p>
        {next === null ? <p className="r5ms-goal r5ms-goal-done">Every medal earned</p> : <p className="r5ms-goal r5ms-tabular">{goalWords(next)}</p>}
        {goldEmoji !== null && <GoldEmoji emoji={goldEmoji} />}
      </div>
    </div>
  );
}

function GoldEmoji({ emoji }: { emoji: Emoji }) {
  return (
    <p className={`r5ms-emoji ${emoji.unlocked ? "r5ms-emoji-unlocked" : ""}`}>
      {emoji.unlocked ? "Gold unlocked " : "Gold unlocks "}
      <code className="r5ms-emoji-name">{emoji.name}</code>
    </p>
  );
}

function Rail({ share }: { share: number }) {
  return (
    <span className="r5ms-rail" aria-hidden="true">
      <span className="r5ms-rail-fill" style={{ width: `${share * 100}%` }} />
    </span>
  );
}

function TierStep({ milestone, tier, step, next }: { milestone: Milestone; tier: MilestoneTier; step: Step; next: NextUp | null }) {
  return (
    <li className={`r5ms-step r5ms-step-${step}`}>
      {step === "next" && <span className="r5ms-tag">Next</span>}
      <span className="r5ms-step-art">
        {step === "next" && next !== null && <Ring share={next.share} />}
        <AchievementEmblem ladder={milestone.emblem} best={tier.tier} size={60} />
      </span>
      <span className="r5ms-step-metal">{tierWords[tier.tier]}</span>
      <span className="r5ms-step-name">{tier.name}</span>
      <span className="r5ms-step-note r5ms-tabular">{stepNote(milestone, tier, step)}</span>
    </li>
  );
}

function stepNote(milestone: Milestone, tier: MilestoneTier, step: Step) {
  if (step === "earned") return dateWords(tier.earnedAt!);
  if (step === "next") return `${Math.min(milestone.count, tier.at)} of ${tier.at}`;
  return `At ${tier.at}`;
}

function Ring({ share }: { share: number }) {
  const circumference = 2 * Math.PI * 46;
  return (
    <svg className="r5ms-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" className="r5ms-ring-track" />
      <circle cx="50" cy="50" r="46" className="r5ms-ring-fill" strokeDasharray={`${circumference * share} ${circumference}`} />
    </svg>
  );
}
