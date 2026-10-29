import { describe, expect, test } from "vitest";
import { catalogue, hoggiesOfRarity, rarities, type Rarity } from "./catalogue";
import { drawOf, type DrawInput } from "./draw";
import drawnBefore from "./drawsBeforeCaps.json";

const keys = Array.from({ length: 400 }, (_, n) => ({ secret: "draw-test", member: `member-${n % 9}`, crate: `quest:week-${n}`, version: catalogue.version }));
const everyRare = new Set(hoggiesOfRarity("rare").map(({ hoggie }) => hoggie));
const rarityRank = (rarity: Rarity) => rarities.findIndex((entry) => entry.rarity === rarity);

function drawsOver(input: Omit<DrawInput, keyof (typeof keys)[number]>) {
  return Promise.all(keys.map((key) => drawOf({ ...key, ...input })));
}

describe("HH39 HH40 HH42: a draw has a cap, and ownership never moves the odds", () => {
  test("a draw with no cap and no named weights draws what it drew before caps, owned rarities skipped as before", async () => {
    for (const { owned, rarity, hoggie, ...input } of drawnBefore.draws) {
      const drawn = await drawOf({ ...input, floor: input.floor as Rarity | undefined, owned: new Set(drawnBefore.ownedSets[owned as keyof typeof drawnBefore.ownedSets]) });
      expect(drawn, `${input.member} ${input.crate} floor ${input.floor ?? "none"} owning ${owned}`).toEqual({ rarity, hoggie });
    }
  });

  test.each(["common", "uncommon", "rare"] as const)("over many keys, a draw capped at %s never answers above it", async (cap) => {
    const drawn = await drawsOver({ cap, weights: "base" });

    for (const { rarity } of drawn) expect(rarityRank(rarity), `a ${rarity} hoggie under a ${cap} cap`).toBeLessThanOrEqual(rarityRank(cap));
    expect(new Set(drawn.map(({ rarity }) => rarity)), "every rarity up to the cap comes up").toEqual(new Set(rarities.slice(0, rarityRank(cap) + 1).map(({ rarity }) => rarity)));
  });

  test("a draw floored and capped at rare always answers rare", async () => {
    expect(new Set((await drawsOver({ floor: "rare", cap: "rare", weights: "base" })).map(({ rarity }) => rarity))).toEqual(new Set(["rare"]));
  });

  test("with named weights, owning every rare never drops rare from the draw, where a draw before caps skipped it", async () => {
    const withWeights = await drawsOver({ cap: "rare", weights: "base", owned: everyRare });
    const before = await drawsOver({ owned: everyRare });

    expect(withWeights.filter(({ rarity }) => rarity === "rare").length, "rares drawn with named weights").toBeGreaterThan(0);
    expect(before.filter(({ rarity }) => rarity === "rare"), "rares drawn before caps").toEqual([]);
  });

  test("with named weights, the drawn rarity still prefers a hoggie the member doesn't own, and draws any once they own them all", async () => {
    const [unowned, ...owned] = hoggiesOfRarity("rare").map(({ hoggie }) => hoggie);

    expect(new Set((await drawsOver({ floor: "rare", cap: "rare", weights: "base", owned: new Set(owned) })).map(({ hoggie }) => hoggie)), "owning every rare but one").toEqual(new Set([unowned]));
    expect(new Set((await drawsOver({ floor: "rare", cap: "rare", weights: "base", owned: everyRare })).map(({ hoggie }) => hoggie)), "owning every rare").toEqual(everyRare);
  });

  test("HH41: over 10,000 crate keys, a kudos-weighted draw lands on each rarity within four standard deviations of the kudos weights", async () => {
    const counts = new Map<Rarity, number>();
    for (let n = 0; n < 10_000; n++) {
      const { rarity } = await drawOf({ secret: "kudos-weights", member: "m", crate: `thoughtful:${n}`, version: catalogue.version, weights: "kudos" });
      counts.set(rarity, (counts.get(rarity) ?? 0) + 1);
    }

    const shares = Object.fromEntries([...counts].map(([rarity, count]) => [rarity, count / 100]));
    for (const [rarity, percent] of Object.entries({ common: 50, uncommon: 28, rare: 18, epic: 3.5, legendary: 0.5 })) expect(Math.abs((shares[rarity] ?? 0) - percent), `${rarity}'s share`).toBeLessThanOrEqual(fourStandardDeviationsOf(percent, 10_000));
  });
});

function fourStandardDeviationsOf(percent: number, draws: number) {
  const share = percent / 100;
  return 4 * Math.sqrt((share * (1 - share)) / draws) * 100;
}
