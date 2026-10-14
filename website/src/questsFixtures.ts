import type { QuestsRead } from "./questsRead";
import type { MyQuests, QuestSlot, QuestsAnswer, WaitingCrate } from "./shell";

const chatUrl = "https://app.slack.com/client/T1";

const thisWeek = "2026-10-12";

const inProgress: QuestSlot = {
  slot: 0,
  quest: { kind: "weekly", week: thisWeek, slot: 0 },
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
  quest: { kind: "weekly", week: thisWeek, slot: 1 },
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
  quest: { kind: "weekly", week: thisWeek, slot: 2 },
  kind: "Reach out",
  goal: "Thank someone you haven't thanked in the last 30 days.",
  progress: { done: 1, target: 1 },
  reward: { xp: 20 },
  state: "opened",
  swapped: true,
  crate: null,
  seen: "d90a12",
};

const joiningIn: QuestSlot = {
  slot: 2,
  quest: { kind: "weekly", week: thisWeek, slot: 2 },
  kind: "Join in",
  goal: "Chime in on a kudos someone else gave.",
  progress: { done: 0, target: 1 },
  reward: { xp: 20 },
  state: "in-progress",
  swapped: false,
  crate: null,
  seen: null,
};

const lastWeeksCrate: WaitingCrate = { goal: "Thank someone and say why on 2 different days.", week: "2026-10-05", reward: { xp: 20 }, crate: { kind: "weekly", week: "2026-10-05", slot: 0 }, seen: "e3b5c8" };

const twoWeeksAgosCrateOfTheSameQuest: WaitingCrate = { ...lastWeeksCrate, week: "2026-09-28", crate: { kind: "weekly", week: "2026-09-28", slot: 2 }, seen: "a7f2c1" };

const week: QuestsAnswer = { kind: "quests", slots: [inProgress, finished, openedAndSwapped], swap: { used: true, available: false }, waiting: [], chatUrl };

const sayingWhyTwice: QuestSlot = { ...joiningIn, kind: "Say why", goal: "Thank someone and say why, 2 times.", progress: { done: 0, target: 2 } };

const weekWithASwapLeft: QuestsAnswer = { ...week, slots: [inProgress, finished, sayingWhyTwice], swap: { used: false, available: true } };

const swappedIn: QuestSlot = { ...sayingWhyTwice, goal: "Thank someone and say why on 2 different days.", swapped: true };

const nextWeek: QuestsAnswer = {
  ...week,
  slots: [{ ...inProgress, goal: "Thank 2 people you haven't thanked before.", kind: "Reach out", progress: { done: 0, target: 2 } }],
  swap: { used: false, available: true },
};

export const questsFixtures = {
  week,
  weekWithAFinishedQuestEach: { ...week, slots: [{ ...finished, slot: 0, quest: { kind: "weekly", week: thisWeek, slot: 0 }, crate: { kind: "weekly", week: thisWeek, slot: 0 }, seen: "f0e1d2" }, finished], swap: { used: false, available: false } },
  weekWithASwapLeft,
  weekAfterTheSwap: { ...weekWithASwapLeft, slots: [inProgress, finished, swappedIn], swap: { used: true, available: false } },
  weekWithNoSwapToOffer: { ...weekWithASwapLeft, swap: { used: false, available: false } },
  weekWithLastWeeksCrate: { ...week, waiting: [lastWeeksCrate] },
  weekWithTheSameQuestWaitingFromTwoWeeks: { ...week, waiting: [twoWeeksAgosCrateOfTheSameQuest, lastWeeksCrate] },
  twoQuests: { ...week, slots: [inProgress, finished], swap: { used: false, available: false } },
  everyKind: { ...week, slots: [inProgress, finished, joiningIn] },
  nextWeek,
  noDraw: { kind: "quests", slots: [], swap: { used: false, available: false }, waiting: [], chatUrl },
  locked: { kind: "locked", level: 2 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyQuests>;

export function fixedQuests(answer: MyQuests): QuestsRead {
  return (asking) => (asking ? answer : undefined);
}
