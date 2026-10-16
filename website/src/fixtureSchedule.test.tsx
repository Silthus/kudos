import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { schedule, scheduled } from "../../convex/unlocks/schedule";
import { bookFixtures } from "./bookFixtures";
import { collectionFixtures } from "./collectionFixtures";
import { questsFixtures } from "./questsFixtures";
import { Root } from "./Root";
import { shellFixtures, type Feature, type MemberProfile } from "./shell";
import { skillTreeFixtures } from "./skillTreeFixtures";
import { navEntryNames } from "./test/screensNav";
import { fakeSystemTheme } from "./test/systemTheme";

const members = Object.entries(shellFixtures).filter((entry): entry is [string, MemberProfile] => entry[1].kind === "member");

const membersWithALevel = members.filter(([, member]) => member.progression !== null);

const scheduleOrder: Feature[] = schedule.features.map(({ feature }) => feature);

describe("the fixture build follows the unlock schedule", () => {
  it.each(members)("%s lists each feature at its scheduled level", (_, member) => {
    const cards = member.features ?? [];

    expect(cards.map(({ feature, level }) => ({ feature, level }))).toEqual(cards.map(({ feature }) => ({ feature, level: scheduled(feature).level })));
  });

  it.each(members)("%s lists its features in the schedule's order", (_, member) => {
    const listed = (member.features ?? []).map(({ feature }) => feature);

    expect(listed).toEqual(scheduleOrder.filter((feature) => listed.includes(feature)));
  });

  it.each(membersWithALevel)("%s has every feature at or below its level ready or open and every one above it locked", (_, member) => {
    const level = member.progression!.level;
    const cards = member.features ?? [];

    expect(cards.filter(({ state }) => state === "locked").every((card) => card.level > level)).toBe(true);
    expect(cards.filter(({ state }) => state !== "locked").every((card) => card.level <= level)).toBe(true);
  });

  it("names each feature's scheduled level on its locked page", () => {
    expect(questsFixtures.locked).toEqual({ kind: "locked", level: scheduled("quests").level });
    expect(bookFixtures.locked).toEqual({ kind: "locked", level: scheduled("book").level });
    expect(collectionFixtures.locked).toEqual({ kind: "locked", level: scheduled("book").level });
    expect(skillTreeFixtures.locked).toEqual({ kind: "locked", level: scheduled("skillTree").level });
  });
});

describe("the fixture build's nav climbs the unlock schedule", () => {
  beforeEach(() => fakeSystemTheme(false));

  it.each([
    ["member-at-level-1-with-the-book-ready", ["Profile", "Book: unlock ready. Open its crate", "Leaderboard, locked. Unlocks at level 2", "Quests, locked. Unlocks at level 3", "Skill tree, locked. Unlocks at level 5"]],
    ["member-with-every-nav-state", ["Profile", "Book", "Leaderboard: unlock ready. Open its crate", "Quests, locked. Unlocks at level 3", "Skill tree, locked. Unlocks at level 5"]],
    ["member-at-level-3-with-the-quests-ready", ["Profile", "Book", "Leaderboard", "Quests: unlock ready. Open its crate", "Skill tree, locked. Unlocks at level 5"]],
  ])("%s", (fixture, entries) => {
    render(<Root fixture={fixture} />);
    expect(navEntryNames()).toEqual(entries);
  });
});
