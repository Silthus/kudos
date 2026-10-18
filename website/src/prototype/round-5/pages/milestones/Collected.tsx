// PROTOTYPE (#625, round 5): every medal you've collected, newest first, with the day you earned it. Never merge to main.
import { AchievementEmblem } from "../../../art";
import { isFresh } from "../../../round-4/pages/milestones/dated";
import { dateWords, tierWords, type Earned } from "../../../round-4/pages/milestones/model";

export function Collected({ earned, total }: { earned: Earned[]; total: number }) {
  return (
    <section className="r5ms-collected" aria-labelledby="r5ms-collected-title">
      <div className="r5ms-section-head">
        <h2 id="r5ms-collected-title" className="r5ms-section-title">
          Collected
        </h2>
        <p className="r5ms-quiet r5ms-small r5ms-tabular">{`${earned.length} of ${total} medals · newest first`}</p>
      </div>
      {earned.length === 0 ? (
        <p className="r5ms-quiet">Your first medal lands here.</p>
      ) : (
        <ol className="r5ms-medals">
          {earned.map((entry) => (
            <CollectedMedal key={`${entry.milestone.id}:${entry.tier.tier}`} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}

function CollectedMedal({ entry }: { entry: Earned }) {
  const fresh = isFresh(entry);
  return (
    <li className={`r5ms-medal ${fresh ? "r5ms-medal-fresh" : ""}`}>
      <span className={fresh ? "r5ms-stamp" : undefined}>
        <AchievementEmblem ladder={entry.milestone.emblem} best={entry.tier.tier} size={56} />
      </span>
      <span className="r5ms-medal-words">
        <span className="r5ms-medal-name">{entry.tier.name}</span>
        <span className="r5ms-medal-of">{`${tierWords[entry.tier.tier]} · ${entry.milestone.name}`}</span>
        <span className="r5ms-medal-date r5ms-tabular">{fresh ? "Just now" : dateWords(entry.tier.earnedAt)}</span>
      </span>
    </li>
  );
}
