import type { QuestsRead } from "./questsRead";
import type { GroupQuestCard, GroupQuestCrate, JourneyStep, MyQuests, QuestSlot, QuestsAnswer, WaitingCrate } from "./shell";

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
  waiting: false,
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
  waiting: false,
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
  waiting: false,
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
  waiting: false,
  swapped: false,
  crate: null,
  seen: null,
};

const lastWeeksCrate: WaitingCrate = { goal: "Thank someone and say why on 2 different days.", group: null, week: "2026-10-05", reward: { xp: 20 }, crate: { kind: "weekly", week: "2026-10-05", slot: 0 }, seen: "e3b5c8", waiting: false };

const twoWeeksAgosCrateOfTheSameQuest: WaitingCrate = { ...lastWeeksCrate, week: "2026-09-28", crate: { kind: "weekly", week: "2026-09-28", slot: 2 }, seen: "a7f2c1" };

const week: QuestsAnswer = { kind: "quests", slots: [inProgress, finished, openedAndSwapped], swap: { used: true, available: false }, group: null, waiting: [], bonus: null, chatUrl };

const ants = "1000000000000000000000userGroups" as GroupQuestCrate["group"];

const groupInProgress: GroupQuestCard = { group: "Ants", goal: "Thank someone and say why.", progress: { done: 1, target: 3 }, you: true, reward: { xp: 0, coins: 15 }, state: "in-progress", waiting: false, crate: null, seen: null };

const groupFinished: GroupQuestCard = { ...groupInProgress, progress: { done: 3, target: 3 }, state: "finished", crate: { kind: "group", group: ants, week: thisWeek }, seen: "9a1b2c" };

const groupFinishedWithoutYou: GroupQuestCard = { ...groupFinished, you: false, crate: null, seen: null };

const groupClaimed: GroupQuestCard = { ...groupFinished, state: "opened", crate: null };

const lastWeeksGroupCrate: WaitingCrate = { goal: "Thank someone outside Ants.", group: "Ants", week: "2026-10-05", reward: { xp: 0, coins: 15 }, crate: { kind: "group", group: ants, week: "2026-10-05" }, seen: "5d6e7f", waiting: false };

const twoWeeksAgosGroupCrate: WaitingCrate = { ...lastWeeksGroupCrate, goal: "Thank someone and say why.", week: "2026-09-28", crate: { kind: "group", group: ants, week: "2026-09-28" }, seen: "8c9d0e" };

export const groupQuests = { groupInProgress, groupFinished, groupFinishedWithoutYou, groupClaimed, lastWeeksGroupCrate };

const sayingWhyTwice: QuestSlot = { ...joiningIn, kind: "Say why", goal: "Thank someone and say why, 2 times.", progress: { done: 0, target: 2 } };

const weekWithASwapLeft: QuestsAnswer = { ...week, slots: [inProgress, finished, sayingWhyTwice], swap: { used: false, available: true } };

const swappedIn: QuestSlot = { ...sayingWhyTwice, goal: "Thank someone and say why on 2 different days.", swapped: true };

const nextWeek: QuestsAnswer = {
  ...week,
  slots: [{ ...inProgress, goal: "Thank 2 people you haven't thanked before.", kind: "Reach out", progress: { done: 0, target: 2 } }],
  swap: { used: false, available: true },
};

const someoneNew: JourneyStep = { step: "someone-new", goal: "Thank someone you haven't thanked before.", hint: null, reward: { xp: 30 }, state: "active", waiting: false, crate: null, seen: null, feature: "leaderboard" };

const firstThanks: JourneyStep = { step: "first-thanks", goal: "Give a kudos that says why.", hint: "It counts when your message has 5 or more words besides mentions and emoji.", reward: { xp: 10 }, state: "active", waiting: false, crate: null, seen: null, feature: null };

const firstQuestFinished: JourneyStep = { step: "first-quest", goal: "Finish a weekly quest.", hint: null, reward: { xp: 20 }, state: "finished", waiting: false, crate: { kind: "journey", step: "first-quest" }, seen: "b2c9e4", feature: "quests" };

const yourEmoji: JourneyStep = { step: "your-emoji", goal: "Give a kudos that says why with one of your kudos emoji.", hint: null, reward: { xp: 40, coins: 20 }, state: "active", waiting: false, crate: null, seen: null, feature: "coins" };

const yourEmojiFinished: JourneyStep = { ...yourEmoji, state: "finished", crate: { kind: "journey", step: "your-emoji" }, seen: "c0175e" };

const payingCoins = { xp: 20, coins: 10 };

const weekPayingCoins: QuestsAnswer = {
  ...week,
  slots: [
    { ...inProgress, reward: payingCoins },
    { ...finished, reward: payingCoins },
    { ...openedAndSwapped, reward: payingCoins },
  ],
  waiting: [{ ...lastWeeksCrate, reward: payingCoins }],
  bonus: yourEmoji,
};

export const bonusSteps = { someoneNew, firstThanks, firstQuestFinished, yourEmoji, yourEmojiFinished };

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
  weekWithABonus: { ...week, bonus: someoneNew },
  weekPayingCoins,
  weekWithAFinishedBonus: { ...week, slots: [inProgress, openedAndSwapped], bonus: firstQuestFinished },
  weekWithTheGroupQuest: { ...week, group: groupInProgress },
  weekWithTheGroupQuestFinished: { ...week, group: groupFinished },
  weekWithTheGroupQuestFinishedWithoutYou: { ...week, group: groupFinishedWithoutYou },
  weekWithTheGroupQuestClaimed: { ...week, group: groupClaimed },
  weekWithLastWeeksGroupCrate: { ...week, group: groupInProgress, waiting: [lastWeeksGroupCrate] },
  weekWithTwoWeeksOfGroupCrates: { ...week, group: groupFinished, waiting: [twoWeeksAgosGroupCrate, lastWeeksCrate, lastWeeksGroupCrate] },
  noDraw: { kind: "quests", slots: [], swap: { used: false, available: false }, group: null, waiting: [], bonus: null, chatUrl },
  locked: { kind: "locked", level: 3 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyQuests>;

export function fixedQuests(answer: MyQuests): QuestsRead {
  return (asking) => (asking ? answer : undefined);
}
