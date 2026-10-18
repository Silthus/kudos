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
import { AlbumProvider } from "./round-3/album";
import { PretendSlack } from "./round-3/PretendSlack";
import { StickerAlbum } from "./round-3/variant-1-sticker-album/StickerAlbum";
import { TeamYearbook } from "./round-3/variant-2-team-yearbook/TeamYearbook";
import { PocketBinder } from "./round-3/variant-3-pocket-binder/PocketBinder";
import { SlackMoments } from "./round-3/slack-moments/SlackMoments";
import { roundFourCast } from "./round-4/cast";
import { RoundFour } from "./round-4/RoundFour";
import { RoundFive } from "./round-5/RoundFive";
import type { Layout } from "./round-4/layouts";
import type { VariantKey } from "./variants";

const roundThree: ReadonlySet<VariantKey> = new Set(["1", "2", "3"]);

const layoutOf = { "4a": "A", "4b": "B", "4c": "C" } as const satisfies Record<string, Layout>;

type RoundFourKey = keyof typeof layoutOf;

type LaterRoundKey = RoundFourKey | "5";

function isRoundFour(variant: VariantKey): variant is RoundFourKey {
  return variant in layoutOf;
}

export type VariantProps = {
  route: Route;
  member: MemberProfile;
  todaysPage: ReactNode;
  todaysFrame: (content: ReactNode) => ReactNode;
};

const variantOf = {
  "1": StickerAlbum,
  "2": TeamYearbook,
  "3": PocketBinder,
  slack: SlackMoments,
  "r2-1": MeadowRealm,
  "r2-2": WorldMap,
  "r2-3": SkyIsland,
  "r2-4": GuildHall,
  "r1-1": GameHud,
  "r1-2": TheBook,
  "r1-3": RadicalPolish,
  "r1-4": CharacterSheet,
  "r1-5": CorkboardDesk,
} satisfies Record<Exclude<VariantKey, LaterRoundKey>, (props: VariantProps) => ReactNode>;

export function PrototypeStage({ variant, ...props }: VariantProps & { variant: VariantKey }) {
  return (
    <div data-prototype-variant={variant} className="prototype-stage">
      {variant === "5" ? (
        <AlbumProvider key="round-5" cast={roundFourCast} trayed>
          <RoundFive {...props} />
          <PretendSlack slackLink={false} />
        </AlbumProvider>
      ) : isRoundFour(variant) ? (
        <AlbumProvider key="round-4" cast={roundFourCast}>
          <RoundFour layout={layoutOf[variant]} {...props} />
          <PretendSlack slackLink={false} />
        </AlbumProvider>
      ) : (
        <EarlierRound variant={variant} {...props} />
      )}
    </div>
  );
}

function EarlierRound({ variant, ...props }: VariantProps & { variant: Exclude<VariantKey, LaterRoundKey> }) {
  const Variant = variantOf[variant];
  return (
    <>
      <Variant {...props} />
      {roundThree.has(variant) && <PretendSlack />}
    </>
  );
}
