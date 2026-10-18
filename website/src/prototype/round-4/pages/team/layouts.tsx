// PROTOTYPE (#625, round 4): three distinct layouts of the team page. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { ClassPhotoTeam } from "./ClassPhoto";
import { RosterTeam } from "./Roster";
import { SleeveTeam } from "./Sleeve";
import "./team.css";

export const teamLayouts: PageLayouts<{ team: string }> = {
  A: { name: "Class photo", Page: ClassPhotoTeam },
  B: { name: "Card sleeve", Page: SleeveTeam },
  C: { name: "Road roster", Page: RosterTeam },
};
