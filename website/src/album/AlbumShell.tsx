import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { useWideScreen } from "../useWideScreen";
import type { ShareReply, TurnReply } from "../shell";
import type { Album, AlbumLevel, PackOpenReply, SeenReply, UnlockReply } from "./answer";
import { EmojiMoment, useEmojiMoments } from "./EmojiMoment";
import { GettingStarted } from "./GettingStarted";
import { AfterTheLanding, ItemBoard, ItemsWait } from "./ItemBoard";
import { useLevelUnlocks } from "./levelUnlocks";
import { PackOpening, useHeld, type Held } from "./PackOpening";
import { AlbumPage } from "./pages";
import { keyOf, type Place } from "./place";
import { PutInFlights } from "./PutInFlights";
import { useWinShares } from "./ShareWin";
import { Sidebar } from "./Sidebar";
import { teamEmojiOf } from "./teamPage";
import { TopBar, type TopBarPopups } from "./TopBar";
import { UnlockMoment } from "./UnlockMoment";
import { usePuttingIn, type PutInCommands } from "./usePuttingIn";
import { albumAtTheLanding } from "./landedAlbum";
import { TurnFlight } from "./TurnFlight";
import { shownUnless, useEmojisKeptUntilTheLanding, useItemBoard, LandingProvider } from "./useItemBoard";
import { usePopover } from "./usePopover";
import { useTeamUnlock } from "./useTeamUnlock";
import { useXpMomentSequence } from "./useXpMoment";
import type { XpMomentAhead } from "./visitArrival";
import { XpMomentCanvas, XpMomentSummary } from "./XpMoment";
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
  turnItem: (item: string) => Promise<TurnReply>;
  xpMoment: XpMomentAhead;
  endXpMoment: (skipped: boolean) => void;
  shareItem: (item: string) => Promise<ShareReply>;
} & PutInCommands;

export function AlbumShell({ album: answered, place, settings, leaderboard, activity, person, profile, hoggies, levelUp, busy, openThoughtfulPack, putIn, putAllIn, unlockTeamSticker, markEmojisSeen, turnItem, shareItem, xpMoment, endXpMoment }: AlbumShellProps) {
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
  const items = useItemBoard(album.board, turnItem, album.level, keyOf(place));
  const shares = useWinShares(shareItem);
  const flying = items.flight !== null;
  const sinceTheLastVisit = useXpMomentSequence(xpMoment, { itemsWait: (album.board?.items.length ?? 0) > 0, onEnd: endXpMoment });
  const anotherMoment = opening || moment !== null || unlocking.sending !== null || puttingIn.busy || place.kind === "levelUp" || flying || sinceTheLastVisit.waits;
  const emojiMoments = useEmojiMoments(album, anotherMoment, markEmojisSeen, showTheEmojis);
  const levelUnlocks = useLevelUnlocks(album, sinceTheLastVisit, emojiMoments.shownElsewhere);
  const playing = opening || moment !== null || emojiMoments.playing.length > 0;
  const finishUnlocking = (team: string) => {
    emojiMoments.shownElsewhere([`team:${team}`]);
    finish();
  };
  const turns = shownUnless(items, anotherMoment || playing);
  const landed = useEmojisKeptUntilTheLanding(useMemo(() => albumAtTheLanding(album, turns.landing), [album, turns.landing]), turns.landingDue);
  const boardShown = turns.open || flying;
  const covered = boardShown || sinceTheLastVisit.covers;
  const awaitingAMoment = playing || unlocking.sending !== null || covered;
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place));
  useUnlockedFocusAfterTheMoment(moment !== null);
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell" data-xp-moment={sinceTheLastVisit.covers ? "" : undefined}>
      <TopBar album={landed} place={place} wide={wide} popover={popover} justUnlocked={justUnlocked} held={heldLevelOf(held, turns.heldLevel ?? sinceTheLastVisit.heldLevel)} popsTheLevel={sinceTheLastVisit.heldLevel !== null} moving={opening} inert={awaitingAMoment} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} emojiButton={emojiButton} tray={puttingIn} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} onPutAllIn={putEverythingIn} />}
      {moment !== null && <UnlockMoment sticker={moment} collected={album.teams.find(({ team }) => team === moment.team)?.total ?? 0} emoji={teamEmojiOf(album, moment.team)} onDone={() => finishUnlocking(moment.team)} />}
      {emojiMoments.playing.length > 0 && <EmojiMoment key={emojiMoments.playing.map(({ id }) => id).join(" ")} moments={emojiMoments} emojiButton={emojiButton} />}
      {sinceTheLastVisit.play !== null && <XpMomentCanvas play={sinceTheLastVisit.play} me={album.me} levelUnlocks={levelUnlocks} />}
      {boardShown && turns.board !== null && <ItemBoard board={turns.board} turning={turns.turning} trouble={turns.trouble} flight={turns.flight} lead={sinceTheLastVisit.ended === null ? null : <XpMomentSummary moment={sinceTheLastVisit.ended} />} landed={<AfterTheLanding turns={turns} album={album} shares={shares} />} touched={turns.touched} onTouch={turns.touch} onTurn={turns.turn} onLater={turns.later} />}
      {turns.flight !== null && <TurnFlight flight={turns.flight} boxes={turns.boxes} />}
      {album.board !== null && <ItemsWait turns={turns} album={album} shares={shares} />}
      <PutInFlights flights={puttingIn.flights} touchdowns={puttingIn.touchdowns} />
      <p role="status" aria-label="Putting in" className="al-sr">
        {puttingIn.said}
      </p>
      <div className="al-body" inert={playing || covered}>
        <Sidebar album={landed} place={place} wide={wide} />
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "profile" && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <LandingProvider value={turns.landing}>
              <AlbumPage album={landed} place={place} settings={settings} leaderboard={leaderboard} activity={activity} person={person} profile={profile} hoggies={hoggies} levelUp={levelUp(emojiMoments.shownElsewhere, playing)} unlocking={unlocking} />
            </LandingProvider>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function heldLevelOf(held: Held, level: AlbumLevel | null): Held {
  return level === null ? held : { ...held, level };
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
