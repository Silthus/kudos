// PROTOTYPE (#625, round 4): the pieces every milestones layout shares: the page head, the bar, the earned moment. Never merge to main.
import type { ReactNode } from "react";
import { HedgehogStampApproved } from "../../../../hoggies";
import { TierMedal } from "../../../art";
import { useAlbum } from "../../../round-3/album";
import { datedMilestones, useCelebration } from "./dated";
import { earnedNewestFirst, earnedSentence, progressWords, tierWords, tiersEarned, type Earned, type NextUp } from "./model";
import "./milestones.css";

export function useMilestones() {
  const { album } = useAlbum();
  const milestones = datedMilestones(album);
  return { milestones, earned: earnedNewestFirst(milestones), totals: tiersEarned(milestones) };
}

export function MilestonesPage({ look, children }: { look: string; children: ReactNode }) {
  return <div className={`r4ms r4ms-${look}`}>{children}</div>;
}

export function PageHead({ title, lede, aside }: { title: string; lede: string; aside?: ReactNode }) {
  return (
    <header className="r4ms-head">
      <div className="r4ms-head-words">
        <p className="r4ms-eyebrow">Album</p>
        <h1 className="r4ms-title">{title}</h1>
        <p className="r4ms-lede">{lede}</p>
      </div>
      {aside}
    </header>
  );
}

export function Bar({ value, max, label, quiet = false }: { value: number; max: number; label: string; quiet?: boolean }) {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className={`r4ms-bar ${quiet ? "r4ms-bar-quiet" : ""}`}>
      <span className="r4ms-bar-fill" style={{ width: `${share}%` }} />
    </span>
  );
}

export function Progress({ next, toGo }: { next: NextUp; toGo: string }) {
  const words = progressWords(next.milestone, next.tier);
  return (
    <div className="r4ms-way">
      <Bar value={next.milestone.count} max={next.tier.at} label={`${words} for ${next.tier.name}`} />
      <p className="r4ms-way-words r4ms-small r4ms-tabular">
        <span>{words}</span>
        <span className="r4ms-quiet">{toGo}</span>
      </p>
    </div>
  );
}

export function EarnedMoment({ earned }: { earned: Earned[] }) {
  const { waiting, done } = useCelebration(earned);
  if (waiting.length === 0) return null;
  return (
    <section className="r4ms-moment" aria-label="Just earned">
      <div className="r4ms-moment-band">
        <span className="r4ms-moment-label">{`Just earned · ${waiting.map(({ milestone }) => milestone.name).join(", ")}`}</span>
        <div className="r4ms-moment-row">
          <h2 className="r4ms-moment-title">{`You earned ${waiting.map(({ tier }) => tier.name).join(" and ")}`}</h2>
          <span className="r4ms-moment-hog" aria-hidden="true">
            <HedgehogStampApproved size={160} />
          </span>
        </div>
        <ul className="r4ms-moment-tiers">
          {waiting.map((entry) => (
            <li key={`${entry.milestone.id}:${entry.tier.tier}`}>
              <span className="r4ms-plaque">
                <span className="r4ms-stamp">
                  <TierMedal tier={entry.tier.tier} earned size={72} />
                </span>
              </span>
              <span className="r4ms-moment-tier">{`${tierWords[entry.tier.tier]} · ${entry.milestone.name}`}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="r4ms-moment-foot">
        <p>{waiting.map(earnedSentence).join(" ")}</p>
        <button type="button" className="r4ms-button" onClick={done}>
          Keep collecting
        </button>
      </div>
    </section>
  );
}
