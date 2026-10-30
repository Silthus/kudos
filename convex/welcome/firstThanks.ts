import type { Quest } from "../quests/step";

export function isTheFirstThanks(quest: Quest): boolean {
  return quest.kind === "journey" && quest.step === "first-thanks";
}
