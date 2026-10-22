import { writeFileSync } from "node:fs";
import { catalogue, hoggieNamed } from "../../../convex/hoggies/catalogue";

const [member, out, firstN, ...hoggies] = process.argv.slice(2);
if (!member || !out || !firstN || hoggies.length === 0) throw new Error("usage: seedMore.mts <member id> <out dir> <first drop number> <hoggie>...");

const copiesEach = 4;
const held = hoggies.flatMap((hoggie) => Array<string>(copiesEach).fill(hoggie));
const start = Date.now() - 3_600_000;
const tallies = new Map<string, { count: number; firstAt: number; firstN: number }>();

const drops = held.map((hoggie, index) => {
  const n = Number(firstN) + index;
  const at = start + index * 60_000;
  const tally = tallies.get(hoggie) ?? { count: 0, firstAt: at, firstN: n };
  tally.count += 1;
  tallies.set(hoggie, tally);
  return { member, crate: `bought:proof-forge-item-${n}`, hoggie, rarity: hoggieNamed(hoggie)!.rarity, n, copy: tally.count, catalogueVersion: catalogue.version, at, crest: null };
});

const lines = (rows: object[]) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
writeFileSync(`${out}/drops.jsonl`, lines(drops));
writeFileSync(`${out}/hoggieTallies.jsonl`, lines([...tallies].map(([hoggie, tally]) => ({ member, hoggie, ...tally }))));
console.log(JSON.stringify(Object.fromEntries([...tallies].map(([hoggie, { count }]) => [hoggie, count]))));
