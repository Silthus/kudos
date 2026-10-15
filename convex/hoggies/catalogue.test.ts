import { describe, expect, test } from "vitest";
import { catalogue, hoggiesOfRarity, rarities, rarityLabel, type Rarity } from "./catalogue";
import { drawOf } from "./draw";

const member = "k57abc0000000000000000000000000";

describe("CL2 CL3 CL4: catalogue version 1", () => {
  test("CL3: the five rarities run common to legendary, each shown by a coloured square and its word", () => {
    expect(rarities.map(({ rarity }) => rarityLabel(rarity))).toEqual(["⬜ Common", "🟩 Uncommon", "🟦 Rare", "🟪 Epic", "🟧 Legendary"]);
  });

  test("CL4: the weights are 50, 28, 14, 6 and 2, adding up to 100", () => {
    expect(Object.fromEntries(rarities.map(({ rarity, weight }) => [rarity, weight]))).toEqual({ common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 });
  });

  test("CL2 CL4: version 1 holds 151 distinct hoggies, the appendix's count of each rarity, so every weight can be drawn", () => {
    expect(catalogue.version).toBe(1);
    expect(new Set(catalogue.hoggies.map(({ hoggie }) => hoggie)).size).toBe(151);
    expect(Object.fromEntries(rarities.map(({ rarity }) => [rarity, hoggiesOfRarity(rarity).length]))).toEqual({ common: 60, uncommon: 40, rare: 30, epic: 15, legendary: 6 });
  });

  test("CL2: catalogue order within a rarity is the appendix's", () => {
    expect(hoggiesOfRarity("legendary").map(({ hoggie }) => hoggie)).toEqual(["dr-manhattan", "final-evolution", "rocket", "superhero", "transformer", "wizard"]);
    expect(hoggiesOfRarity("common").at(-1)?.hoggie).toBe("workflows");
  });
});

describe("CL8: the draw", () => {
  test("the same secret, member, crate and version draw the same hoggie", async () => {
    const crate = "journey:first-thanks";

    expect(await drawOf({ secret: "s", member, crate, version: 1 })).toEqual(await drawOf({ secret: "s", member, crate, version: 1 }));
  });

  test("the drawn hoggie is one of the drawn rarity's", async () => {
    const drawn = await drawOf({ secret: "", member, crate: "weekly:2026-10-12:0", version: 1 });

    expect(hoggiesOfRarity(drawn.rarity).map(({ hoggie }) => hoggie)).toContain(drawn.hoggie);
  });

  test("over 10,000 crate keys, each rarity's share is within one percentage point of its weight", async () => {
    const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (let crate = 0; crate < 10_000; crate++) counts[(await drawOf({ secret: "", member, crate: `weekly:2026-10-12:${crate}`, version: 1 })).rarity]++;

    for (const { rarity, weight } of rarities) expect(Math.abs(counts[rarity] / 100 - weight), rarity).toBeLessThanOrEqual(1);
  });

  test("a different secret draws differently for the same crates", async () => {
    const crates = Array.from({ length: 20 }, (_, slot) => `weekly:2026-10-12:${slot}`);
    const drawnWith = (secret: string) => Promise.all(crates.map((crate) => drawOf({ secret, member, crate, version: 1 })));

    expect(await drawnWith("one deployment")).not.toEqual(await drawnWith("another deployment"));
  });

  test.each([
    { secret: "s", crate: "unlock:book", rarity: "common", hoggie: "burger" },
    { secret: "s", crate: "weekly:2026-10-12:0", rarity: "uncommon", hoggie: "basketball-coach" },
    { secret: "s", crate: "weekly:2026-10-12:12", rarity: "rare", hoggie: "puzzle" },
    { secret: "s", crate: "weekly:2026-10-12:1", rarity: "epic", hoggie: "katy-perry" },
    { secret: "s", crate: "weekly:2026-10-12:5", rarity: "legendary", hoggie: "transformer" },
    { secret: "", crate: "journey:first-thanks", rarity: "epic", hoggie: "the-bride" },
  ])("version 1 with secret '$secret' draws $hoggie ($rarity) for $crate, as the appendix's order and CL8's SHA-256 steps fix it", async ({ secret, crate, rarity, hoggie }) => {
    expect(await drawOf({ secret, member, crate, version: 1 })).toEqual({ rarity, hoggie });
  });
});
