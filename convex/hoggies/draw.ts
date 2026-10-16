import { hoggiesOfRarity, rarities, type Rarity } from "./catalogue";

export type DrawInput = { secret: string; member: string; crate: string; version: number };

export type Drawn = { rarity: Rarity; hoggie: string };

export async function drawOf({ secret, member, crate, version }: DrawInput): Promise<Drawn> {
  const digest = new DataView(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${member}:${crate}:${version}`)));
  const rarity = rarityAt(fractionAt(digest, 0) * 100);
  const hoggies = hoggiesOfRarity(rarity);
  return { rarity, hoggie: hoggies[Math.floor(fractionAt(digest, 4) * hoggies.length)]!.hoggie };
}

function fractionAt(digest: DataView, offset: number) {
  return digest.getUint32(offset) / 2 ** 32;
}

function rarityAt(point: number): Rarity {
  let end = 0;
  for (const { rarity, weight } of rarities) if (point < (end += weight)) return rarity;
  return rarities.at(-1)!.rarity;
}
