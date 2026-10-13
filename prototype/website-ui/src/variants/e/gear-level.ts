// Variant E gear at the previewed level: which parts of the home a member may use yet, and the starter hedgehog they wear until the collection opens.
import { starterHog, useGear } from "./hedgehogs";
import { unlockedAt, usePreviewLevel } from "./unlocks";

export function useGearAtLevel() {
  const g = useGear();
  const level = usePreviewLevel();
  const hogsOpen = unlockedAt("collection", level);
  const hog = hogsOpen ? g.hog : starterHog;
  return {
    ...g,
    level,
    hogsOpen,
    questsOpen: unlockedAt("quests", level),
    standingOpen: unlockedAt("leaderboard", level),
    inventoryOpen: unlockedAt("inventory", level),
    skillsOpen: unlockedAt("skills", level),
    coinsOpen: unlockedAt("coins", level),
    hog,
    isHogWorn: (id: string) => id === hog.id,
    canWearHog: (id: string) => g.isOwned(id) && (hogsOpen || id === starterHog.id),
  };
}
