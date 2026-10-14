import type { GroupRef } from "../groups/groups";

export const pickQuestion = "Which group do you count for on the leaderboard?";

export function countsFor({ name }: GroupRef) {
  return `You count for ${name} on the leaderboard.`;
}
