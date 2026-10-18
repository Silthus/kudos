// PROTOTYPE (#625, round 6): round 5's own team page, the class photo with its team sticker unlock. Never merge to main.
import type { PageLayouts } from "../../../round-4/layouts";
import { ClassPhotoTeam } from "./ClassPhoto";
import "./team.css";

export const teamLayouts: Pick<PageLayouts<{ team: string }>, "A"> = {
  A: { name: "Class photo", Page: ClassPhotoTeam },
};
