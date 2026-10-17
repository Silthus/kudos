// PROTOTYPE (#625): what every Radical polish page shares: opening a pack, and the level and coins shown while a reveal plays. Never merge to main.
import { createContext, useCallback, useContext, useState } from "react";
import type { Drop, Level, World, WorldActions } from "../world";

export type Reveal = { drop: Drop; before: Level; coinsBefore: number; packName: string };

type Stage = { openPack: (packId: string, packName: string) => void; shownLevel: Level; shownCoins: number };

export const StageContext = createContext<Stage | null>(null);

export function useStage() {
  const stage = useContext(StageContext);
  if (stage === null) throw new Error("useStage needs the Radical polish stage.");
  return stage;
}

export function usePackOpening(world: World, actions: WorldActions) {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const openPack = useCallback(
    (packId: string, packName: string) => {
      const before = world.level;
      const coinsBefore = world.coins;
      const drop = actions.openPack(packId);
      if (drop !== null) setReveal({ drop, before, coinsBefore, packName });
    },
    [world.level, world.coins, actions],
  );
  const close = useCallback(() => {
    setReveal(null);
    actions.forgetLastDrop();
  }, [actions]);
  const stage: Stage = { openPack, shownLevel: reveal?.before ?? world.level, shownCoins: reveal?.coinsBefore ?? world.coins };
  return { reveal, close, stage };
}
