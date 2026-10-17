// PROTOTYPE (#625): mounts the chosen variant on today's routes, above the shared in-memory world. Never merge to main.
import type { ReactNode } from "react";
import type { Route } from "../route";
import type { MemberProfile } from "../shell";
import { GameHud } from "./variant-1-game-hud/GameHud";
import { TheBook } from "./variant-2-the-book/TheBook";
import { RadicalPolish } from "./variant-3-radical-polish/RadicalPolish";
import { CharacterSheet } from "./variant-4-character-sheet/CharacterSheet";
import { CorkboardDesk } from "./variant-5-corkboard-desk/CorkboardDesk";
import { MeadowRealm } from "./round-2/variant-1-meadow-realm/MeadowRealm";
import { WorldMap } from "./round-2/variant-2-world-map/WorldMap";
import { SkyIsland } from "./round-2/variant-3-sky-island/SkyIsland";
import { GuildHall } from "./round-2/variant-4-guild-hall/GuildHall";
import type { VariantKey } from "./variants";

export type VariantProps = {
  route: Route;
  member: MemberProfile;
  todaysPage: ReactNode;
  todaysFrame: (content: ReactNode) => ReactNode;
};

const variantOf = {
  "1": MeadowRealm,
  "2": WorldMap,
  "3": SkyIsland,
  "4": GuildHall,
  "r1-1": GameHud,
  "r1-2": TheBook,
  "r1-3": RadicalPolish,
  "r1-4": CharacterSheet,
  "r1-5": CorkboardDesk,
} satisfies Record<VariantKey, (props: VariantProps) => ReactNode>;

export function PrototypeStage({ variant, ...props }: VariantProps & { variant: VariantKey }) {
  const Variant = variantOf[variant];
  return (
    <div data-prototype-variant={variant} className="prototype-stage">
      <Variant {...props} />
    </div>
  );
}
