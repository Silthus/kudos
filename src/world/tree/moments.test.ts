import { describe, expect, test } from "vitest";
import { layout } from "../../../convex/lib/tree";
import { closedLine, treeInput, treeMoments, treeToasts, type TreeState } from "./moments";

/**
 * What the tree's state means for the world (#156): the input the world is built from, the line a
 * closed district says, and the moments worth a toast: the seed planted, districts opening.
 */

const state = (growth: number, extra: Partial<NonNullable<TreeState>> = {}): TreeState => ({
  planted: growth > 0,
  stage: layout(7, growth).stage,
  growth,
  peakGrowth: growth,
  plantedBy: growth > 0 ? "Lena Hoffmann" : null,
  worldSeed: 7,
  rings: 0,
  layout: layout(7, growth),
  ...extra,
});

describe("the world's tree", () => {
  test("comes from the server's state: its seed, its layout at peak growth, whether it's planted", () => {
    expect(treeInput(state(40))).toEqual({ seed: 7, layout: layout(7, 40), peakGrowth: 40, planted: true });
    expect(treeInput(state(0))).toMatchObject({ planted: false, peakGrowth: 0 });
  });

  test("waits while the state is loading", () => {
    expect(treeInput(undefined)).toBeNull();
  });

  test("with the game off or hidden there's no tree to grow: a grown tree stands with every page's district open", () => {
    const off = treeInput(null)!;
    expect(off.planted).toBe(true);
    expect(off.layout.stage).toBe("grown");
    for (const id of ["signpost", "notice_board", "gallery", "stall", "pool", "observatory", "gatehouse"]) expect(off.layout.districts.find((d) => d.id === id)?.open, id).toBe(true);
  });
});

describe("a closed district", () => {
  test("says which stage opens it and how many more thoughtful kudos that takes", () => {
    expect(closedLine({ opens: "young", toOpen: 62 })).toBe("Opens when the tree is a young tree: 62 more thoughtful kudos.");
    expect(closedLine({ opens: "grown", toOpen: 1 })).toBe("Opens when the tree is a grown tree: 1 more thoughtful kudos.");
  });
});

describe("moments of the tree", () => {
  test("the seed planted while you watch: once, naming who planted it", () => {
    const m = treeMoments(state(0), state(1));
    expect(m.seeded).toBe(true);
    expect(treeToasts(m, state(1))[0]).toMatchObject({ kind: "tree", title: "The Ancient Seed is planted" });
    expect(treeToasts(m, state(1))[0].body).toContain("Lena Hoffmann");
    // Already planted when you arrive, or still loading: no moment.
    expect(treeMoments(undefined, state(1)).seeded).toBe(false);
    expect(treeMoments(state(1), state(2)).seeded).toBe(false);
  });

  test("a district opening says the tree's new stage and what opened", () => {
    const m = treeMoments(state(99), state(100));
    expect(m.opened).toEqual(["stall", "oak", "pool"]);
    expect(treeToasts(m, state(100))).toEqual([
      { kind: "tree", title: "The tree is now a young tree", body: "The stall, the elder oak and the mirror pool are open." },
    ]);
    expect(treeMoments(state(100), state(120)).opened).toEqual([]);
  });

  test("nothing opens on arrival, on a reload, or when the game is switched off", () => {
    expect(treeMoments(undefined, state(500)).opened).toEqual([]);
    expect(treeMoments(state(500), null).opened).toEqual([]);
    expect(treeMoments(null, state(500)).opened).toEqual([]);
  });
});
