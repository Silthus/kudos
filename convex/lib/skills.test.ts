import { describe, expect, test } from "vitest";
import { mulberry32 } from "./random";
import { BRANCHES, canTake, pointsOf, resetCost, scoutEffects, SKILL_TREE, SKILLS, TIER_LEVEL, validAllocation, type Allocation, type SkillId } from "./skills";
import { scoreGive, XP } from "./xp";

/** The whole tree with every skill live, for the rules that don't care what has shipped yet. */
const LIVE = SKILL_TREE.map((s) => ({ ...s, arrives: undefined }));

describe("the tree (#55 §G7)", () => {
  test("has the four branches, each with a root in tier 1 and a capstone", () => {
    expect(BRANCHES.map((b) => b.id)).toEqual(["gardener", "herald", "scout", "neighbour"]);
    for (const b of BRANCHES) {
      const skills = SKILL_TREE.filter((s) => s.branch === b.id);
      expect(skills.some((s) => s.tier === 1 && !s.parent)).toBe(true);
      expect(skills.filter((s) => s.tier === 4)).toHaveLength(1);
    }
  });

  test("is worth about 40 points: never completable with the 24 points of level 25", () => {
    const worth = SKILL_TREE.reduce((sum, s) => sum + s.ranks * s.cost, 0);
    expect(worth).toBeGreaterThanOrEqual(36);
    expect(worth).toBeLessThanOrEqual(42);
    expect(pointsOf({}, 25).earned).toBe(24);
  });

  test("tier 1 is open from the start; tier 2 opens at level 5, tier 3 at 10 and capstones at 20", () => {
    expect(TIER_LEVEL).toEqual({ 1: 1, 2: 5, 3: 10, 4: 20 });
  });

  test("every parent is in the same branch and in the same or an earlier tier", () => {
    for (const s of SKILL_TREE) {
      if (!s.parent) continue;
      const parent = SKILLS[s.parent];
      expect(parent.branch).toBe(s.branch);
      expect(parent.tier).toBeLessThanOrEqual(s.tier);
    }
  });
});

describe("skill points", () => {
  test("one per level-up; spent by rank times cost", () => {
    expect(pointsOf({}, 1)).toEqual({ earned: 0, spent: 0, available: 0 });
    expect(pointsOf({ pathfinder: 2, lookout: 1 }, 6)).toEqual({ earned: 5, spent: 3, available: 2 });
    expect(pointsOf({ trailblazer: 1 }, 20).spent).toBe(3);
  });
});

describe("taking a skill", () => {
  const take = (alloc: Allocation, level: number, id: Parameters<typeof canTake>[2]) => canTake(alloc, level, id, LIVE);

  test("a tier-1 root needs only a point", () => {
    expect(take({}, 1, "pathfinder")).toEqual({ ok: false, reason: "points" });
    expect(take({}, 2, "pathfinder")).toEqual({ ok: true });
  });

  test("a skill needs its parent", () => {
    expect(take({}, 5, "rekindler")).toEqual({ ok: false, reason: "parent" });
    expect(take({ lookout: 1 }, 5, "rekindler")).toEqual({ ok: true });
  });

  test("a tier needs its level, whatever the points", () => {
    expect(take({ lookout: 1 }, 4, "rekindler")).toEqual({ ok: false, reason: "tier" });
    expect(take({ lookout: 1, rekindler: 2 }, 19, "trailblazer")).toEqual({ ok: false, reason: "tier" });
    expect(take({ lookout: 1, rekindler: 2 }, 20, "trailblazer")).toEqual({ ok: true });
  });

  test("ranks stop at the skill's maximum", () => {
    expect(take({ pathfinder: 1 }, 5, "pathfinder")).toEqual({ ok: true });
    expect(take({ pathfinder: 2 }, 5, "pathfinder")).toEqual({ ok: false, reason: "maxed" });
  });

  test("a capstone costs its whole price in points", () => {
    expect(take({ lookout: 1, rekindler: 2 }, 22, "trailblazer")).toEqual({ ok: true }); // 21 points, 3 spent
    expect(take({ lookout: 1, rekindler: 2, pathfinder: 2, wide_net: 1, more_plots: 2, good_neighbour: 3, emoji_variants: 2, charm_discount: 2, early_bloom: 1, plant_picker: 1 }, 20, "trailblazer")).toEqual({
      ok: false,
      reason: "points",
    }); // 19 points, 17 spent
  });

  test("a skill whose system hasn't shipped yet can't be taken", () => {
    expect(canTake({}, 5, "good_neighbour")).toEqual({ ok: false, reason: "arrives" });
    expect(canTake({}, 5, "more_plots")).toEqual({ ok: true }); // Gardens shipped (#95)
    expect(canTake({}, 2, "pathfinder")).toEqual({ ok: true });
  });
});

describe("resetting the tree", () => {
  test("costs Hog coins, more every time: 50, 100, 200, 400, then 200 more each", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(resetCost)).toEqual([50, 100, 200, 400, 600, 800, 1000]);
  });
});

describe("valid allocations", () => {
  test("respect ranks, tiers, parents and points", () => {
    expect(validAllocation({ lookout: 1, rekindler: 2 }, 5, LIVE)).toBe(true);
    expect(validAllocation({ rekindler: 1 }, 5, LIVE)).toBe(false); // no parent
    expect(validAllocation({ lookout: 1, rekindler: 1 }, 4, LIVE)).toBe(false); // tier 2 at level 4
    expect(validAllocation({ pathfinder: 3 }, 9, LIVE)).toBe(false); // over the maximum
    expect(validAllocation({ pathfinder: 2, lookout: 1 }, 3, LIVE)).toBe(false); // 3 points spent, 2 earned
    expect(validAllocation({ nonsense: 1 } as Allocation, 9, LIVE)).toBe(false);
    expect(validAllocation({ good_neighbour: 1 }, 9)).toBe(false); // hasn't shipped yet
    expect(validAllocation({ pathfinder: 1 }, 9)).toBe(true);
  });

  test("property: taking and resetting never spends more points than earned, and a reset refunds them all", () => {
    const ids = LIVE.map((s) => s.id);
    for (let seed = 1; seed <= 200; seed++) {
      const rand = mulberry32(seed);
      let level = 1;
      let alloc: Allocation = {};
      let resets = 0;
      let paid = 0;
      for (let step = 0; step < 120; step++) {
        const r = rand();
        if (r < 0.15) level = Math.min(25, level + 1 + Math.floor(rand() * 3));
        else if (r < 0.2) {
          paid += resetCost(resets++);
          alloc = {};
          expect(pointsOf(alloc, level, LIVE)).toEqual({ earned: level - 1, spent: 0, available: level - 1 });
        } else {
          const id = ids[Math.floor(rand() * ids.length)] as SkillId;
          const before = pointsOf(alloc, level, LIVE).spent;
          if (canTake(alloc, level, id, LIVE).ok) {
            alloc = { ...alloc, [id]: (alloc[id] ?? 0) + 1 };
            expect(pointsOf(alloc, level, LIVE).spent).toBe(before + SKILLS[id].cost);
          }
        }
        const points = pointsOf(alloc, level, LIVE);
        expect(points.spent).toBeLessThanOrEqual(points.earned);
        expect(validAllocation(alloc, level, LIVE)).toBe(true);
      }
      // Every reset cost more than the one before.
      expect(paid).toBe([...Array(resets).keys()].reduce((s, n) => s + resetCost(n), 0));
    }
  });
});

describe("Scout effects", () => {
  const recipient = { kudosId: "k1", receiverId: "r1", reciprocal: false, earlierToday: 0, earlierDaysThisWeek: 0 };
  const DAY = 24 * 3_600_000;
  const at = 1_000 * DAY;
  const score = (lastGivenAt: number | null, alloc: Allocation) =>
    scoreGive({ at, noteWords: 5, unsungOn: false, earnedToday: 0, recipients: [{ ...recipient, lastGivenAt }], scout: scoutEffects(alloc) })[0].items;

  test("without Scout skills the bonuses are the spec's: new connection 10, rekindle 5", () => {
    expect(scoutEffects({})).toEqual({ newConnection: XP.newConnection, rekindle: XP.rekindle, relinkAfterMs: null });
    expect(score(null, {})).toContainEqual({ kind: "new_connection", xp: 10 });
    expect(score(at - 31 * DAY, {})).toContainEqual({ kind: "rekindle", xp: 5 });
  });

  test("Pathfinder adds 5 to a new connection per rank; Rekindler 5 to a rekindle per rank", () => {
    expect(score(null, { pathfinder: 2 })).toContainEqual({ kind: "new_connection", xp: 20 });
    expect(score(at - 31 * DAY, { lookout: 1, rekindler: 1 })).toContainEqual({ kind: "rekindle", xp: 10 });
  });

  test("Trailblazer: after 90 days without thanks a rekindle earns at least what a new connection would", () => {
    // Pathfinder 2 makes a new connection worth 20, more than Rekindler 1's 10.
    expect(score(at - 91 * DAY, { lookout: 1, rekindler: 1, trailblazer: 1, pathfinder: 2 })).toContainEqual({ kind: "rekindle", xp: 20 });
    // Rekindler 2's 15 is already more than a plain new connection's 10: it stays 15, never less.
    expect(score(at - 91 * DAY, { lookout: 1, rekindler: 2, trailblazer: 1 })).toContainEqual({ kind: "rekindle", xp: 15 });
    // Under 90 days it's the plain rekindle; it's never counted as a new connection.
    expect(score(at - 60 * DAY, { lookout: 1, rekindler: 1, trailblazer: 1, pathfinder: 2 })).toContainEqual({ kind: "rekindle", xp: 10 });
    expect(score(at - 91 * DAY, { lookout: 1, rekindler: 1, trailblazer: 1, pathfinder: 2 }).map((i) => i.kind)).not.toContain("new_connection");
  });

  test("property: taking a skill never lowers the XP of any kudos", () => {
    const xpOf = (lastGivenAt: number | null, alloc: Allocation) => score(lastGivenAt, alloc).reduce((s, i) => s + i.xp, 0);
    const gaps = [null, 1, 20 * DAY, 31 * DAY, 89 * DAY, 90 * DAY, 400 * DAY];
    const scout = LIVE.filter((s) => s.branch === "scout");
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed);
      let alloc: Allocation = {};
      for (let step = 0; step < 12; step++) {
        const id = scout[Math.floor(rand() * scout.length)].id;
        if (!canTake(alloc, 25, id, LIVE).ok) continue;
        const next = { ...alloc, [id]: (alloc[id] ?? 0) + 1 };
        for (const gap of gaps) {
          const last = gap === null ? null : at - gap;
          expect(xpOf(last, next)).toBeGreaterThanOrEqual(xpOf(last, alloc));
        }
        alloc = next;
      }
    }
  });

  test("never touch the base, repeats or the daily cap: no XP from volume", () => {
    const alloc = { pathfinder: 2, lookout: 1, rekindler: 2 };
    // The same person again today earns the spec's 2, with no bonus, skills or not.
    const again = scoreGive({ at, noteWords: 5, unsungOn: false, earnedToday: 0, recipients: [{ ...recipient, lastGivenAt: at - 1, earlierToday: 1 }], scout: scoutEffects(alloc) });
    expect(again[0].xp).toBe(2);
    // The daily cap still cuts.
    const capped = scoreGive({ at, noteWords: 5, unsungOn: false, earnedToday: 45, recipients: [{ ...recipient, lastGivenAt: null }], scout: scoutEffects(alloc) });
    expect(capped[0].xp).toBe(5);
  });
});
