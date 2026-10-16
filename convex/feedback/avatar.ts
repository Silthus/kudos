import type { Avatar } from "../hoggies/avatar";
import { rarityLabel } from "../hoggies/catalogue";

export function avatarText(avatar: Avatar) {
  return `Avatar: ${hoggieLabel(avatar)}`;
}

export function hoggieLabel({ name, rarity }: Avatar) {
  return `${name} (${rarityLabel(rarity)})`;
}
