// PROTOTYPE (Silthus/personal#172): variant C, a quests dock in the sidebar on every page, and a hand of face-down cards on the profile. Never merge.
import { IconCheck } from "@posthog/icons";
import { CardBack } from "../PackCards";
import { doneCount, isDone, questsInPlay, type PrototypeQuest, type QuestsShown } from "./questsFixture";
import { phaseNoteOf, phaseTitleOf, WeekDeadline } from "./QuestParts";

export function SidebarQuestsDock({ quests }: { quests: QuestsShown }) {
  const inPlay = questsInPlay(quests);
  return (
    <section className="qc-dock" aria-labelledby="qc-dock-title">
      <h2 id="qc-dock-title" className="al-side-heading qc-dock-heading">
        <span>{quests.phase === "onboarding" ? "First quests" : "Quests this week"}</span>
        <span>
          {doneCount(inPlay)} of {inPlay.length}
        </span>
      </h2>
      <ul className="qc-dock-list">
        {inPlay.map((quest) => (
          <li key={quest.id} className="qc-dock-row" data-done={isDone(quest) ? "" : undefined}>
            <Pips quest={quest} />
            <span className="qc-dock-goal">{quest.goal}</span>
          </li>
        ))}
      </ul>
      {quests.phase === "weekly" && <p className="qc-dock-foot">{quests.daysLeft} days left</p>}
    </section>
  );
}

function Pips({ quest }: { quest: PrototypeQuest }) {
  if (isDone(quest))
    return (
      <span className="qc-pip-done" role="img" aria-label="Done">
        <IconCheck />
      </span>
    );
  return (
    <span className="qc-pips" role="img" aria-label={`${quest.have} of ${quest.need}`}>
      {Array.from({ length: quest.need }, (_, index) => (
        <span key={index} className="qc-pip" data-held={index < quest.have ? "" : undefined} />
      ))}
    </span>
  );
}

export function ProfileQuestsC({ quests }: { quests: QuestsShown }) {
  const inPlay = questsInPlay(quests);
  return (
    <section className="qc-profile" aria-labelledby="qc-profile-title">
      <header className="qc-profile-head">
        <div>
          <h2 id="qc-profile-title" className="qc-profile-title">{phaseTitleOf(quests)}</h2>
          <p className="qc-quiet">{quests.phase === "weekly" ? "Each quest holds a face-down hoggie. Finish it to put the card on your board." : phaseNoteOf(quests)}</p>
        </div>
        {quests.phase === "weekly" && <WeekDeadline quests={quests} />}
      </header>
      <ol className="qc-hand" data-path={quests.phase === "onboarding" ? "" : undefined}>
        {inPlay.map((quest, index) => (
          <QuestCard key={quest.id} quest={quest} step={quests.phase === "onboarding" ? index + 1 : null} />
        ))}
      </ol>
    </section>
  );
}

function QuestCard({ quest, step }: { quest: PrototypeQuest; step: number | null }) {
  const done = isDone(quest);
  return (
    <li className="qc-card" data-done={done ? "" : undefined}>
      <span className="qc-card-art">
        <CardBack />
        {done && <span className="qc-card-ribbon">Won · on your board</span>}
        {step !== null && <span className="qc-card-step">{step}</span>}
      </span>
      <span className="qc-plate">
        <strong className="qc-plate-goal">{quest.goal}</strong>
        <span className="qc-plate-meta">
          <Pips quest={quest} />
          <span className="qc-quiet">
            {quest.have} of {quest.need} {quest.unit}
          </span>
          <span className="qc-xp">+{quest.xp} XP</span>
        </span>
      </span>
    </li>
  );
}
