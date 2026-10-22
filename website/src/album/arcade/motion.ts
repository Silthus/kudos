// PROTOTYPE: the arcade look's motion hooks. They only name what is happening; arcade.css decides what it looks like.
import type { TurnedFaceShown } from "../../../../convex/website/album";

let combo = 0;

let lastItem: string | null = null;

export function comboFor(item: string) {
  if (item !== lastItem) {
    combo += 1;
    lastItem = item;
  }
  return combo;
}

export function faceWordOf(face: TurnedFaceShown) {
  return face.kind === "hoggie" ? face.drop.rarity : "sticker";
}
