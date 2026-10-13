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
  return { award: `award-${awards}` as Id<"awards">, recipient: bob, day: "2026-10-13", at, saysWhy: true, lastThankedBefore: null, ...facts };
}

describe("P84: what a quest counts of a given award", () => {
  test.each<[QuestId, string, Partial<QuestAward>, boolean]>([
    ["say-why", "a kudos that says why", {}, true],
    ["say-why", "a kudos that doesn't say why", { saysWhy: false }, false],
    ["say-why-two-days", "a kudos that says why to someone thanked before", { lastThankedBefore: at - dayMs }, true],
    ["say-why-three-times", "a kudos that doesn't say why", { saysWhy: false }, false],
    ["someone-new", "a kudos to someone never thanked, without saying why", { saysWhy: false }, true],
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
  test.each<[QuestId, string, QuestAward[], number]>([
    ["say-why", "nothing counted", [], 0],
    ["say-why-twice", "one recognition", [award()], 1],
    ["say-why-twice", "two recognitions to the same person on one day", [award(), award()], 2],
    ["say-why-three-times", "four recognitions, held at its goal", [award(), award(), award(), award()], 3],
    ["say-why-two-days", "two recognitions on one day", [award(), award({ recipient: carol })], 1],
    ["say-why-two-days", "recognitions on two different days", [award(), award({ day: "2026-10-14" })], 2],
    ["two-new", "two recognitions to the same person", [award(), award()], 1],
    ["two-new", "recognitions to two people", [award(), award({ recipient: carol })], 2],
  ])("%s after %s is %d", (quest, _, counted, progress) => {
    expect(questProgress(questOf(quest), counted)).toBe(progress);
  });
});
