// PROTOTYPE (#625, round 5): your best achievements, your highest milestone tiers in today's art, and the one you're closest to next. Never merge to main.
import { AppLink } from "../../../../AppLink";
import { AchievementEmblem, TierMedal } from "../../../art";
import type { Album } from "../../../round-3/album";
import { bestOf, dateWords, progressWords, tierWords, toGoWords, type NextUp } from "../../../round-4/pages/milestones/model";
import { bestMilestonesOf, closestNextMilestoneOf, hrefs, shareOf, type Best } from "./profile";

export function Achievements({ album }: { album: Album }) {
  const next = closestNextMilestoneOf(album);
  return (
    <section className="r5p-section" aria-labelledby="r5p-best-title">
      <div className="r5p-section-head">
        <h2 id="r5p-best-title" className="r5p-section-title">
          Best achievements
        </h2>
        <AppLink href={hrefs.milestones} className="r5p-link">
          All milestones →
        </AppLink>
      </div>
      <div className="r5p-best">
        <ul className="r5p-medals">
          {bestMilestonesOf(album).map((best) => (
            <BestCard key={best.milestone.id} best={best} />
          ))}
        </ul>
        {next !== null && <ClosestNext next={next} />}
      </div>
    </section>
  );
}

function BestCard({ best }: { best: Best }) {
  return (
    <li className="r5p-medal" data-tier={best.tier.tier}>
      <AchievementEmblem ladder={best.milestone.emblem} best={best.tier.tier} size={96} />
      <span className="r5p-medal-tier">
        <TierMedal tier={best.tier.tier} earned size={20} />
        {tierWords[best.tier.tier]}
      </span>
      <strong className="r5p-medal-name">{best.tier.name}</strong>
      <span className="r5p-quiet r5p-small">
        {best.milestone.name} · {best.tier.at} {best.milestone.counts}
      </span>
      <span className="r5p-quiet r5p-small">Earned {dateWords(best.tier.earnedAt)}</span>
    </li>
  );
}

function ClosestNext({ next }: { next: NextUp }) {
  const words = progressWords(next.milestone, next.tier);
  return (
    <div className="r5p-next">
      <p className="r5p-eyebrow">Closest next</p>
      <div className="r5p-next-row">
        <AchievementEmblem ladder={next.milestone.emblem} best={bestOf(next.milestone)?.tier ?? null} size={72} />
        <div className="r5p-next-words">
          <span className="r5p-medal-tier">
            <TierMedal tier={next.tier.tier} earned={false} size={18} />
            {tierWords[next.tier.tier]}
          </span>
          <strong className="r5p-medal-name">{next.tier.name}</strong>
          <span className="r5p-quiet r5p-small">{next.milestone.name}</span>
        </div>
      </div>
      <span role="progressbar" aria-label={`${words} for ${next.tier.name}`} aria-valuemin={0} aria-valuemax={next.tier.at} aria-valuenow={Math.min(next.milestone.count, next.tier.at)} className="r5p-bar">
        <span className="r5p-bar-fill" style={{ width: `${Math.max(2, shareOf(next.milestone.count, next.tier.at) * 100)}%` }} />
      </span>
      <p className="r5p-next-way r5p-small">
        <span>{words}</span>
        <span className="r5p-quiet">{toGoWords(next)}</span>
      </p>
    </div>
  );
}
