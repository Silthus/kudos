// PROTOTYPE (#625): one quest log with the Journey first, then weekly and team quests. Never merge to main.
import { IconCheck } from "@posthog/icons";
import { useWorld, type Quest, type QuestSource } from "../world";
import { PackGlyph } from "./PackGlyph";
import { useStage } from "./stage";
import { questDetail, questHeading, questTag, rewardWords } from "./words";

const sourceOrder: QuestSource[] = ["journey", "weekly", "group"];

export function questsInLogOrder(quests: Quest[]) {
  const open = quests.filter(({ state }) => state !== "claimed");
  const claimed = quests.filter(({ state }) => state === "claimed");
  const bySource = (list: Quest[]) => sourceOrder.flatMap((source) => list.filter((quest) => quest.source === source));
  return { open: bySource(open), claimed };
}

export function QuestLog({ quests, showClaimed }: { quests: Quest[]; showClaimed: boolean }) {
  const { open, claimed } = questsInLogOrder(quests);
  return (
    <div className="v3-quest-log">
      <ol className="v3-quest-list">
        {open.map((quest) => (
          <QuestRow key={quest.id} quest={quest} />
        ))}
      </ol>
      {showClaimed && claimed.length > 0 && (
        <details className="v3-claimed">
          <summary>{`Done (${claimed.length})`}</summary>
          <ol className="v3-quest-list">
            {claimed.map((quest) => (
              <QuestRow key={quest.id} quest={quest} />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  return (
    <li className="v3-quest" data-state={quest.state} data-source={quest.source}>
      <span className="v3-tag" data-source={quest.source}>
        {questTag[quest.source]}
      </span>
      <div className="v3-quest-text">
        <p className="v3-quest-heading">{questHeading(quest)}</p>
        <p className="v3-quest-detail">{questDetail(quest)}</p>
      </div>
      <Progress quest={quest} />
      <span className="v3-quest-reward">{rewardWords(quest.reward)}</span>
      <div className="v3-quest-action">
        <QuestAction quest={quest} />
      </div>
    </li>
  );
}

function Progress({ quest: { progress } }: { quest: Quest }) {
  return (
    <div className="v3-quest-progress" aria-label={`${progress.done} of ${progress.target} done`}>
      <span className="v3-steps">
        {Array.from({ length: progress.target }, (_, step) => (
          <span key={step} className="v3-step" data-done={step < progress.done || undefined} />
        ))}
      </span>
      <span className="v3-num v3-quest-count">{`${progress.done}/${progress.target}`}</span>
    </div>
  );
}

function QuestAction({ quest }: { quest: Quest }) {
  const { actions } = useWorld();
  const { openPack } = useStage();
  if (quest.state === "claimed")
    return (
      <span className="v3-claimed-mark">
        <IconCheck className="v3-link-icon" />
        Claimed
      </span>
    );
  if (quest.state === "finished")
    return (
      <button type="button" className="v3-button v3-button-primary v3-open-reward" onClick={() => openPack(`pack:${quest.id}`, `${questTag[quest.source]} reward`)}>
        <PackGlyph size={18} />
        Open reward
      </button>
    );
  return (
    <button type="button" className="v3-simulate" onClick={() => actions.progressQuest(quest.id)} title="Prototype only: there is no Slack here">
      Simulate +1
    </button>
  );
}
