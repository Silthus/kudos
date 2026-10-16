import { hoggiesOfRarity, packBands, rarities, type Rarity } from "./catalogue";
import { kindOf, type CrateKey } from "./crateKey";

export type DrawInput = { secret: string; member: string; crate: string; version: number };

export type Drawn = { rarity: Rarity; hoggie: string };

export type PackDrawInput = { secret: string; member: string; crate: CrateKey };

export type PackBonus = { xp: number; coins: number };

export async function drawOf({ secret, member, crate, version }: DrawInput): Promise<Drawn> {
  const digest = await digestOf(`${secret}:${member}:${crate}:${version}`);
  const rarity = rarityAt(fractionAt(digest, 0) * 100);
  const hoggies = hoggiesOfRarity(rarity);
  return { rarity, hoggie: hoggies[pickAt(digest, 4, hoggies.length)]!.hoggie };
}

export async function packBonusOf({ secret, member, crate }: PackDrawInput): Promise<PackBonus> {
  const digest = await digestOf(`${secret}:${member}:${crate}:pack:${packBands.version}`);
  const { xp, coins } = packBands.bands[kindOf(crate)];
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

function rarityAt(point: number): Rarity {
  let end = 0;
  for (const { rarity, weight } of rarities) if (point < (end += weight)) return rarity;
  return rarities.at(-1)!.rarity;
}
