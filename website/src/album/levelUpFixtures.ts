import type { AlbumLevelUp, LevelUpRead, LevelUpShown } from "./answer";

const reachedAt = Date.parse("2026-10-20T10:00:00Z");

const levelSeven: AlbumLevelUp = {
  kind: "levelUp",
  level: 7,
  at: reachedAt,
  hoggies: [
    { hoggie: "banana", name: "Banana", rarity: "common", isNew: true },
    { hoggie: "cake", name: "Cake", rarity: "uncommon", isNew: false },
    { hoggie: "rocket", name: "Rocket", rarity: "legendary", isNew: true },
  ],
  emojis: [],
};

const levelFive: AlbumLevelUp = {
  kind: "levelUp",
  level: 5,
  at: reachedAt,
  hoggies: [
    { hoggie: "asleep", name: "Asleep", rarity: "common", isNew: true },
    { hoggie: "basketball-coach", name: "Basketball Coach", rarity: "uncommon", isNew: true },
    { hoggie: "angel", name: "Angel", rarity: "epic", isNew: true },
  ],
  emojis: [{ id: "level:5", kind: "level", name: "level-5", from: "Level 5", picture: "/emoji/level-5.png", earned: true, earnedAt: reachedAt, seen: false, inSlack: false, progress: null }],
};

export const levelUpFixtures = { levelSeven, levelFive };

export function fixedLevelUp(answer: LevelUpShown): LevelUpRead {
  return (asking) => (asking ? answer : undefined);
}
