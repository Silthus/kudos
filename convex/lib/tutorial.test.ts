import { describe, expect, test } from "vitest";
import { hudShows, placeHint, stepGate, TUTORIAL_STEPS, tutorialStep } from "./tutorial";

/**
 * The elder hog's chain (#159, design plan #152 S4): ten first steps in a fixed order, each opening
 * the next thing to use. Gating is presentation only: it says what the HUD shows and which places
 * draw dim with a hint, never what a member may do.
 */

describe("the chain", () => {
  test("has the ten steps of S4, in order", () => {
    expect(TUTORIAL_STEPS.map((s) => s.title)).toEqual([
      "Arrive",
      "Say thanks",
      "Feed the tree",
      "Look around",
      "Grow something",
      "Learn",
      "Trade",
      "Explore",
      "Settle",
      "Together",
    ]);
  });

  test("the current step is the first one not done; none once all ten are", () => {
    expect(tutorialStep(0)?.id).toBe("arrive");
    expect(tutorialStep(2)?.id).toBe("feed");
    expect(tutorialStep(9)?.id).toBe("together");
    expect(tutorialStep(10)).toBeNull();
  });

  test("every step says one action and one why, each a single sentence", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.action).toMatch(/^[A-Z][^.]*$/);
      expect(s.why).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});

describe("level-gated steps", () => {
  test("grow, learn, trade and explore wait for levels 3, 4, 5 and 6", () => {
    expect(TUTORIAL_STEPS.filter((s) => s.level).map((s) => [s.id, s.level])).toEqual([
      ["grow", 3],
      ["learn", 4],
      ["trade", 5],
      ["explore", 6],
    ]);
  });

  test("a step below its level says the level; at it, nothing waits", () => {
    const grow = TUTORIAL_STEPS[4];
    expect(stepGate(grow, { level: 2, homesOpen: false })).toEqual({ kind: "level", level: 3, label: "at level 3" });
    expect(stepGate(grow, { level: 3, homesOpen: false })).toBeNull();
  });

  test("settling waits for the homes ring to open", () => {
    const settle = TUTORIAL_STEPS[8];
    expect(stepGate(settle, { level: 20, homesOpen: false })).toEqual({ kind: "district", label: "when the homes ring opens" });
    expect(stepGate(settle, { level: 20, homesOpen: true })).toBeNull();
  });
});

describe("gating the HUD", () => {
  test("no wallet before step 3, no stamina before step 8", () => {
    expect(hudShows(1)).toEqual({ wallet: false, stamina: false });
    expect(hudShows(2)).toEqual({ wallet: false, stamina: false });
    expect(hudShows(3)).toEqual({ wallet: true, stamina: false });
    expect(hudShows(7)).toEqual({ wallet: true, stamina: false });
    expect(hudShows(8)).toEqual({ wallet: true, stamina: true });
  });

  test("without a chain (the game off or hidden) the HUD shows everything as before", () => {
    expect(hudShows(null)).toEqual({ wallet: true, stamina: true });
  });
});

describe("places not yet reached draw dim with a hint", () => {
  test("each place opens with the step that uses it", () => {
    // Step 2 opens the stone (step 3 feeds the tree), step 3 the signpost, step 4 your tent.
    expect(placeHint("offering", 2)).toBe("Opens after your first thoughtful kudos");
    expect(placeHint("offering", 3)).toBeNull();
    expect(placeHint("quests", 3)).toBe("Opens after you feed the tree");
    expect(placeHint("quests", 4)).toBeNull();
    expect(placeHint("me", 4)).toBe("Opens after you look around");
    expect(placeHint("garden", 4)).toBe("Opens after you look around");
    expect(placeHint("skills", 5)).toBe("Opens after you grow something");
    expect(placeHint("store", 6)).toBe("Opens after you learn a skill");
    expect(placeHint("store", 7)).toBeNull();
  });

  test("the sandbox, the elder hog and the team's places are never dim", () => {
    for (const id of ["playground", "elder", "leaderboard", "compare", "discoveries", "analytics", "admin"]) expect(placeHint(id, 1)).toBeNull();
  });

  test("nothing is dim once the chain is done, or without one", () => {
    expect(placeHint("store", 11)).toBeNull();
    expect(placeHint("store", null)).toBeNull();
  });
});
