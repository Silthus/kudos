import { describe, expect, test } from "vitest";
import { feasibility, questPool, type DrawFacts, type Quest } from "./pool";

const lastDayWithOneTeammateThankedToday: DrawFacts = { daysLeft: 1, peopleLeft: { anyone: 1, "someone-new": 0, "someone-not-thanked-in-30-days": 0 } };

describe("P83: every quest in the pool keeps the guardrails", () => {
  test.each(questPool.quests.map((quest) => [quest.quest, quest] as const))("%s", (_, quest) => {
    expect(breachesOf(quest)).toEqual([]);
  });

  test("P80: the pool holds at least 3 quests that need nothing but the member and stay feasible on the last day of the week with one teammate", () => {
    const fallbacks = questPool.quests.filter((quest) => quest.progress.given.to === "anyone" && feasibility(quest, lastDayWithOneTeammateThankedToday) !== null);

    expect(fallbacks.length).toBeGreaterThanOrEqual(3);
  });

  test("P86: each quest pays 20 XP, with no coins or item while those haven't shipped", () => {
    expect(new Set(questPool.quests.map(({ reward }) => JSON.stringify(reward)))).toEqual(new Set([JSON.stringify({ xp: 20, coins: 0, item: null })]));
  });

  test("each quest has its own stable ID", () => {
    expect(new Set(questPool.quests.map(({ quest }) => quest)).size).toBe(questPool.quests.length);
  });
});

describe("P80: a quest is feasible only when the member can finish it alone that week", () => {
  const plenty: DrawFacts = { daysLeft: 7, peopleLeft: { anyone: 5, "someone-new": 5, "someone-not-thanked-in-30-days": 5 } };
  const thanking = (to: Quest["progress"]["given"]["to"], counts: Quest["progress"]["counts"], target: number) => questWith({ given: { saysWhy: false, to }, counts, target });

  test("a goal over different days needs that many days left in the week, counting today", () => {
    const threeDays = questWith({ given: { saysWhy: true, to: "anyone" }, counts: "days", target: 3 });

    expect(feasibility(threeDays, { ...plenty, daysLeft: 3 })).toEqual({ peopleLeft: 5, daysLeft: 3 });
    expect(feasibility(threeDays, { ...plenty, daysLeft: 2 })).toBeNull();
  });

  test("a breadth goal needs at least as many people left to meet it as it counts", () => {
    expect(feasibility(thanking("someone-new", "people", 2), { ...plenty, peopleLeft: { ...plenty.peopleLeft, "someone-new": 2 } })).toEqual({ peopleLeft: 2 });
    expect(feasibility(thanking("someone-new", "people", 2), { ...plenty, peopleLeft: { ...plenty.peopleLeft, "someone-new": 1 } })).toBeNull();
    expect(feasibility(thanking("someone-not-thanked-in-30-days", "people", 1), { ...plenty, peopleLeft: { ...plenty.peopleLeft, "someone-not-thanked-in-30-days": 0 } })).toBeNull();
  });

  test("any goal needs someone to thank", () => {
    expect(feasibility(thanking("anyone", "recognitions", 1), { ...plenty, peopleLeft: { ...plenty.peopleLeft, anyone: 0 } })).toBeNull();
  });
});

const kinds = ["breadth", "thoughtfulness", "participation"];
const countable = ["recognitions", "people", "days"];
const unshippedNeeds = ["groups", "chime-ins", "recent-joiners"];

function breachesOf({ kind, goal, progress, needs }: Quest): string[] {
  const breaches: string[] = [];
  if (!kinds.includes(kind)) breaches.push(`rewards ${kind}, not breadth, thoughtfulness or participation`);
  if (kind === "breadth" && progress.given.to === "anyone") breaches.push("is breadth but counts anyone");
  if (kind === "thoughtfulness" && !progress.given.saysWhy) breaches.push("is thoughtfulness but doesn't ask to say why");
  if (progress.target > 3) breaches.push(`counts ${progress.target} of something in a week`);
  if (!countable.includes(progress.counts)) breaches.push(`counts ${progress.counts}, not recognitions, people or days`);
  if (Object.keys(progress).some((key) => key !== "given" && key !== "counts" && key !== "target")) breaches.push("depends on more than what the member gives");
  if (Object.keys(progress.given).some((key) => key !== "saysWhy" && key !== "to")) breaches.push("names or picks a person to thank");
  if (/[<@]|\bU[A-Z0-9]{6,}\b/.test(goal)) breaches.push("names a person in its goal");
  if (/receiv|thanks you|thanked by/i.test(goal)) breaches.push("depends on receiving");
  if (/thoughtful|resend|again|pad|longer/i.test(goal)) breaches.push("breaks P95's honest copy");
  if (progress.given.saysWhy && !goal.includes("say why")) breaches.push("asks to say why without saying so");
  if (needs.some((need) => unshippedNeeds.includes(need))) breaches.push(`needs ${needs.join(", ")}, which haven't shipped`);
  return breaches;
}

function questWith(progress: Quest["progress"]): Quest {
  return { quest: "say-why", kind: "thoughtfulness", goal: "Thank someone and say why.", progress, needs: [], reward: { xp: 20, coins: 0, item: null } };
}
