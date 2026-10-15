import { describe, expect, it } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { featureCrateOf, type QuestCrate } from "./readyCrates";
import { rewardsOf, withTheRewardsHeld } from "./rewards";

const intoTheSixthLevel = shellFixtures.memberCrossingIntoLevel6;

const skillTreeCrate = featureCrateOf({ feature: "skillTree", name: "Skill tree", opens: "the tree and your first skill point", level: 5, seen: "9b71d2", state: "open", readyAt: 1, openedAt: 2 });

const journeyCrate: QuestCrate = { kind: "quest", quest: { kind: "journey", step: "first-quest" }, reward: { xp: 20 }, seen: "b2c9e4" };

const member: MemberProfile = intoTheSixthLevel;

describe("#354 review: a crate's share of the skill points on their way", () => {
  it.each([
    ["the Skill tree crate first", [skillTreeCrate, journeyCrate], [1, 1]],
    ["the Journey crate first", [journeyCrate, skillTreeCrate], [1, 1]],
  ] as const)("gives the Skill tree crate only the points no XP on its way earned, with %s", (_, crates, points) => {
    const onTheWay = crates.map((crate) => ({ crate, landed: [] }));
    expect(rewardsOf(member, onTheWay).map(({ skillPoints }) => skillPoints)).toEqual(points);
    expect(withTheRewardsHeld(member, onTheWay).skillPoints).toBe(0);
  });
});
