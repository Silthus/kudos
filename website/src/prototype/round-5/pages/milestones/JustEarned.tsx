// PROTOTYPE (#625, round 5): the moment a tier is earned in this visit: a lemon band, the stamped medals and confetti. Never merge to main.
import { HedgehogStampApproved } from "../../../../hoggies";
import { AchievementEmblem } from "../../../art";
import { useCelebration } from "../../../round-4/pages/milestones/dated";
import { nextUpOf, tierWords, type Earned } from "../../../round-4/pages/milestones/model";
import { ConfettiBurst, type Confetti } from "../../shell/Celebration";
import { goalWords } from "./climb";

export function JustEarned({ earned }: { earned: Earned[] }) {
  const { waiting, done } = useCelebration(earned);
  if (waiting.length === 0) return null;
  return (
    <section className="r5ms-moment" aria-label="Just earned">
      <div className="r5ms-moment-band">
        <ConfettiBurst kind={confettiFor(waiting)} seed={waiting.length} />
        <p className="r5ms-moment-label">{`Just earned · ${waiting.map(({ milestone }) => milestone.name).join(", ")}`}</p>
        <div className="r5ms-moment-row">
          <h2 className="r5ms-moment-title">{`You earned ${waiting.map(({ tier }) => tier.name).join(" and ")}`}</h2>
          <span className="r5ms-moment-hog" aria-hidden="true">
            <HedgehogStampApproved size={140} />
          </span>
        </div>
        <ul className="r5ms-moment-medals">
          {waiting.map((entry) => (
            <MomentMedal key={`${entry.milestone.id}:${entry.tier.tier}`} entry={entry} />
          ))}
        </ul>
      </div>
      <div className="r5ms-moment-foot">
        <p>{waiting.map(nextGoalSentence).join(" ")}</p>
        <button type="button" className="r5ms-button" onClick={done}>
          Keep collecting
        </button>
      </div>
    </section>
  );
}

function MomentMedal({ entry }: { entry: Earned }) {
  return (
    <li>
      <span className="r5ms-moment-plaque">
        <span className="r5ms-stamp">
          <AchievementEmblem ladder={entry.milestone.emblem} best={entry.tier.tier} size={88} />
        </span>
      </span>
      <span className="r5ms-moment-medal">{`${tierWords[entry.tier.tier]} · ${entry.milestone.name}`}</span>
    </li>
  );
}

function confettiFor(waiting: Earned[]): Confetti {
  return waiting.some(({ tier }) => tier.tier === "gold" || tier.tier === "diamond") ? "gold" : "modest";
}

function nextGoalSentence({ milestone }: Earned) {
  const next = nextUpOf(milestone);
  return next === null ? `Every ${milestone.name} medal is yours.` : `Next in ${milestone.name}: ${goalWords(next)}.`;
}
