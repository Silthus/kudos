// PROTOTYPE (#625, round 4): three distinct layouts of a person's page, your history with them. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { ClassPhotoPerson } from "./ClassPhoto";
import { RosterPerson } from "./Roster";
import { SleevePerson } from "./Sleeve";
import "./team.css";

export const personLayouts: PageLayouts<{ person: string }> = {
  A: { name: "Yearbook entry", Page: ClassPhotoPerson },
  B: { name: "Card back", Page: SleevePerson },
  C: { name: "Roster ledger", Page: RosterPerson },
};
