import { describe, expect, test } from "vitest";
import { feasibility, questPool, type DrawFacts, type PoolQuest } from "./pool";

const lastDayWithOneTeammateAlreadyThanked: DrawFacts = { daysLeft: 1, kudosLeftToday: 3, dailyAllowance: 3, peopleLeft: { anyone: 1, "someone-new": 0, "someone-not-thanked-in-30-days": 0 } };

describe("P83: every quest in the pool keeps the guardrails", () => {
  test.each(questPool.quests.map((quest) => [quest.quest, quest] as const))("%s", (_, quest) => {
    expect(breachesOf(quest)).toEqual([]);
  });

  test("P80: the pool holds a quest that needs nothing but the member and stays feasible on the last day of the week with one teammate", () => {
    const fallbacks = questPool.quests.filter((quest) => quest.progress.given.to === "anyone" && feasibility(quest, lastDayWithOneTeammateAlreadyThanked) !== null);

    expect(fallbacks.map(({ quest }) => quest)).toEqual(["say-why"]);
  });

  test("P86 CO6: each quest pays 20 XP and 10 coins, with no item while items haven't shipped, at pool version 2", () => {
    expect(new Set(questPool.quests.map(({ reward }) => JSON.stringify(reward)))).toEqual(new Set([JSON.stringify({ xp: 20, coins: 10, item: null })]));
    expect(questPool.version).toBe("2");
  });

  test("each quest has its own stable ID", () => {
    expect(new Set(questPool.quests.map(({ quest }) => quest)).size).toBe(questPool.quests.length);
  });
});

describe("P83: the guardrails catch a quest that breaks them", () => {
  test.each([
    ["counts 4 of something", { progress: { counts: "recognitions", target: 4, given: { saysWhy: true, to: "anyone" } } }],
    ["names a person", { goal: "Thank Bob and say why." }],
    ["depends on receiving", { goal: "Get thanked by someone and say why." }],
    ["calls a kudos thoughtful", { goal: "Thank someone with a thoughtful kudos and say why." }],
    ["asks to resend", { goal: "Thank someone and say why, then send it again." }],
  ] as const)("a quest that %s breaks them", (_, change) => {
    expect(breachesOf({ ...questPool.quests[0], ...change } as PoolQuest)).not.toEqual([]);
  });
});

describe("P80: a quest is feasible only when the member can finish it alone that week", () => {
  const plenty: DrawFacts = { daysLeft: 7, kudosLeftToday: 3, dailyAllowance: 3, peopleLeft: { anyone: 5, "someone-new": 5, "someone-not-thanked-in-30-days": 5 } };
  const thanking = (to: PoolQuest["progress"]["given"]["to"], counts: PoolQuest["progress"]["counts"], target: number) => questWith({ given: { saysWhy: false, to }, counts, target });

  test("a goal over different days needs that many days left in the week, counting today", () => {
    const threeDays = questWith({ given: { saysWhy: true, to: "anyone" }, counts: "days", target: 3 });

    expect(feasibility(threeDays, { ...plenty, daysLeft: 3 })).toEqual({ peopleLeft: 5, recognitionsLeft: 9, daysLeft: 3 });
    expect(feasibility(threeDays, { ...plenty, daysLeft: 2 })).toBeNull();
  });

  test("a goal over different days can't count today once today's kudos are spent", () => {
    const twoDays = questWith({ given: { saysWhy: true, to: "anyone" }, counts: "days", target: 2 });

    expect(feasibility(twoDays, { ...plenty, daysLeft: 2, kudosLeftToday: 1 })).toEqual({ peopleLeft: 5, recognitionsLeft: 4, daysLeft: 2 });
    expect(feasibility(twoDays, { ...plenty, daysLeft: 2, kudosLeftToday: 0 })).toBeNull();
  });

  test("a goal needs at least as many kudos left this week as it counts, one per recognition", () => {
    const threeTimes = questWith({ given: { saysWhy: true, to: "anyone" }, counts: "recognitions", target: 3 });

    expect(feasibility(threeTimes, { ...plenty, daysLeft: 1, kudosLeftToday: 3 })).toEqual({ peopleLeft: 5, recognitionsLeft: 3 });
    expect(feasibility(threeTimes, { ...plenty, daysLeft: 1, kudosLeftToday: 2 })).toBeNull();
  });

  test("a recognition goal counts one recognition per person and day, so it needs that many across the people and days left", () => {
    const twice = questWith({ given: { saysWhy: true, to: "anyone" }, counts: "recognitions", target: 2 });
    const oneTeammate = { ...plenty, peopleLeft: { ...plenty.peopleLeft, anyone: 1 } };

    expect(feasibility(twice, { ...oneTeammate, daysLeft: 2 })).toEqual({ peopleLeft: 1, recognitionsLeft: 2 });
    expect(feasibility(twice, { ...oneTeammate, daysLeft: 1 })).toBeNull();
  });

  test("a breadth goal needs at least as many people left to meet it as it counts", () => {
    expect(feasibility(thanking("someone-new", "people", 2), { ...plenty, peopleLeft: { ...plenty.peopleLeft, "someone-new": 2 } })).toEqual({ peopleLeft: 2, recognitionsLeft: 14 });
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

function breachesOf({ kind, goal, progress, needs }: PoolQuest): string[] {
  const breaches: string[] = [];
  if (!kinds.includes(kind)) breaches.push(`rewards ${kind}, not breadth, thoughtfulness or participation`);
  if (kind === "breadth" && progress.given.to === "anyone") breaches.push("is breadth but counts anyone");
  if (kind === "thoughtfulness" && !progress.given.saysWhy) breaches.push("is thoughtfulness but doesn't ask to say why");
  if (progress.target > 3) breaches.push(`counts ${progress.target} of something in a week`);
  if (!countable.includes(progress.counts)) breaches.push(`counts ${progress.counts}, not recognitions, people or days`);
  if (Object.keys(progress).some((key) => key !== "given" && key !== "counts" && key !== "target")) breaches.push("depends on more than what the member gives");
  if (Object.keys(progress.given).some((key) => key !== "saysWhy" && key !== "to")) breaches.push("names or picks a person to thank");
  if (!/^Thank (someone|\d people)\b/.test(goal)) breaches.push("names or picks whom to thank instead of someone or a number of people");
  if (/receiv|thanks you|thanked by/i.test(goal)) breaches.push("depends on receiving");
  if (/thoughtful|resend|again|pad|longer/i.test(goal)) breaches.push("breaks P95's honest copy");
  if (progress.given.saysWhy && !goal.includes("say why")) breaches.push("asks to say why without saying so");
  if (needs.some((need) => unshippedNeeds.includes(need))) breaches.push(`needs ${needs.join(", ")}, which haven't shipped`);
  return breaches;
}

function questWith(progress: PoolQuest["progress"]): PoolQuest {
  return { quest: "say-why", kind: "thoughtfulness", goal: "Thank someone and say why.", progress, needs: [], reward: { xp: 20, coins: 0, item: null } };
}
