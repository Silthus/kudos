import type { Avatar } from "../album/hoggies/avatar";
import { rarityLabel } from "../album/hoggies/catalogue";

export function avatarText(avatar: Avatar) {
  return `Avatar: ${hoggieLabel(avatar)}`;
}

export function hoggieLabel({ name, rarity }: Avatar) {
  return `${name} (${rarityLabel(rarity)})`;
}
