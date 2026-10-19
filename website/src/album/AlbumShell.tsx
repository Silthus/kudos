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
import type { Album, PackOpenReply } from "./answer";
import { GettingStarted } from "./GettingStarted";
import { PackOpening, useHeld } from "./PackOpening";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./album.css";

export type AlbumShellProps = { album: Album; place: Place; settings: ReactNode; leaderboard: ReactNode; activity: ReactNode; busy: boolean; onSignOut: () => void; openThoughtfulPack: (pack: string) => Promise<PackOpenReply> };

export function AlbumShell({ album: answered, place, settings, leaderboard, activity, busy, onSignOut, openThoughtfulPack }: AlbumShellProps) {
  const wide = useWideScreen();
  const { opening, open, close, packsButton, album, rememberOpened } = usePackOpening(answered);
  const { held, hold, release } = useHeld();
  const trayButton = useRef<HTMLButtonElement>(null);
  const closeOpening = useCallback(() => {
    release();
    close();
  }, [release, close]);
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place), { held: false });
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell">
      <TopBar album={album} place={place} wide={wide} held={held} moving={opening} inert={opening} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} />}
      <div className="al-body" inert={opening}>
        <Sidebar album={album} place={place} wide={wide} footer={<Footer onSignOut={onSignOut} />} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "team" && place.team === null && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <AlbumPage album={album} place={place} settings={settings} leaderboard={leaderboard} activity={activity} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
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
