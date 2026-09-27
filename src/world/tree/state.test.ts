import { describe, expect, test } from "vitest";
import { layout } from "../../../convex/lib/tree";
import { treeCosmetics } from "./cosmetics";
import { closedLine, treeInput, treeMoments, treeToasts, type TreeState } from "./state";

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
    expect(treeInput(state(40))).toEqual({ seed: 7, layout: layout(7, 40), planted: true, cosmetics: treeCosmetics([]) });
    expect(treeInput(state(40, { cosmetics: [{ part: "canopy_colour", option: "rose" }] as never }))?.cosmetics).toMatchObject({ canopy: "rose" });
    expect(treeInput(state(0))).toMatchObject({ planted: false });
  });

  test("waits while the state is loading", () => {
    expect(treeInput(undefined)).toBeNull();
  });

  test("with the game off or hidden there's no tree to grow: a grown tree stands with every page's district open, and nothing of the game", () => {
    const off = treeInput(null)!;
    expect(off.planted).toBe(true);
    expect(off.layout.stage).toBe("grown");
    for (const id of ["signpost", "notice_board", "gallery", "stall", "pool", "observatory", "gatehouse"]) expect(off.layout.districts.find((d) => d.id === id)?.open, id).toBe(true);
    // No homes, ruins, crew or blight: those are the game's, and nothing in the world promises them.
    expect(off.layout.districts.every((d) => d.open)).toBe(true);
    expect(off.layout.districts.map((d) => d.id)).not.toContain("homes");
    expect(off.layout.homes).toEqual([]);
    expect(off.layout.ruins).toEqual([]);
  });
});

describe("a closed district", () => {
  test("says which stage opens it and how many more thoughtful kudos that takes", () => {
    expect(closedLine({ opens: "young" }, 38)).toBe("Opens when the tree is a young tree: 62 more thoughtful kudos.");
    expect(closedLine({ opens: "grown" }, 299)).toBe("Opens when the tree is a grown tree: 1 more thoughtful kudos.");
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

  test("a district the client doesn't know yet (a newer server) is left out of the toast, not a crash", () => {
    const next = state(100);
    const newer = { ...next, layout: { ...next.layout, districts: [...next.layout.districts, { id: "lighthouse", at: { x: 40, y: 40 }, open: true }] } };
    expect(treeToasts(treeMoments(state(99), newer as never), newer as never)[0].body).toBe("The stall, the elder oak and the mirror pool are open.");
  });

  test("another workspace's tree is no moment: switching workspace plants nothing and opens nothing", () => {
    const other = { ...state(5000), worldSeed: 8 };
    expect(treeMoments(state(0), other)).toEqual({ seeded: false, opened: [], crew: [] });
  });

  test("nothing opens on arrival, on a reload, or when the game is switched off", () => {
    expect(treeMoments(undefined, state(500)).opened).toEqual([]);
    expect(treeMoments(state(500), null).opened).toEqual([]);
    expect(treeMoments(null, state(500)).opened).toEqual([]);
  });
});

describe("the crew's moments (#161)", () => {
  const event = (id: string, kind: string, part: string) => ({ _id: id, kind, part, at: 1, who: null }) as never;
  test("a crew quest funded, and a part built, while you're here: a toast each, once", () => {
    const before = state(3000, { events: [event("e1", "stage", "")] });
    const funded = state(3000, { events: [event("e2", "crew_funded", "structure_lantern_bridge"), event("e1", "stage", "")] });
    const m = treeMoments(before, funded);
    expect(m.crew).toEqual([{ kind: "crew_funded", part: "structure_lantern_bridge" }]);
    expect(treeToasts(m, funded)).toEqual([
      expect.objectContaining({ kind: "tree", title: "The crew funded the lantern bridge", body: "It will be built in 3 days, and everyone who gave is on the plaque." }),
    ]);
    const built = state(3000, { events: [{ ...(event("e3", "crew_built", "style_stall") as object), option: "blossom" } as never, ...funded.events!] });
    expect(treeToasts(treeMoments(funded, built), built)).toEqual([
      expect.objectContaining({ title: "The crew built the stall style (blossom)", link: { to: "/crew", label: "See the plaque" } }),
    ]);
    // Arriving is no moment, nor the same events again.
    expect(treeMoments(undefined, built).crew).toEqual([]);
    expect(treeMoments(built, built).crew).toEqual([]);
  });
});
