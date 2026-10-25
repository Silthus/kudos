// PROTOTYPE (Silthus/personal#172): small parts the quest variants share. Never merge.
import { IconCheck } from "@posthog/icons";
import { CardBack } from "../PackCards";
import { isDone, type PrototypeQuest, type QuestsShown } from "./questsFixture";

export function QuestProgress({ quest }: { quest: PrototypeQuest }) {
  const share = Math.min(1, quest.have / quest.need);
  return (
    <span className="qp-progress" role="img" aria-label={`${quest.have} of ${quest.need} ${quest.unit}`}>
      <span className="qp-track">
        <span className="qp-fill" style={{ width: `${Math.max(4, share * 100)}%` }} data-done={isDone(quest) ? "" : undefined} />
      </span>
      <span className="qp-count">
        {quest.have}/{quest.need}
      </span>
    </span>
  );
}

export function MiniCardBack({ won }: { won: boolean }) {
  return (
    <span className="qp-mini-card" data-won={won ? "" : undefined}>
      <CardBack />
      {won && (
        <span className="qp-mini-tick" aria-hidden="true">
          <IconCheck />
        </span>
      )}
    </span>
  );
}

export function Reward({ quest }: { quest: PrototypeQuest }) {
  const won = isDone(quest);
  return (
    <span className="qp-reward" aria-label={won ? `Won ${quest.xp} XP and a hoggie` : `Reward: ${quest.xp} XP and a face-down hoggie`}>
      <span className="qp-xp">+{quest.xp} XP</span>
      {quest.hoggie && <MiniCardBack won={won} />}
    </span>
  );
}

export function DoneMark({ quest }: { quest: PrototypeQuest }) {
  return isDone(quest) ? (
    <span className="qp-done-mark" aria-label="Done">
      <IconCheck />
    </span>
  ) : (
    <span className="qp-todo-mark" aria-label="Not yet" />
  );
}

export function WeekDeadline({ quests }: { quests: QuestsShown }) {
  return (
    <span className="qp-deadline">
      {quests.daysLeft} days left · new quests {quests.newQuestsOn} 9:00
    </span>
  );
}

export function phaseTitleOf({ phase }: QuestsShown) {
  return phase === "onboarding" ? "Your first quests" : "This week's quests";
}

export function phaseNoteOf({ phase }: QuestsShown) {
  return phase === "onboarding" ? "Finish these three and weekly quests start the Monday after." : "Three quests drawn for you every Monday.";
}
