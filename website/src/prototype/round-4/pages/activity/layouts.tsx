// PROTOTYPE (#625, round 4): three distinct layouts of the activity page. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { Daybook } from "./Daybook";
import { PeopleLedger } from "./PeopleLedger";
import { WeeklyEdition } from "./WeeklyEdition";

export const activityLayouts: PageLayouts = {
  A: { name: "Daybook", Page: Daybook },
  B: { name: "Weekly edition", Page: WeeklyEdition },
  C: { name: "People ledger", Page: PeopleLedger },
};
