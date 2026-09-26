import type { PlaceDef } from "../places";
import { plaqueSprite } from "../tree/crewParts";

/**
 * The crew's plaque (#161, plan #152 S6): a carved board on two posts near the trunk, the names of
 * everyone who gave engraved on it. Its window holds the open crew quests, the catalogue to propose
 * from, and the plaque of what the crew built.
 */
export const place: PlaceDef = {
  id: "crew",
  name: "The crew's plaque",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: plaqueSprite(),
};
