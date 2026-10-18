// PROTOTYPE (#625, round 4): three distinct layouts of the leaderboard page. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { FrontPage } from "./FrontPage";
import { SideBySide } from "./SideBySide";
import { WinnersStand } from "./WinnersStand";

export const leaderboardLayouts: PageLayouts = {
  A: { name: "Front page", Page: FrontPage },
  B: { name: "Winners' stand", Page: WinnersStand },
  C: { name: "Side by side", Page: SideBySide },
};
