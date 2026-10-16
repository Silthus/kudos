import type { GroupQuestCard } from "../shell";

export function sharedRewardSentenceOf({ group, progress, you, state }: GroupQuestCard): string | undefined {
  if (state === "in-progress") return `Everyone in ${group} who takes part gets the reward once ${progress.target} have.`;
  if (state === "finished" && !you) return `${group} finished it. Take part this week to get the reward too.`;
  return undefined;
}
