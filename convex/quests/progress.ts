import type { DayKey } from "../engine/allowance";
import type { AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { PoolQuest, Recipient } from "./pool";

export type QuestAward = { award: AwardId; recipient: MemberId; day: DayKey; at: number; saysWhy: boolean; lastThankedBefore: number | null };

export type CountedAward = Pick<QuestAward, "award" | "recipient" | "day">;

const notThankedForMs = 30 * 24 * 60 * 60 * 1000;

export function counts({ progress: { given } }: PoolQuest, award: QuestAward): boolean {
  return (award.saysWhy || !given.saysWhy) && isRecipient(given.to, award.lastThankedBefore, award.at);
}

export function questProgress({ progress: { counts, target } }: PoolQuest, counted: CountedAward[]): number {
  const distinct = (key: (award: CountedAward) => string) => new Set(counted.map(key)).size;
  const progress = counts === "recognitions" ? counted.length : counts === "people" ? distinct(({ recipient }) => recipient) : distinct(({ day }) => day);
  return Math.min(progress, target);
}

export function isRecipient(to: Recipient, lastThanked: number | null, at: number): boolean {
  switch (to) {
    case "anyone":
      return true;
    case "someone-new":
      return lastThanked === null;
    case "someone-not-thanked-in-30-days":
      return lastThanked === null || lastThanked <= at - notThankedForMs;
  }
}
