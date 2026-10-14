import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { allowanceDay } from "../engine/allowance";
import type { LadderId } from "./ladders";
import { markOf, stepOf, type MeasuredAward } from "./measures";

const alice = memberId("alice");
const bob = memberId("bob");
const carol = memberId("carol");
const dave = memberId("dave");
const erin = memberId("erin");

describe("P58 P59: each ladder counts its awards on the giver's days and months", () => {
  test.each<[LadderId, string, MeasuredAward[], number]>([
    ["generosity", "kudos units given", [thanks(bob, "2026-10-13", 2), thanks(bob, "2026-10-13", 3)], 5],
    ["recognition", "kudos units received", [thanks(bob, "2026-10-13", 2), thanks(carol, "2026-10-14", 1)], 3],
    ["connections", "three different people", [thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13"), thanks(dave, "2026-10-14")], 3],
    ["connections", "the same person on two days counts once", [thanks(bob, "2026-10-13"), thanks(bob, "2026-11-20")], 1],
    ["dependability", "two kudos on one day count one day", [thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13")], 1],
    ["dependability", "three days", [thanks(bob, "2026-10-13"), thanks(bob, "2026-10-14"), thanks(bob, "2026-10-20")], 3],
    ["dependability", "two kudos two hours apart are two days for a giver in Berlin", givenIn("Europe/Berlin", "2026-10-13T21:30:00Z", "2026-10-13T23:30:00Z"), 2],
    ["dependability", "the same two kudos are one day for a giver in New York", givenIn("America/New_York", "2026-10-13T21:30:00Z", "2026-10-13T23:30:00Z"), 1],
    ["applause", "3 different people across two messages on one day", [thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13"), thanks(dave, "2026-10-13")], 1],
    ["applause", "the same person twice on one day makes 2 people, not 3", [thanks(bob, "2026-10-13"), thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13")], 0],
    ["applause", "a fourth person on that day counts the day once", [thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13"), thanks(dave, "2026-10-13"), thanks(erin, "2026-10-13")], 1],
    ["applause", "3 people across two days count no day", [thanks(bob, "2026-10-13"), thanks(carol, "2026-10-13"), thanks(dave, "2026-10-14")], 0],
    ["applause", "two days of 3 people", ["2026-10-13", "2026-10-14"].flatMap((day) => [thanks(bob, day), thanks(carol, day), thanks(dave, day)]), 2],
    ["seasons", "a month boundary", [thanks(bob, "2026-10-31"), thanks(bob, "2026-11-01")], 2],
    ["seasons", "two days in one month count one month", [thanks(bob, "2026-10-01"), thanks(carol, "2026-10-31")], 1],
    ["seasons", "the same month a year later counts again", [thanks(bob, "2026-10-13"), thanks(bob, "2027-10-13")], 2],
    ["seasons", "a kudos late on Oct 31 UTC is November's for a giver in Berlin", givenIn("Europe/Berlin", "2026-10-31T12:00:00Z", "2026-10-31T23:30:00Z"), 2],
    ["seasons", "and still October's for a giver in New York", givenIn("America/New_York", "2026-10-31T12:00:00Z", "2026-10-31T23:30:00Z"), 1],
  ])("%s: %s", (ladder, _case, awards, expected) => {
    expect(countOf(ladder, awards)).toBe(expected);
  });
});

function countOf(ladder: LadderId, awards: MeasuredAward[]) {
  const marked = new Map<string, string[]>();
  let count = 0;
  for (const award of awards) {
    const mark = markOf(ladder, award);
    const keys = mark === null ? [] : (marked.get(mark.group) ?? []);
    const { adds, keeps } = stepOf(award, mark, keys);
    if (mark !== null && keeps) marked.set(mark.group, [...keys, mark.key]);
    count += adds;
  }
  return count;
}

function thanks(recipient: Id<"members">, day: string, kudos = 1): MeasuredAward {
  return { giver: alice, recipient, kudos, day };
}

function givenIn(timeZone: string, ...instants: string[]): MeasuredAward[] {
  return instants.map((instant) => thanks(bob, allowanceDay(Date.parse(instant), timeZone)));
}

function memberId(name: string) {
  return name as Id<"members">;
}
