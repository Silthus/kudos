// PROTOTYPE (#625, round 4): one milestone as today's ladder card: emblem, the way to the next tier, and its four tiers. Never merge to main.
import { AchievementEmblem, TierMedal } from "../../../art";
import type { Milestone, MilestoneTier } from "../../../round-3/album";
import { bestOf, dateWords, isEarned, nextUpOf, tierWords, toGoWords } from "./model";
import { Bar, Progress } from "./parts";

export function LadderCard({ milestone }: { milestone: Milestone }) {
  const best = bestOf(milestone);
  const next = nextUpOf(milestone);
  return (
    <article className="r4ms-ladder" aria-labelledby={`r4ms-ladder-${milestone.id}`}>
      <div className="r4ms-ladder-top">
        <AchievementEmblem ladder={milestone.emblem} best={best?.tier ?? null} size={80} />
        <div className="r4ms-ladder-words">
          <div className="r4ms-ladder-name-row">
            <h2 id={`r4ms-ladder-${milestone.id}`} className="r4ms-ladder-name">
              {milestone.name}
            </h2>
            <span className="r4ms-quiet r4ms-small">{best === null ? "Not started" : `${tierWords[best.tier]} earned ${dateWords(best.earnedAt)}`}</span>
          </div>
          <p className="r4ms-quiet r4ms-first-up">{milestone.counts}</p>
          {next === null ? <Complete milestone={milestone} /> : <Progress next={next} toGo={toGoWords(next)} />}
        </div>
      </div>
      <ol className="r4ms-tiles" aria-label={`${milestone.name} tiers`}>
        {milestone.tiers.map((tier) => (
          <Tile key={tier.tier} tier={tier} isNext={tier.tier === next?.tier.tier} />
        ))}
      </ol>
    </article>
  );
}

function Complete({ milestone }: { milestone: Milestone }) {
  return (
    <div className="r4ms-way">
      <Bar value={1} max={1} label={`Complete, ${milestone.count} ${milestone.counts}`} />
      <p className="r4ms-way-words r4ms-small r4ms-tabular">
        <span>{`${milestone.count} ${milestone.counts}`}</span>
        <span className="r4ms-strong">Every tier earned</span>
      </p>
    </div>
  );
}

function Tile({ tier, isNext }: { tier: MilestoneTier; isNext: boolean }) {
  const earned = isEarned(tier);
  return (
    <li className={`r4ms-tile ${earned ? "r4ms-tile-earned" : isNext ? "r4ms-tile-next" : "r4ms-tile-later"}`}>
      <TierMedal tier={tier.tier} earned={earned} size={28} />
      <span className="r4ms-tile-words">
        <span className="r4ms-quiet r4ms-small">{tierWords[tier.tier]}</span>
        <span className="r4ms-tile-name">{tier.name}</span>
        <span className="r4ms-quiet r4ms-small r4ms-tabular">{earned ? `Earned ${dateWords(tier.earnedAt)}` : `At ${tier.at}`}</span>
      </span>
      {isNext && <span className="r4ms-tag">Next</span>}
    </li>
  );
}
