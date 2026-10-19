import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { useWideScreen } from "../useWideScreen";
import type { Album, PackOpenReply, UnlockReply } from "./answer";
import { GettingStarted } from "./GettingStarted";
import { PackOpening, useHeld } from "./PackOpening";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { PutInFlights } from "./PutInFlights";
import { Sidebar } from "./Sidebar";
import { teamEmojiOf } from "./teamPage";
import { TopBar } from "./TopBar";
import { UnlockMoment } from "./UnlockMoment";
import { usePuttingIn, type PutInCommands } from "./usePuttingIn";
import { useTeamUnlock } from "./useTeamUnlock";
import "./album.css";

export type AlbumShellProps = {
  album: Album;
  place: Place;
  settings: ReactNode;
  leaderboard: ReactNode;
  activity: ReactNode;
  person: ReactNode;
  profile: ReactNode;
  hoggies: ReactNode;
  busy: boolean;
  openThoughtfulPack: (pack: string) => Promise<PackOpenReply>;
  unlockTeamSticker: (team: string) => Promise<UnlockReply>;
} & PutInCommands;

export function AlbumShell({ album: answered, place, settings, leaderboard, activity, person, profile, hoggies, busy, openThoughtfulPack, putIn, putAllIn, unlockTeamSticker }: AlbumShellProps) {
  const wide = useWideScreen();
  const { opening, open, close, packsButton, album: unopened, rememberOpened } = usePackOpening(answered);
  const trayButton = useRef<HTMLButtonElement>(null);
  const puttingIn = usePuttingIn(unopened, { putIn, putAllIn }, trayButton);
  const { album, unlocking, moment, finish } = useTeamUnlock(puttingIn.album, unlockTeamSticker, { waits: puttingIn.busy });
  const { held, hold, release } = useHeld();
  const closeOpening = useCallback(() => {
    release();
    close();
  }, [release, close]);
  const putEverythingIn = () => {
    closeOpening();
    puttingIn.putAllIn();
  };
  const playing = opening || moment !== null;
  const awaitingAMoment = playing || unlocking.sending !== null;
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place), { held: false });
  useGoalFocusAfterTheMoment(moment !== null);
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell">
      <TopBar album={album} place={place} wide={wide} held={held} moving={opening} inert={awaitingAMoment} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} tray={puttingIn} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} onPutAllIn={putEverythingIn} />}
      {moment !== null && <UnlockMoment sticker={moment} collected={album.teams.find(({ team }) => team === moment.team)?.total ?? 0} emoji={teamEmojiOf(album, moment.team)} onDone={finish} />}
      <PutInFlights album={album} flights={puttingIn.flights} touchdowns={puttingIn.touchdowns} />
      <p role="status" aria-label="Putting in" className="al-sr">
        {puttingIn.said}
      </p>
      <div className="al-body" inert={playing}>
        <Sidebar album={album} place={place} wide={wide} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "profile" && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <AlbumPage album={album} place={place} settings={settings} leaderboard={leaderboard} activity={activity} person={person} profile={profile} hoggies={hoggies} unlocking={unlocking} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function useGoalFocusAfterTheMoment(playing: boolean) {
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playing) document.querySelector<HTMLElement>("main [data-al-goal] h2")?.focus();
    wasPlaying.current = playing;
  }, [playing]);
}

function usePackOpening(answered: Album) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const album = useMemo(() => (opened.size === 0 ? answered : { ...answered, packs: answered.packs.filter(({ pack }) => !opened.has(pack)) }), [answered, opened]);
  const rememberOpened = useCallback((pack: string) => setOpened((packs) => new Set(packs).add(pack)), []);
  const packsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !opening) packsButton.current?.focus();
    wasOpen.current = opening;
  }, [opening]);
  const open = useCallback(() => setOpening(true), []);
  const close = useCallback(() => setOpening(false), []);
  return { opening, open, close, packsButton, album, rememberOpened };
}
