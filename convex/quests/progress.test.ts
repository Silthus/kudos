import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { questOf, type QuestId } from "./pool";
import { counts, questProgress, type QuestAward } from "./progress";

const at = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const bob = "bob" as Id<"members">;
const carol = "carol" as Id<"members">;

let awards = 0;

function award(facts: Partial<QuestAward> = {}): QuestAward {
  awards += 1;
  return { award: `award-${awards}` as Id<"awards">, recipient: bob, day: "2026-10-13", at, saysWhy: true, firstSaidWhyThatDay: true, lastThankedBefore: null, ...facts };
}

describe("P84: what a quest counts of a given award", () => {
  test.each<[QuestId, string, Partial<QuestAward>, boolean]>([
    ["say-why", "a kudos that says why", {}, true],
    ["say-why", "a kudos that doesn't say why", { saysWhy: false, firstSaidWhyThatDay: false }, false],
    ["say-why-two-days", "a kudos that says why to someone thanked before", { lastThankedBefore: at - dayMs }, true],
    ["say-why-three-times", "a kudos that doesn't say why", { saysWhy: false, firstSaidWhyThatDay: false }, false],
    ["someone-new", "a kudos to someone never thanked, without saying why", { saysWhy: false, firstSaidWhyThatDay: false }, true],
    ["someone-new", "a kudos to someone thanked before", { lastThankedBefore: at - 60 * dayMs }, false],
    ["two-new", "a kudos to someone never thanked", {}, true],
    ["not-in-30-days", "a kudos to someone never thanked", {}, true],
    ["not-in-30-days", "a kudos to someone last thanked 30 days before", { lastThankedBefore: at - 30 * dayMs }, true],
    ["not-in-30-days", "a kudos to someone thanked 29 days before", { lastThankedBefore: at - 29 * dayMs }, false],
  ])("%s counts %s: %s", (quest, _, facts, counted) => {
    expect(counts(questOf(quest), award(facts))).toBe(counted);
  });
});

describe("P84: a quest's progress over the awards it counted", () => {
  test.each<[QuestId, string, number, QuestAward[]]>([
    ["say-why", "nothing counted", 0, []],
    ["say-why-twice", "one recognition", 1, [award()]],
    ["say-why-twice", "two kudos to the same person on one day, one qualifying recognition", 1, [award(), award()]],
    ["say-why-twice", "kudos to two people on one day", 2, [award(), award({ recipient: carol })]],
    ["say-why-twice", "kudos to the same person on two days", 2, [award(), award({ day: "2026-10-14" })]],
    ["say-why-three-times", "four recognitions, held at its goal", 3, [award(), award({ recipient: carol }), award({ day: "2026-10-14" }), award({ day: "2026-10-15" })]],
    ["say-why-two-days", "two recognitions on one day", 1, [award(), award({ recipient: carol })]],
    ["say-why-two-days", "recognitions on two different days", 2, [award(), award({ day: "2026-10-14" })]],
    ["two-new", "two recognitions to the same person", 1, [award(), award()]],
    ["two-new", "recognitions to two people", 2, [award(), award({ recipient: carol })]],
  ])("%s after %s is %d", (quest, _, progress, counted) => {
    expect(questProgress(questOf(quest), counted)).toBe(progress);
  });
});
