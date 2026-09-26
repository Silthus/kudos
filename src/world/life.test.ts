import { describe, expect, test } from "vitest";
import { arrivalFor, confetti, lifeEvents, lifeSnapshot, nextBaseline, skyFor, toastFor, withSprout, type LifeSnapshot } from "./life";

const snap = (patch: Partial<LifeSnapshot> = {}): LifeSnapshot => ({ member: "m1", level: 9, title: "Gardener", coins: 84, discovered: 20, ...patch });

describe("arriving at a place: the hedgehog answers what the place is for", () => {
  test("a magnifying glass at the gallery, a sign at the notice board, the phone at the sandbox", () => {
    expect(arrivalFor("discoveries")).toBe("inspect");
    expect(arrivalFor("leaderboard")).toBe("sign");
    expect(arrivalFor("playground")).toBe("phone");
  });

  test("everywhere else a wave", () => {
    for (const id of ["garden", "me", "quests", "store", "skills", "compare", "analytics", "admin"]) expect(arrivalFor(id)).toBe("wave");
  });
});

describe("what happened between two looks at your game", () => {
  test("nothing on the first look: opening the app is not an event", () => {
    expect(lifeEvents(null, snap())).toEqual([]);
  });

  test("nothing when nothing changed, or the game went away", () => {
    expect(lifeEvents(snap(), snap())).toEqual([]);
    expect(lifeEvents(snap(), null)).toEqual([]);
  });

  test("a level-up: the new level, its title and a skill point per level", () => {
    expect(lifeEvents(snap(), snap({ level: 10, title: "Grove keeper" }))).toContainEqual({ kind: "level", level: 10, title: "Grove keeper", points: 1 });
    expect(lifeEvents(snap({ level: 3 }), snap({ level: 5, title: "Sprout" }))).toContainEqual({ kind: "level", level: 5, title: "Sprout", points: 2 });
  });

  test("coins earned hop into the counter; spending them is no event", () => {
    expect(lifeEvents(snap(), snap({ coins: 87 }))).toEqual([{ kind: "coins", amount: 3 }]);
    expect(lifeEvents(snap(), snap({ coins: 60 }))).toEqual([]);
  });

  test("the wallet appearing at level 3 is the level-up, not a hop of every coin saved up", () => {
    const events = lifeEvents(snap({ level: 2, coins: null }), snap({ level: 3, title: "Seedling", coins: 42 }));
    expect(events.map((e) => e.kind)).toEqual(["level"]);
  });

  test("a new discovery, however many came at once", () => {
    expect(lifeEvents(snap(), snap({ discovered: 21 }))).toEqual([{ kind: "discovery", count: 1 }]);
    expect(lifeEvents(snap(), snap({ discovered: 23 }))).toEqual([{ kind: "discovery", count: 3 }]);
  });

  test("a discovery count still loading is no discovery", () => {
    expect(lifeEvents(snap({ discovered: null }), snap({ discovered: 20 }))).toEqual([]);
  });

  test("another member's game is no event: switching workspace compares nothing", () => {
    expect(lifeEvents(snap(), snap({ member: "m2", level: 12, title: "Elder", coins: 400, discovered: 50 }))).toEqual([]);
  });

  test("a level-up that paid coins and found a message: the level first", () => {
    const events = lifeEvents(snap(), snap({ level: 10, title: "Grove keeper", coins: 94, discovered: 21 }));
    expect(events.map((e) => e.kind)).toEqual(["level", "coins", "discovery"]);
  });
});

describe("reading your game into a snapshot", () => {
  const wallet = { balance: 90, fromKudos: 60, fromFruit: 11, fromQuests: 20, fromSprees: 3, fromLevels: 1, spent: 5, adjusted: 0 };
  const mine = { enabled: true, hidden: false, player: { level: 9, title: "Gardener" }, wallet };

  test("whose it is, level, title, coins earned and the collection size", () => {
    expect(lifeSnapshot(mine as never, { discovered: 20 }, "m1")).toEqual(snap());
  });

  test("coins earned leave out fruit (the garden hops its own), spending, refunds and adjustments", () => {
    const more = { ...wallet, balance: 200, fromFruit: 50, spent: 0, adjusted: 60 };
    expect(lifeSnapshot({ ...mine, wallet: more } as never, { discovered: 20 }, "m1")?.coins).toBe(84);
  });

  test("no coins before the wallet, no count before it loads", () => {
    expect(lifeSnapshot({ ...mine, wallet: null } as never, undefined, "m1")).toEqual(snap({ coins: null, discovered: null }));
  });

  test("nothing while the game is off, hidden, not started or loading", () => {
    expect(lifeSnapshot({ ...mine, enabled: false } as never, { discovered: 20 }, "m1")).toBeNull();
    expect(lifeSnapshot({ ...mine, hidden: true } as never, { discovered: 20 }, "m1")).toBeNull();
    expect(lifeSnapshot({ ...mine, player: null } as never, { discovered: 20 }, "m1")).toBeNull();
    expect(lifeSnapshot(undefined, { discovered: 20 }, "m1")).toBeNull();
  });
});

describe("the look the next one is compared with", () => {
  test("the newest look", () => {
    expect(nextBaseline(snap(), snap({ level: 10 }), false)).toEqual(snap({ level: 10 }));
  });

  test("a game still loading keeps the last look", () => {
    expect(nextBaseline(snap(), null, true)).toEqual(snap());
  });

  test("a game hidden or switched off forgets it: showing it again is no event", () => {
    expect(nextBaseline(snap(), null, false)).toBeNull();
  });
});

describe("the toast an event shows", () => {
  test("a level-up names the level, the title and the skill point", () => {
    expect(toastFor({ kind: "level", level: 10, title: "Grove keeper", points: 1 })).toMatchObject({ kind: "level", title: "Level 10, Grove keeper, +1 skill point" });
    expect(toastFor({ kind: "level", level: 5, title: "Sprout", points: 2 })?.title).toBe("Level 5, Sprout, +2 skill points");
  });

  test("a discovery is a card for the collection, with the way to the gallery", () => {
    expect(toastFor({ kind: "discovery", count: 1 })).toMatchObject({ kind: "discovery", title: "New message discovered", link: { to: "/discoveries", label: "Open the gallery" } });
    expect(toastFor({ kind: "discovery", count: 3 })?.title).toBe("3 new messages discovered");
  });

  test("coins hop, they don't toast", () => {
    expect(toastFor({ kind: "coins", amount: 3 })).toBeNull();
  });
});

describe("the sky", () => {
  test("dusk on an ordinary day, or before the banner loads", () => {
    expect(skyFor(undefined)).toEqual({ golden: false, lanterns: false, party: false });
    expect(skyFor(null)).toEqual({ golden: false, lanterns: false, party: false });
    expect(skyFor({ current: null, upcoming: [{ dayKey: "2026-09-30", kind: "double", text: "Bonus day on Wednesday" }] })).toMatchObject({ golden: false });
  });

  test("a bonus day: golden hour, the lantern string, and the hedgehog in its party hat", () => {
    expect(skyFor({ current: { kind: "double", text: "Bonus day" }, upcoming: [] })).toEqual({ golden: true, lanterns: true, party: true });
  });

  test("a company-wide booster: golden hour and the lanterns; the party hat is for bonus days", () => {
    expect(skyFor({ current: { kind: "unsung", text: "The unsung" }, upcoming: [] } as never)).toEqual({ golden: true, lanterns: true, party: false });
  });
});

describe("confetti", () => {
  const PALETTE = ["#f7a501", "#f54e00", "#2f80fa", "#6aa84f", "#8567ff", "#f6efe4"];

  test("square pixels in the palette's colours, the same every time", () => {
    const pieces = confetti(24);
    expect(pieces).toHaveLength(24);
    expect(confetti(24)).toEqual(pieces);
    for (const p of pieces) expect(PALETTE).toContain(p.color);
    expect(new Set(pieces.map((p) => p.color)).size).toBe(PALETTE.length);
  });

  test("each comes to rest in the frame's top band, spread across it", () => {
    const pieces = confetti(24);
    for (const p of pieces) {
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.x).toBeLessThanOrEqual(96);
      expect(p.y).toBeGreaterThanOrEqual(6);
      expect(p.y).toBeLessThanOrEqual(64);
      expect([4, 6]).toContain(p.size);
    }
    expect(Math.min(...pieces.map((p) => p.x))).toBeLessThan(20);
    expect(Math.max(...pieces.map((p) => p.x))).toBeGreaterThan(80);
  });
});

describe("a neighbour's sprout", () => {
  const plant = { rows: ["......kk......", ".....kLLk.....", ".....kTTk.....", "......kk......"] };

  test("a few leaf pixels at the foot of their bed, beside the plant, touching nothing of it", () => {
    const sprouted = withSprout(plant);
    expect(sprouted.rows.every((r) => r.length === plant.rows[0].length)).toBe(true);
    expect(sprouted.rows.length).toBe(plant.rows.length);
    let added = 0;
    sprouted.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const was = plant.rows[y][x];
        if (ch === was) return;
        expect(was).toBe(".");
        expect(["u", "g", "G", "k"]).toContain(ch);
        added++;
      }),
    );
    expect(added).toBeGreaterThanOrEqual(4);
    expect(added).toBeLessThanOrEqual(10);
    // At the foot: the bottom row has some of it.
    expect(sprouted.rows.at(-1)).not.toBe(plant.rows.at(-1));
  });

  test("a plant shorter than the sprout gets room above, standing on the same ground", () => {
    const tiny = { rows: ["......kk......"] };
    const sprouted = withSprout(tiny);
    expect(sprouted.rows.length).toBe(3);
    expect(sprouted.rows.at(-1)!.slice(6, 8)).toBe("kk");
  });
});
