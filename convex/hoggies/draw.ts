import { hoggiesOfRarity, packBands, rarities, type Rarity } from "./catalogue";
import { packKindOf, type PackKey } from "./crateKey";

export type DrawInput = { secret: string; member: string; crate: string; version: number; floor?: Rarity };

export type Drawn = { rarity: Rarity; hoggie: string };

export type PackDrawInput = { secret: string; member: string; crate: PackKey };

export type PackBonus = { xp: number; coins: number };

export async function drawOf({ secret, member, crate, version, floor = "common" }: DrawInput): Promise<Drawn> {
  const digest = await digestOf(`${secret}:${member}:${crate}:${version}`);
  const rarity = rarityAt(fractionAt(digest, 0), raritiesFrom(floor));
  const hoggies = hoggiesOfRarity(rarity);
  return { rarity, hoggie: hoggies[pickAt(digest, 4, hoggies.length)]!.hoggie };
}

export async function packBonusOf({ secret, member, crate }: PackDrawInput): Promise<PackBonus> {
  const { xp, coins, version } = packBands[packKindOf(crate)];
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

function raritiesFrom(floor: Rarity) {
  return rarities.slice(rarities.findIndex(({ rarity }) => rarity === floor));
}

function rarityAt(fraction: number, drawable: typeof rarities): Rarity {
  const point = fraction * drawable.reduce((total, { weight }) => total + weight, 0);
  let end = 0;
  for (const { rarity, weight } of drawable) if (point < (end += weight)) return rarity;
  return drawable.at(-1)!.rarity;
}
