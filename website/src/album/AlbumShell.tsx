import { IconLeave } from "@posthog/icons";
import { Button } from "@posthog/quill";
import type { ReactNode } from "react";
import { useCapturing } from "../browserAnalytics/capturing";
import { Feedback } from "../Feedback";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { ThemeControl } from "../ThemeControl";
import { useWideScreen } from "../useWideScreen";
import type { Album } from "./answer";
import { GettingStarted } from "./GettingStarted";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./album.css";

export type AlbumShellProps = { album: Album; place: Place; settings: ReactNode; busy: boolean; onSignOut: () => void };

export function AlbumShell({ album, place, settings, busy, onSignOut }: AlbumShellProps) {
  const wide = useWideScreen();
  useTitleFocusAfterChange(keyOf(place), { held: false });
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell">
      <TopBar album={album} place={place} wide={wide} />
      <div className="al-body">
        <Sidebar album={album} place={place} wide={wide} footer={<Footer onSignOut={onSignOut} />} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "team" && place.team === null && <GettingStarted facts={album.gettingStarted} />}
          <AlbumPage album={album} place={place} settings={settings} />
        </main>
      </div>
    </div>
  );
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
