// Variant E gear at the previewed level: which parts of the profile a member may use yet, and the starter hedgehog and no title they show until those open.
import { hedgehogs, starterHog, useGear } from "./hedgehogs";
import { unlockedAt, usePreviewLevel } from "./unlocks";

const isHog = (id: string) => hedgehogs.some((h) => h.id === id);

export function useGearAtLevel() {
  const g = useGear();
  const level = usePreviewLevel();
  const gearOpen = unlockedAt("gear", level);
  const hogsOpen = unlockedAt("collection", level);
  const hog = hogsOpen ? g.hog : starterHog;
  return {
    ...g,
    level,
    gearOpen,
    hogsOpen,
    skillsOpen: unlockedAt("skills", level),
    coinsOpen: unlockedAt("coins", level),
    hog,
    title: gearOpen ? g.itemIn("title", 0) : undefined,
    isEquipped: (id: string) => (isHog(id) ? id === hog.id : g.isEquipped(id)),
    canWear: (id: string) => g.isOwned(id) && (hogsOpen || !isHog(id) || id === starterHog.id),
  };
}
