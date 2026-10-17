// PROTOTYPE (#625): variant 5, the corkboard desk: a top-down desk with the sticker album in the middle and every other feature as an object you pick up.
import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import type { VariantProps } from "../PrototypeStage";
import { useWorld, type Pack, type PackKind } from "../world";
import { Album } from "./Album";
import { spreadHoldingHoggie, spreadIndexOf, spreadsOf, type Spread } from "./albumPages";
import { Corkboard, useJustFinished } from "./Corkboard";
import { LetterStack, MedalBox, SettingsNote, TapedLeague, TeamPolaroids } from "./DeskObjects";
import { deskViewOf, replacingTheHash, useDeskMoves, type DeskView, type PickedUp } from "./deskView";
import { LevelCard } from "./LevelCard";
import { deskSize, useDeskFit } from "./motion";
import { PackOpening } from "./PackOpening";
import { Kiosk, League, Letters, Medals, SettingsClipboard, Zoomed } from "./PickedUp";
import { Shelf } from "./Shelf";
import "./corkboard-desk.css";

const stuckMs = 2400;

export function CorkboardDesk({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const { navigate, pickUp, putDown } = useDeskMoves();
  const fit = useDeskFit();
  const hash = window.location.hash;
  const view = deskViewOf(route, hash);
  const spreads = spreadsOf(world);
  const target = useAlbumTarget(spreads, hash);
  const albumOpen = useAlbumStaysOpenUnderneath(view);
  const celebrating = useJustFinished(world.quests);
  const [openingKind, setOpeningKind] = useState<PackKind>("bought");
  const [justStuck, setJustStuck] = useState<string | null>(null);
  const drop = world.lastDrop;

  const flipTo = (index: number) => {
    const spread = spreads[index];
    if (spread === undefined) return;
    if (route.page !== "book" || view.pickedUp !== null) return navigate(`/book#${spread.id}`);
    replacingTheHash(spread.id);
    rerender();
  };

  const openPack = (pack: Pack) => {
    setOpeningKind(pack.kind);
    actions.openPack(pack.id);
  };

  const stick = () => {
    if (drop === null) return;
    actions.forgetLastDrop();
    setJustStuck(drop.hoggie);
    window.setTimeout(() => setJustStuck(null), stuckMs);
    const spread = spreadHoldingHoggie(spreads, drop.hoggie);
    if (spread !== undefined) flipTo(spreads.indexOf(spread));
  };

  useEscape(view.pickedUp !== null && drop === null, putDown);

  return (
    <div className={`v5-desk ${fit.stacked ? "v5-stacked" : ""}`}>
      <div className="v5-stage" style={stageStyle(fit)}>
        <LevelCard world={world} raised={drop !== null} />
        <Corkboard world={world} zoomed={view.pickedUp === "quests"} celebrating={celebrating} onPickUp={() => pickUp("quests")} onProgress={actions.progressQuest} onPutDown={putDown} />
        <TapedLeague world={world} onPickUp={() => pickUp("leaderboard")} />
        <TeamPolaroids world={world} onOpenTeam={(team) => flipTo(spreads.findIndex(({ id }) => id === `teams/${team}`))} />
        <Album world={world} spreads={spreads} open={albumOpen} target={target} keysActive={albumOpen && view.pickedUp === null && drop === null} justStuck={justStuck} onOpen={() => navigate("/book")} onClose={() => navigate("/")} onFlipTo={flipTo} />
        <Shelf world={world} onOpen={openPack} onKiosk={() => pickUp("store")} />
        <MedalBox world={world} onPickUp={() => pickUp("achievements")} />
        <LetterStack world={world} onPickUp={() => pickUp("activity")} />
        <SettingsNote onPickUp={() => pickUp("settings")} />
        {celebrating.length > 0 && <QuestDoneNote count={celebrating.length} />}
        {view.pickedUp === "quests" && <button type="button" className="v5-cork-scrim" aria-label="Put the quest board back" onClick={putDown} />}
        <PickedUpObject pickedUp={view.pickedUp} world={world} todaysPage={todaysPage} onPutDown={putDown} onBuy={actions.buyPack} onOpenNewest={() => world.packs.at(-1) !== undefined && openPack(world.packs.at(-1)!)} />
        {drop !== null && (
          <>
            <div className="v5-opening-scrim" />
            <PackOpening key={`${drop.hoggie}:${drop.copy}`} drop={drop} kind={openingKind} onStick={stick} />
          </>
        )}
      </div>
    </div>
  );
}

function stageStyle(fit: { scale: number; stacked: boolean }): CSSProperties | undefined {
  if (fit.stacked) return undefined;
  const left = (window.innerWidth - deskSize.width * fit.scale) / 2;
  const top = (window.innerHeight - deskSize.height * fit.scale) / 2;
  return { transform: `translate(${left}px, ${top}px) scale(${fit.scale})` };
}

function useAlbumTarget(spreads: Spread[], hash: string) {
  const last = useRef(0);
  const asked = spreads.some(({ id }) => `#${id}` === decodeURIComponent(hash)) ? spreadIndexOf(spreads, hash) : last.current;
  last.current = asked;
  return asked;
}

function useAlbumStaysOpenUnderneath(view: DeskView) {
  const wasOpen = useRef(view.albumOpen);
  const open = view.albumOpen || (view.pickedUp !== null && wasOpen.current);
  wasOpen.current = open;
  return open;
}

function useEscape(active: boolean, onEscape: () => void) {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

function QuestDoneNote({ count }: { count: number }) {
  return (
    <p className="v5-quest-done-note" role="status">
      <strong>Quest done!</strong> {count === 1 ? "A pack landed" : `${count} packs landed`} on your shelf →
    </p>
  );
}

type PickedUpProps = { pickedUp: PickedUp; world: ReturnType<typeof useWorld>["world"]; todaysPage: VariantProps["todaysPage"]; onPutDown: () => void; onBuy: () => void; onOpenNewest: () => void };

function PickedUpObject({ pickedUp, world, todaysPage, onPutDown, onBuy, onOpenNewest }: PickedUpProps) {
  if (pickedUp === "store")
    return (
      <Zoomed label="The kiosk" className="v5-zoom-kiosk" onPutDown={onPutDown}>
        <Kiosk world={world} onBuy={onBuy} onOpenNewest={world.packs.length > 0 ? onOpenNewest : null} />
      </Zoomed>
    );
  if (pickedUp === "achievements")
    return (
      <Zoomed label="Achievements" className="v5-zoom-medals" onPutDown={onPutDown}>
        <Medals world={world} />
      </Zoomed>
    );
  if (pickedUp === "activity")
    return (
      <Zoomed label="Activity" className="v5-zoom-letters" onPutDown={onPutDown}>
        <Letters world={world} />
      </Zoomed>
    );
  if (pickedUp === "leaderboard")
    return (
      <Zoomed label="Leaderboard" className="v5-zoom-league" onPutDown={onPutDown}>
        <League world={world} />
      </Zoomed>
    );
  if (pickedUp === "settings")
    return (
      <Zoomed label="Settings" className="v5-zoom-settings" onPutDown={onPutDown}>
        <SettingsClipboard todaysPage={todaysPage} />
      </Zoomed>
    );
  return null;
}
