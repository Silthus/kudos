// PROTOTYPE (#625, round 6): round 5's own person page, the yearbook entry with their hype emoji. Never merge to main.
import type { PageLayouts } from "../../../round-4/layouts";
import { ClassPhotoPerson } from "./ClassPhoto";
import "./team.css";

export const personLayouts: Pick<PageLayouts<{ person: string }>, "A"> = {
  A: { name: "Yearbook entry", Page: ClassPhotoPerson },
};
