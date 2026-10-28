import { v, type Infer } from "convex/values";
import type { DayKey } from "../engine/allowance";
import type { AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { PoolQuest, Recipient } from "./pool";

export type QuestAward = { award: AwardId; recipient: MemberId; day: DayKey; at: number; saysWhy: boolean; lastThankedBefore: number | null };

export type CountedAward = Pick<QuestAward, "award" | "recipient" | "day">;

export const questProgressValidator = v.object({ done: v.number(), of: v.number(), unit: v.union(v.literal("kudos"), v.literal("days"), v.literal("people")) });

export type QuestProgress = Infer<typeof questProgressValidator>;

export const movedQuestValidator = v.object({ goal: v.string(), progress: questProgressValidator });

export type MovedQuest = Infer<typeof movedQuestValidator>;

const progressUnits: Record<PoolQuest["progress"]["counts"], QuestProgress["unit"]> = { recognitions: "kudos", people: "people", days: "days" };

export function progressUnitOf({ progress: { counts } }: PoolQuest): QuestProgress["unit"] {
  return progressUnits[counts];
}

export type Moved = { name: string; from: number; to: number; of: number };

export type ProgressRead = { since: number; until: number; mostAwards: number };

export const notThankedForMs = 30 * 24 * 60 * 60 * 1000;

export function counts({ progress: { given } }: PoolQuest, award: QuestAward): boolean {
  return (award.saysWhy || !given.saysWhy) && isRecipient(given.to, award.lastThankedBefore, award.at);
}

export function questProgress({ progress: { counts, target } }: PoolQuest, counted: CountedAward[]): number {
  const distinct = (key: (award: CountedAward) => string) => new Set(counted.map(key)).size;
  const qualifyingRecognitions = () => distinct(({ recipient, day }) => `${recipient}:${day}`);
  const progress = counts === "recognitions" ? qualifyingRecognitions() : counts === "people" ? distinct(({ recipient }) => recipient) : distinct(({ day }) => day);
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
