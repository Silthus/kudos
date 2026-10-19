import { IconLeave } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCapturing } from "../browserAnalytics/capturing";
import { ErrorBoundary } from "../ErrorBoundary";
import { Feedback } from "../Feedback";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { ThemeControl } from "../ThemeControl";
import { useWideScreen } from "../useWideScreen";
import type { Album, PackOpenReply, UnlockReply } from "./answer";
import { GettingStarted } from "./GettingStarted";
import { PackOpening, useHeld } from "./PackOpening";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { Sidebar } from "./Sidebar";
import { teamEmojiOf } from "./teamPage";
import { TopBar } from "./TopBar";
import { UnlockMoment } from "./UnlockMoment";
import { useTeamUnlock } from "./useTeamUnlock";
import "./album.css";

export type AlbumShellProps = {
  album: Album;
  place: Place;
  settings: ReactNode;
  leaderboard: ReactNode;
  person: ReactNode;
  busy: boolean;
  onSignOut: () => void;
  openThoughtfulPack: (pack: string) => Promise<PackOpenReply>;
  unlockTeamSticker: (team: string) => Promise<UnlockReply>;
};

export function AlbumShell({ album: answered, place, settings, leaderboard, person, busy, onSignOut, openThoughtfulPack, unlockTeamSticker }: AlbumShellProps) {
  const wide = useWideScreen();
  const { opening, open, close, packsButton, album: opened, rememberOpened } = usePackOpening(answered);
  const { album, unlocking, moment, finish } = useTeamUnlock(opened, unlockTeamSticker);
  const { held, hold, release } = useHeld();
  const trayButton = useRef<HTMLButtonElement>(null);
  const closeOpening = useCallback(() => {
    release();
    close();
  }, [release, close]);
  const playing = opening || moment !== null;
  const unlockedTeam = moment === null ? undefined : album.teams.find(({ team }) => team === moment.team);
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place), { held: false });
  useGoalFocusAfterTheMoment(moment !== null);
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell">
      <TopBar album={album} place={place} wide={wide} held={held} moving={opening} inert={playing} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} />}
      {moment !== null && unlockedTeam !== undefined && <UnlockMoment team={unlockedTeam} sticker={moment} emoji={teamEmojiOf(album, moment.team)} onDone={finish} />}
      <div className="al-body" inert={playing}>
        <Sidebar album={album} place={place} wide={wide} footer={<Footer onSignOut={onSignOut} />} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "team" && place.team === null && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <AlbumPage album={album} place={place} settings={settings} leaderboard={leaderboard} person={person} unlocking={unlocking} />
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

function Footer({ onSignOut }: { onSignOut: () => void }) {
  const capturer = useCapturing();
  return (
    <>
      <ThemeControl />
      {capturer && <Feedback capturer={capturer} />}
      <Button variant="outline" size="icon" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
        <IconLeave />
      </Button>
    </>
  );
}
