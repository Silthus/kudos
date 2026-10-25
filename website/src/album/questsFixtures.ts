import type { DrawnQuest, GettingStartedStep, MondayQuests } from "../../../convex/website/quests";
import type { QuestsRead, QuestsShown } from "./answer";

const saysWhyCounts = "It counts when your message has 5 or more words besides mentions and emoji.";

const once = { done: 0, target: 1 };

const finishedOnce = { done: 1, target: 1 };

function newcomerJourney(): GettingStartedStep[] {
  return [
    { step: "hug", goal: "Give your first hug", hint: "React with your kudos emoji on any message in Slack.", progress: finishedOnce, done: true, reward: null, item: null },
    { step: "first-thanks", goal: "Thank someone and say why", hint: saysWhyCounts, progress: once, done: false, reward: { xp: 50 }, item: null },
    { step: "turn", goal: "Turn the hoggie it left on your board", hint: null, progress: once, done: false, reward: null, item: null },
    { step: "someone-new", goal: "Thank someone you haven't thanked before", hint: "Someone from another team counts, and so does a new joiner.", progress: once, done: false, reward: { xp: 50 }, item: null },
    { step: "two-days", goal: "Say why on 2 different days", hint: saysWhyCounts, progress: { done: 0, target: 2 }, done: false, reward: { xp: 50 }, item: null },
  ];
}

function halfwayJourney(): GettingStartedStep[] {
  const [hug, firstThanks, turn, someoneNew, twoDays] = newcomerJourney();
  return [hug!, { ...firstThanks!, progress: finishedOnce, done: true, item: "turned" }, { ...turn!, progress: finishedOnce, done: true }, someoneNew!, { ...twoDays!, progress: { done: 1, target: 2 } }];
}

function drawnWeek(): DrawnQuest[] {
  return [
    { quest: "say-why-three-times", goal: "Thank someone and say why, 3 times", progress: { done: 2, target: 3 }, done: false, reward: { xp: 20 }, item: null },
    { quest: "two-new", goal: "Thank 2 people you haven't thanked before", progress: { done: 0, target: 2 }, done: false, reward: { xp: 20 }, item: null },
    { quest: "not-in-30-days", goal: "Thank someone you haven't thanked in the last 30 days", progress: finishedOnce, done: true, reward: { xp: 20 }, item: "waiting" },
  ];
}

export const questsFixtures = {
  newcomer: { kind: "monday", firstName: "Sam", next: "first-thanks", daysLeft: 5, quests: { kind: "journey", steps: newcomerJourney() } },
  halfway: { kind: "monday", firstName: "Sam", next: "someone-new", daysLeft: 5, quests: { kind: "journey", steps: halfwayJourney() } },
  week: { kind: "monday", firstName: "Sam", next: null, daysLeft: 3, quests: { kind: "drawn", quests: drawnWeek() } },
} as const satisfies Record<string, MondayQuests>;

export const noQuests: QuestsRead = (asking) => (asking ? { kind: "not-found" } : undefined);

export function fixedQuests(quests: QuestsShown): QuestsRead {
  return (asking) => (asking ? quests : undefined);
}
