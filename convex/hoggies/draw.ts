import { hoggiesOfRarity, packBands, rarities, type CatalogueHoggie, type Rarity } from "./catalogue";
import { kindOf, type CrateKey } from "./crateKey";

export type DrawInput = { secret: string; member: string; crate: string; version: number; floor?: Rarity; owned?: ReadonlySet<string> };

export type Drawn = { rarity: Rarity; hoggie: string };

type Pool = { rarity: Rarity; weight: number; hoggies: CatalogueHoggie[] };

export type PackDrawInput = { secret: string; member: string; crate: CrateKey };

export type PackBonus = { xp: number; coins: number };

export async function drawOf({ secret, member, crate, version, floor = "common", owned = new Set() }: DrawInput): Promise<Drawn> {
  const digest = await digestOf(`${secret}:${member}:${crate}:${version}`);
  const { rarity, hoggies } = poolAt(fractionAt(digest, 0), poolsFrom(floor, owned));
  return { rarity, hoggie: hoggies[pickAt(digest, 4, hoggies.length)]!.hoggie };
}

export async function packBonusOf({ secret, member, crate }: PackDrawInput): Promise<PackBonus | null> {
  const band = packBands[kindOf(crate)];
  if (band === null) return null;
  const { xp, coins, version } = band;
  const digest = await digestOf(`${secret}:${member}:${crate}:pack:${version}`);
  const xpSteps = (xp.most - xp.least) / xp.step + 1;
  return { xp: xp.least + xp.step * pickAt(digest, 0, xpSteps), coins: coins.least + pickAt(digest, 4, coins.most - coins.least + 1) };
}

async function digestOf(input: string) {
  return new DataView(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

function pickAt(digest: DataView, offset: number, choices: number) {
  return Math.floor(fractionAt(digest, offset) * choices);
}

function fractionAt(digest: DataView, offset: number) {
  return digest.getUint32(offset) / 2 ** 32;
}

function poolsFrom(floor: Rarity, owned: ReadonlySet<string>): Pool[] {
  const every = rarities.slice(rarities.findIndex(({ rarity }) => rarity === floor)).map(({ rarity, weight }) => ({ rarity, weight, hoggies: hoggiesOfRarity(rarity) }));
  const unowned = every.map((pool) => ({ ...pool, hoggies: pool.hoggies.filter(({ hoggie }) => !owned.has(hoggie)) })).filter(({ hoggies }) => hoggies.length > 0);
  return unowned.length > 0 ? unowned : every;
}

function poolAt(fraction: number, pools: Pool[]): Pool {
  const point = fraction * pools.reduce((total, { weight }) => total + weight, 0);
  let end = 0;
  for (const pool of pools) if (point < (end += pool.weight)) return pool;
  return pools.at(-1)!;
}
