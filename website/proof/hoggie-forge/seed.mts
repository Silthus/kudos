import { writeFileSync } from "node:fs";
import { catalogue, hoggieNamed, hoggiesOfRarity } from "../../../convex/hoggies/catalogue";

const [member, out] = process.argv.slice(2);
if (!member || !out) throw new Error("usage: seed.mts <member id> <out dir>");

const held = [...Array<string>(7).fill("banana"), "cake", "cake", ...Array<string>(4).fill("rocket"), "ape", ...hoggiesOfRarity("epic").map(({ hoggie }) => hoggie)];
const start = Date.now() - 86_400_000;
const drops: object[] = [];
const tallies = new Map<string, { count: number; firstAt: number; firstN: number }>();

held.forEach((hoggie, index) => {
  const n = index + 1;
  const at = start + index * 60_000;
  const tally = tallies.get(hoggie) ?? { count: 0, firstAt: at, firstN: n };
  tally.count += 1;
  tallies.set(hoggie, tally);
  drops.push({ member, crate: `bought:proof-forge-${n}`, hoggie, rarity: hoggieNamed(hoggie)!.rarity, n, copy: tally.count, catalogueVersion: catalogue.version, at, crest: null });
});

const lines = (rows: object[]) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
writeFileSync(`${out}/drops.jsonl`, lines(drops));
writeFileSync(`${out}/hoggieTallies.jsonl`, lines([...tallies].map(([hoggie, tally]) => ({ member, hoggie, ...tally }))));
writeFileSync(`${out}/dropTallies.jsonl`, lines([{ member, drops: held.length }]));
console.log(JSON.stringify(Object.fromEntries([...tallies].map(([hoggie, { count }]) => [hoggie, count]))));
