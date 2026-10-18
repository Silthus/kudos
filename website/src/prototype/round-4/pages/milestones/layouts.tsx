// PROTOTYPE (#625, round 4): three distinct layouts of the milestones page. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { LadderSpread } from "./LadderSpread";
import { MedalCase } from "./MedalCase";
import { MedalTimeline } from "./MedalTimeline";

export const milestoneLayouts: PageLayouts = {
  A: { name: "Ladder spread", Page: LadderSpread },
  B: { name: "Medal case", Page: MedalCase },
  C: { name: "Medal timeline", Page: MedalTimeline },
};
