import type { MondayQuests } from "../../../convex/website/quests";
import { doneOf } from "../album/QuestsPanel";

type Check = { goal: string; how: string | null; done: boolean; reward: { xp: number } | null };

export function QuestsBox({ quests }: { quests: MondayQuests }) {
  const { done, total } = doneOf(quests);
  return (
    <section className="al-week-box" aria-label="This week's quests">
      <h2 className="al-week-box-title">
        This week's quests · {done} of {total}
      </h2>
      <ul className="al-checks">
        {checksOf(quests).map((check) => (
          <QuestCheck key={check.goal} check={check} />
        ))}
      </ul>
    </section>
  );
}

function QuestCheck({ check: { goal, how, done, reward } }: { check: Check }) {
  return (
    <li className="al-check" data-done={done ? "" : undefined}>
      <span className="al-check-box" role="img" aria-label={done ? "Done" : "Not done"} />
      <span className="al-check-words">
        <span className="al-check-goal">{goal}</span>
        {how !== null && <span className="al-check-note">{how}</span>}
        {reward !== null && <span className="al-check-note">{`+${reward.xp} XP and a hoggie`}</span>}
      </span>
    </li>
  );
}

function checksOf({ quests }: MondayQuests): Check[] {
  if (quests.kind === "drawn") return quests.quests.map(({ goal, done, reward }) => ({ goal, how: null, done, reward }));
  return quests.steps.map(({ goal, hint, done, reward }) => ({ goal, how: hint, done, reward }));
}
