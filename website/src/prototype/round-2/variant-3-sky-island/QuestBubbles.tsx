// PROTOTYPE (#625): the quest tracker as floating speech bubbles in the sky, Journey first, with a prototype "Simulate +1". Never merge to main.
import type { CSSProperties } from "react";
import type { Quest } from "../../world";
import { Coin, questName } from "./looks";

type Props = { quests: Quest[]; popping: string | null; onProgress: (id: string) => void; onOpenReward: (questId: string) => void; onOpenLog: () => void };

const stateOrder: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };

export function QuestBubbles({ quests, popping, onProgress, onOpenReward, onOpenLog }: Props) {
  const tracked = quests
    .filter((quest) => quest.state !== "claimed")
    .toSorted((first, second) => Number(second.source === "journey") - Number(first.source === "journey") || stateOrder[first.state] - stateOrder[second.state]);
  return (
    <aside className="sk-bubbles" aria-label="Quest tracker">
      <button type="button" className="sk-bubbles-head" onClick={onOpenLog} title="Open the quest log">
        Quests <span>{tracked.length}</span> <small>log ›</small>
      </button>
      <ol className="sk-bubble-list">
        {tracked.map((quest, index) => (
          <li key={quest.id} className={`sk-bubble sk-bubble-${quest.source} sk-bubble-${quest.state} ${popping === quest.id ? "sk-bubble-pop" : ""}`} style={{ "--i": index } as CSSProperties}>
            <span className={`sk-marker sk-marker-${quest.source}`} aria-hidden="true">
              {quest.source === "journey" ? "!" : quest.source === "group" ? "⚑" : "?"}
            </span>
            <div className="sk-bubble-body">
              <p className="sk-bubble-title">
                {quest.source === "journey" && <span className="sk-journey-tag">Journey</span>}
                {quest.source === "group" && <span className="sk-team-tag">Team</span>}
                {questName(quest)}
              </p>
              {quest.source !== "journey" && <p className="sk-bubble-goal">{quest.goal}</p>}
              {quest.state === "finished" ? (
                <button type="button" className="sk-button sk-button-gold sk-button-small sk-reward-ready" onClick={() => onOpenReward(quest.id)}>
                  Complete! Open reward pack
                </button>
              ) : (
                <div className="sk-bubble-progress">
                  <span className="sk-pips" aria-label={`${quest.progress.done} of ${quest.progress.target}`}>
                    {Array.from({ length: quest.progress.target }, (_, pip) => (
                      <span key={pip} className={`sk-pip ${pip < quest.progress.done ? "sk-pip-done" : ""}`} />
                    ))}
                  </span>
                  <span className="sk-bubble-reward">
                    {quest.reward.xp > 0 && <span>+{quest.reward.xp} XP</span>}
                    {quest.reward.coins > 0 && (
                      <span>
                        <Coin size={12} />
                        {quest.reward.coins}
                      </span>
                    )}
                  </span>
                  <button type="button" className="sk-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
                    Simulate +1
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
