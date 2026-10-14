import type { QuestsRead } from "./questsRead";
import type { MyQuests, QuestSlot, QuestsAnswer, WaitingCrate } from "./shell";

const chatUrl = "https://app.slack.com/client/T1";

const thisWeek = "2026-W42";

const inProgress: QuestSlot = {
  slot: 0,
  kind: "Say why",
  goal: "Thank someone and say why, 3 times.",
  progress: { done: 1, target: 3 },
  reward: { xp: 20 },
  state: "in-progress",
  swapped: false,
  crate: null,
  seen: null,
};

const finished: QuestSlot = {
  slot: 1,
  kind: "Reach out",
  goal: "Thank someone you haven't thanked before.",
  progress: { done: 1, target: 1 },
  reward: { xp: 20 },
  state: "finished",
  swapped: false,
  crate: { kind: "weekly", week: thisWeek, slot: 1 },
  seen: "c41d77",
};

const openedAndSwapped: QuestSlot = {
  slot: 2,
  kind: "Reach out",
  goal: "Thank someone you haven't thanked in the last 30 days.",
  progress: { done: 1, target: 1 },
  reward: { xp: 20 },
  state: "opened",
  swapped: true,
  crate: null,
  seen: "d90a12",
};

const lastWeeksCrate: WaitingCrate = { goal: "Thank someone and say why on 2 different days.", reward: { xp: 20 }, crate: { kind: "weekly", week: "2026-W41", slot: 0 }, seen: "e3b5c8" };

const week: QuestsAnswer = { kind: "quests", slots: [inProgress, finished, openedAndSwapped], waiting: [], chatUrl };

const nextWeek: QuestsAnswer = {
  ...week,
  slots: [{ ...inProgress, goal: "Thank 2 people you haven't thanked before.", kind: "Reach out", progress: { done: 0, target: 2 } }],
};

export const questsFixtures = {
  week,
  weekWithAFinishedQuestEach: { ...week, slots: [{ ...finished, slot: 0, crate: { kind: "weekly", week: thisWeek, slot: 0 }, seen: "f0e1d2" }, finished] },
  weekWithLastWeeksCrate: { ...week, waiting: [lastWeeksCrate] },
  twoQuests: { ...week, slots: [inProgress, finished] },
  nextWeek,
  noDraw: { kind: "quests", slots: [], waiting: [], chatUrl },
  locked: { kind: "locked", level: 2 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyQuests>;

export function fixedQuests(answer: MyQuests): QuestsRead {
  return (asking) => (asking ? answer : undefined);
}
