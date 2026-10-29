import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null } });

try {
  const { drawOf } = await server.ssrLoadModule("/convex/hoggies/draw.ts");
  const { catalogue } = await server.ssrLoadModule("/convex/hoggies/catalogue.ts");
  const rareOwned = new Set(catalogue.hoggies.filter(({ rarity }) => rarity === "rare").map(({ hoggie }) => hoggie));
  const counts = { ordinaryRareFloor: {}, exhaustedRareAchievement: {}, ordinaryDuplicate: 0 };
  for (let n = 0; n < 10000; n += 1) {
    const input = { secret: "public-research-probe", member: "synthetic-member", crate: `research:${n}`, version: catalogue.version, floor: "rare" };
    const ordinary = await drawOf(input);
    counts.ordinaryRareFloor[ordinary.rarity] = (counts.ordinaryRareFloor[ordinary.rarity] ?? 0) + 1;
    counts.ordinaryDuplicate += Number(rareOwned.has(ordinary.hoggie));
    const achievement = await drawOf({ ...input, owned: rareOwned });
    assert.notEqual(achievement.rarity, "rare");
    counts.exhaustedRareAchievement[achievement.rarity] = (counts.exhaustedRareAchievement[achievement.rarity] ?? 0) + 1;
  }
  assert(counts.ordinaryDuplicate > 6000);
  assert(Math.abs(counts.ordinaryRareFloor.epic / 10000 - 6 / 22) < 0.02);
  assert(Math.abs(counts.ordinaryRareFloor.legendary / 10000 - 2 / 22) < 0.02);
  assert(Math.abs(counts.exhaustedRareAchievement.legendary / 10000 - 0.25) < 0.02);
  console.log(JSON.stringify(counts, null, 2));
} finally {
  await server.close();
}
