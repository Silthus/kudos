import type { RuinSite, RuinTier } from "../../convex/lib/tree";
import type { Place } from "./places";
import { ruinPath, ruinPlace } from "./places/ruins";

/**
 * The ruins in the world (#162): each ruin the tree opened stands as a place on the map, with the
 * route `/ruins/<tier>-<index>`, so walking into its entrance opens its window like any door, and a
 * link to it walks you there. Ruins aren't in the Places list: they're found by walking out.
 */
export function ruinPlaces(sites: RuinSite[]): Place[] {
  return sites.map((site) => {
    const path = ruinPath(site.id);
    return { ...ruinPlace(site), to: path, path, label: site.name };
  });
}

/** What a ruin says as you walk up to it: how to go in, from which level, and with whom (#163). */
export function ruinNotice(tier: RuinTier): string {
  return {
    1: "One of the near ruins. Step into the arch to explore it, from level 6, alone or with a party.",
    2: "One of the far ruins. Step into the tower's door to explore it, from level 10. Better with a party.",
    3: "One of the deep ruins. Take the stair down, from level 15. Bring a party.",
  }[tier];
}
