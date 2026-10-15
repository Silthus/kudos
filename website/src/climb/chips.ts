import type { ActivityEntry, KudosGiven, QuestDone } from "../shell";

const mostChips = 4;

type MaybeWaiting = QuestDone & { waiting?: boolean };

export function chipsOf(entries: ActivityEntry[], since: number, grown: number): number[] {
  const earned = entries
    .filter((entry): entry is KudosGiven => entry.kind === "kudosGiven" && entry.at > since)
    .sort((one, other) => one.at - other.at)
    .map(xpFlownBy)
    .filter((xp) => xp > 0);
  const chips: number[] = [];
  let left = grown;
  for (const xp of earned) {
    if (left <= 0) break;
    chips.push(Math.min(xp, left));
    left -= xp;
  }
  if (left > 0) chips.push(left);
  return foldedInto(mostChips, chips);
}

function xpFlownBy({ earned }: KudosGiven) {
  if (earned === null) return 0;
  const bonuses = earned.bonuses.reduce((sum, { xp }) => sum + xp, 0);
  const quests = earned.questsDone.reduce((sum, quest: MaybeWaiting) => (quest.waiting === true ? sum : sum + quest.xp), 0);
  return (earned.xp ?? 0) + bonuses + quests;
}

function foldedInto(most: number, chips: number[]) {
  if (chips.length <= most) return chips;
  const folded = chips.length - most + 1;
  return [chips.slice(0, folded).reduce((sum, xp) => sum + xp, 0), ...chips.slice(folded)];
}
