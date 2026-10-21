import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { useWideScreen } from "../useWideScreen";
import type { Album, PackOpenReply, SeenReply, UnlockReply } from "./answer";
import { EmojiMoment, useEmojiMoments } from "./EmojiMoment";
import { GettingStarted } from "./GettingStarted";
import { PackOpening, useHeld } from "./PackOpening";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { PutInFlights } from "./PutInFlights";
import { Sidebar } from "./Sidebar";
import { teamEmojiOf } from "./teamPage";
import { TopBar, type TopBarPopups } from "./TopBar";
import { UnlockMoment } from "./UnlockMoment";
import { usePuttingIn, type PutInCommands } from "./usePuttingIn";
import { usePopover } from "./usePopover";
import { useTeamUnlock } from "./useTeamUnlock";
import { useXpMomentsPrototype } from "./xpMomentsPrototype/XpMomentsPrototype";
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
  levelUp: (emojisShown: (ids: string[]) => void, covered: boolean) => ReactNode;
  busy: boolean;
  openThoughtfulPack: (pack: string) => Promise<PackOpenReply>;
  unlockTeamSticker: (team: string) => Promise<UnlockReply>;
  markEmojisSeen: (ids: string[]) => Promise<SeenReply>;
} & PutInCommands;

export function AlbumShell({ album: answered, place, settings, leaderboard, activity, person, profile, hoggies, levelUp, busy, openThoughtfulPack, putIn, putAllIn, unlockTeamSticker, markEmojisSeen }: AlbumShellProps) {
  const wide = useWideScreen();
  const { opening, open, close, packsButton, album: unopened, rememberOpened } = usePackOpening(answered);
  const trayButton = useRef<HTMLButtonElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
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
  const popover = usePopover<TopBarPopups>();
  const { show } = popover;
  const [justUnlocked, setJustUnlocked] = useState<string[]>([]);
  const showTheEmojis = useCallback(
    (ids: string[]) => {
      setJustUnlocked(ids);
      show("emojis");
    },
    [show],
  );
  const anotherMoment = opening || moment !== null || unlocking.sending !== null || puttingIn.busy || place.kind === "levelUp";
  const emojiMoments = useEmojiMoments(album, anotherMoment, markEmojisSeen, showTheEmojis);
  const playing = opening || moment !== null || emojiMoments.playing.length > 0;
  const finishUnlocking = (team: string) => {
    emojiMoments.shownElsewhere([`team:${team}`]);
    finish();
  };
  const awaitingAMoment = playing || unlocking.sending !== null;
  const xpMoments = useXpMomentsPrototype(album);
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place));
  useUnlockedFocusAfterTheMoment(moment !== null);
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell">
      <TopBar album={xpMoments.album} place={place} wide={wide} popover={popover} justUnlocked={justUnlocked} held={held} moving={opening || xpMoments.moving} inert={awaitingAMoment} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} emojiButton={emojiButton} tray={puttingIn} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} onPutAllIn={putEverythingIn} />}
      {moment !== null && <UnlockMoment sticker={moment} collected={album.teams.find(({ team }) => team === moment.team)?.total ?? 0} emoji={teamEmojiOf(album, moment.team)} onDone={() => finishUnlocking(moment.team)} />}
      {emojiMoments.playing.length > 0 && <EmojiMoment key={emojiMoments.playing.map(({ id }) => id).join(" ")} moments={emojiMoments} emojiButton={emojiButton} />}
      {xpMoments.overlay}
      <PutInFlights flights={puttingIn.flights} touchdowns={puttingIn.touchdowns} />
      <p role="status" aria-label="Putting in" className="al-sr">
        {puttingIn.said}
      </p>
      <div className="al-body" inert={playing}>
        <Sidebar album={album} place={place} wide={wide} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "profile" && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <AlbumPage album={xpMoments.album} place={place} settings={settings} leaderboard={leaderboard} activity={activity} person={person} profile={profile} hoggies={hoggies} levelUp={levelUp(emojiMoments.shownElsewhere, playing)} unlocking={unlocking} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function useUnlockedFocusAfterTheMoment(playing: boolean) {
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playing) document.querySelector<HTMLElement>("main [data-al-unlocked]")?.focus();
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
