// PROTOTYPE (#625, round 4): layout C, one timeline read from the future down: the next tiers on a dashed line, today, then every medal earned, newest first. Never merge to main.
import { AchievementEmblem, TierMedal } from "../../../art";
import type { Milestone } from "../../../round-3/album";
import { isFresh } from "./dated";
import { bestOf, dateWords, dayWords, earnedSentence, nextUps, tierWords, tiersEarned, type Earned, type NextUp } from "./model";
import { Bar, MilestonesPage, PageHead, Progress, useMilestones } from "./parts";

export function MedalTimeline() {
  const { milestones, earned, totals } = useMilestones();
  return (
    <MilestonesPage look="timeline">
      <PageHead title="Milestones" lede={`${totals.earned} of ${totals.total} medals earned so far. What's next sits at the top; everything you've earned runs down from today.`} />
      <div className="r4ms-timeline-columns">
        <div className="r4ms-spine">
          <NextUpPart upcoming={nextUps(milestones)} />
          <TodayMarker />
          <EarnedPart earned={earned} />
        </div>
        <Summary milestones={milestones} />
      </div>
    </MilestonesPage>
  );
}

function NextUpPart({ upcoming }: { upcoming: NextUp[] }) {
  if (upcoming.length === 0) return null;
  return (
    <section className="r4ms-spine-part r4ms-spine-ahead" aria-labelledby="r4ms-next-up">
      <h2 id="r4ms-next-up" className="r4ms-spine-label">
        Next up
      </h2>
      <ol className="r4ms-spine-list">
        {upcoming.map((next) => (
          <NextUpEntry key={next.milestone.id} next={next} />
        ))}
      </ol>
    </section>
  );
}

function NextUpEntry({ next }: { next: NextUp }) {
  return (
    <li className="r4ms-entry r4ms-entry-ahead">
      <span className="r4ms-node">
        <TierMedal tier={next.tier.tier} earned={false} size={30} />
      </span>
      <div className="r4ms-entry-card">
        <div className="r4ms-entry-head">
          <span className="r4ms-entry-name">{next.tier.name}</span>
          <span className="r4ms-small r4ms-quiet">{`${tierWords[next.tier.tier]} · ${next.milestone.name}`}</span>
        </div>
        <Progress next={next} toGo={`${next.toGo} to go`} />
      </div>
    </li>
  );
}

function TodayMarker() {
  return (
    <p className="r4ms-today">
      <span className="r4ms-today-chip">Today</span>
      <span className="r4ms-small r4ms-quiet">{dayWords(Date.now())}</span>
    </p>
  );
}

function EarnedPart({ earned }: { earned: Earned[] }) {
  if (earned.length === 0) return <p className="r4ms-quiet r4ms-spine-empty">Your first medal lands here.</p>;
  return (
    <section className="r4ms-spine-part" aria-label="Medals earned, newest first">
      {daysOf(earned).map(({ label, entries }) => (
        <div key={label} className="r4ms-spine-day">
          <h3 className="r4ms-spine-label">{label}</h3>
          <ol className="r4ms-spine-list">
            {entries.map((entry) => (
              <EarnedEntry key={`${entry.milestone.id}:${entry.tier.tier}`} entry={entry} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function EarnedEntry({ entry }: { entry: Earned }) {
  const fresh = isFresh(entry);
  return (
    <li className={`r4ms-entry ${fresh ? "r4ms-entry-fresh" : ""}`}>
      <span className="r4ms-node">
        <TierMedal tier={entry.tier.tier} earned size={30} />
      </span>
      <div className="r4ms-entry-card r4ms-entry-earned">
        <span className={fresh ? "r4ms-stamp" : undefined}>
          <AchievementEmblem ladder={entry.milestone.emblem} best={entry.tier.tier} size={fresh ? 88 : 64} />
        </span>
        <div className="r4ms-entry-words">
          {fresh && <span className="r4ms-tag r4ms-tag-orange">Just earned</span>}
          <span className="r4ms-entry-name">{entry.tier.name}</span>
          <span className="r4ms-small r4ms-quiet">{`${tierWords[entry.tier.tier]} · ${entry.milestone.name}`}</span>
          <span className="r4ms-small">{earnedSentence(entry)}</span>
        </div>
      </div>
    </li>
  );
}

function daysOf(earned: Earned[]) {
  const days: { label: string; entries: Earned[] }[] = [];
  for (const entry of earned) {
    const label = isFresh(entry) ? "Just now" : dateWords(entry.tier.earnedAt);
    const last = days.at(-1);
    if (last?.label === label) last.entries.push(entry);
    else days.push({ label, entries: [entry] });
  }
  return days;
}

function Summary({ milestones }: { milestones: Milestone[] }) {
  const totals = tiersEarned(milestones);
  return (
    <aside className="r4ms-summary" aria-label="Medals per milestone">
      <p className="r4ms-eyebrow">Your medals</p>
      <p className="r4ms-summary-count">
        <strong>{totals.earned}</strong>
        <span className="r4ms-quiet">{` of ${totals.total}`}</span>
      </p>
      <Bar value={totals.earned} max={totals.total} label={`${totals.earned} of ${totals.total} medals earned`} />
      <ul className="r4ms-summary-list">
        {milestones.map((milestone) => (
          <SummaryRow key={milestone.id} milestone={milestone} />
        ))}
      </ul>
    </aside>
  );
}

function SummaryRow({ milestone }: { milestone: Milestone }) {
  return (
    <li className="r4ms-summary-row">
      <AchievementEmblem ladder={milestone.emblem} best={bestOf(milestone)?.tier ?? null} size={40} />
      <span className="r4ms-summary-name">{milestone.name}</span>
      <span className="r4ms-summary-medals" aria-label={`${tiersEarned([milestone]).earned} of 4 tiers`}>
        {milestone.tiers.map((tier) => (
          <TierMedal key={tier.tier} tier={tier.tier} earned={tier.earnedAt !== null} size={16} />
        ))}
      </span>
    </li>
  );
}
