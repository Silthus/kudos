import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusAfterChange, useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { useWideScreen } from "../useWideScreen";
import type { HowItWorksCloseReply, QuestsSurface, QuestsViewReply, ShareReply, TurnReply } from "../shell";
import type { Album, AlbumLevel, PackOpenReply, QuestsShown, SeenReply, UnlockReply } from "./answer";
import { EmojiMoment, useEmojiMoments, useEmojisShown } from "./EmojiMoment";
import { useEmojisOnTheirWay, withTheEmojisAway } from "./emojisOnTheirWay";
import { GettingStarted } from "./GettingStarted";
import { HowItWorks } from "./HowItWorks";
import { AfterTheLanding, ItemBoard, ItemsWait } from "./ItemBoard";
import { levelEmojisClimbedTo, useLevelUnlocks } from "./levelUnlocks";
import { PackOpening, useHeld, type Held } from "./PackOpening";
import { playerAskedAt } from "./PlayerPage";
import { mondayQuestsIn, QuestsPanel, QuestsProvider, type ShellQuests } from "./QuestsPanel";
import type { QuestsLanding } from "./questsFold";
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
import { itemTurningOf, ItemTurningProvider, shownUnless, useEmojisKeptUntilTheLanding, useItemBoard, LandingProvider } from "./useItemBoard";
import { usePopover } from "./usePopover";
import { cardShownAt, useHowItWorks } from "./useHowItWorks";
import { useTeamUnlock } from "./useTeamUnlock";
import { MomentGlow } from "./MomentGlow";
import { useXpMomentSequence } from "./useXpMoment";
import type { MissedXpMoment, XpMomentAhead } from "./visitArrival";
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
  missedXpMoment: MissedXpMoment;
  shareItem: (item: string) => Promise<ShareReply>;
  closeHowItWorks: (triedSlack: boolean) => Promise<HowItWorksCloseReply>;
  anEntryIsOpen: boolean;
  quests: QuestsShown | undefined;
  questsLanding: QuestsLanding;
  viewQuests: (surface: QuestsSurface) => Promise<QuestsViewReply>;
} & PutInCommands;

export function AlbumShell({ album: answered, place, settings, leaderboard, activity, person, profile, hoggies, levelUp, busy, openThoughtfulPack, putIn, putAllIn, unlockTeamSticker, markEmojisSeen, turnItem, shareItem, xpMoment, endXpMoment, missedXpMoment, closeHowItWorks, anEntryIsOpen, quests, questsLanding, viewQuests }: AlbumShellProps) {
  const wide = useWideScreen();
  const trayButton = useRef<HTMLButtonElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const { opening, open, close, packsButton, album: unopened, rememberOpened } = usePackOpening(answered, trayButton, emojiButton);
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
  const [opensOnJustUnlocked, setOpensOnJustUnlocked] = useState(false);
  const showTheEmojis = useCallback(
    (ids: string[]) => {
      setJustUnlocked(ids);
      setOpensOnJustUnlocked(true);
      show("emojis");
    },
    [show],
  );
  useEffect(() => {
    if (popover.open !== "emojis") setOpensOnJustUnlocked(false);
  }, [popover.open]);
  const visitCard = useHowItWorks(answered, closeHowItWorks);
  const emojisShown = useEmojisShown(markEmojisSeen);
  const onTheirWay = useEmojisOnTheirWay();
  const turnEmojis = { answered: album.emojis, leave: onTheirWay.leave, back: onTheirWay.home, home: (id: string) => (onTheirWay.home([id]), emojisShown.shownElsewhere([id])) };
  const items = useItemBoard(album.board, turnItem, album.level, keyOf(place), { teachesTheLoop: visitCard.answered === null, emojis: turnEmojis });
  const shares = useWinShares(shareItem);
  const flying = items.flight !== null;
  const sinceTheLastVisit = useXpMomentSequence(xpMoment, { itemsWait: (album.board?.items.length ?? 0) > 0, onEnd: endXpMoment });
  const howItWorks = cardShownAt(visitCard, { landing: items.landing, turning: items.turning, momentWaits: sinceTheLastVisit.waits });
  const anotherMoment = opening || moment !== null || unlocking.sending !== null || puttingIn.busy || place.kind === "levelUp" || flying || sinceTheLastVisit.waits || howItWorks.holds;
  const emojiMoments = useEmojiMoments(album, anotherMoment, emojisShown, showTheEmojis);
  const levelUnlocks = useLevelUnlocks(album, sinceTheLastVisit, emojiMoments.shownElsewhere);
  const notInTheTopBarYet = new Set([...onTheirWay.away, ...levelEmojisClimbedTo(album, sinceTheLastVisit.climbing)]);
  const playing = opening || moment !== null || emojiMoments.playing.length > 0;
  const finishUnlocking = (team: string) => {
    emojiMoments.shownElsewhere([`team:${team}`]);
    finish();
  };
  const turns = shownUnless(items, anotherMoment || playing || anEntryIsOpen);
  const landed = useEmojisKeptUntilTheLanding(useMemo(() => albumAtTheLanding(album, turns.landing), [album, turns.landing]), turns.landingDue);
  const boardShown = turns.open || flying;
  const covered = boardShown || sinceTheLastVisit.covers || howItWorks.card !== null;
  const awaitingAMoment = playing || unlocking.sending !== null || covered;
  const glows = missedXpMoment.glows && !anotherMoment && !awaitingAMoment && (missedXpMoment.moment !== null || turns.offered);
  const collectWhatWaits = () => {
    missedXpMoment.start();
    turns.show();
  };
  const shellQuests = shellQuestsOf(quests, { inSight: !(playing || covered || anEntryIsOpen), openBoard: turns.show, landing: questsLanding, viewQuests });
  useTitleFocusAfterChange(busy ? "loading" : keyOf(place));
  useUnlockedFocusAfterTheMoment(moment !== null);
  useTitleFocusWhenTheFocusedElementGoes();
  return (
    <div className="al-shell" data-xp-moment={sinceTheLastVisit.covers ? "" : undefined} data-emojis-arriving={onTheirWay.away.size > 0 ? "" : undefined}>
      <TopBar album={withTheEmojisAway(landed, notInTheTopBarYet)} place={place} wide={wide} popover={popover} justUnlocked={justUnlocked} opensOnJustUnlocked={opensOnJustUnlocked} held={heldLevelOf(held, turns.heldLevel ?? sinceTheLastVisit.heldLevel)} popsTheLevel={sinceTheLastVisit.heldLevel !== null} moving={opening} inert={awaitingAMoment} glow={glows && <MomentGlow xpWaits={missedXpMoment.moment !== null} board={turns.board} focused={turns.closedByLater} onPress={collectWhatWaits} />} onOpenPacks={open} packsButton={packsButton} trayButton={trayButton} emojiButton={emojiButton} tray={puttingIn} />
      {opening && <PackOpening album={album} openThoughtfulPack={openThoughtfulPack} trayTarget={trayButton} onHold={hold} onOpened={rememberOpened} onClose={closeOpening} onPutAllIn={putEverythingIn} />}
      {moment !== null && <UnlockMoment sticker={moment} collected={album.teams.find(({ team }) => team === moment.team)?.total ?? 0} emoji={teamEmojiOf(album, moment.team)} onDone={() => finishUnlocking(moment.team)} />}
      {emojiMoments.playing.length > 0 && <EmojiMoment key={emojiMoments.playing.map(({ id }) => id).join(" ")} moments={emojiMoments} emojiButton={emojiButton} />}
      {sinceTheLastVisit.play !== null && <XpMomentCanvas play={sinceTheLastVisit.play} me={album.me} levelUnlocks={levelUnlocks} onTheirWay={onTheirWay} />}
      {boardShown && turns.board !== null && <ItemBoard board={turns.board} turning={turns.turning} trouble={turns.trouble} flight={turns.flight} lead={sinceTheLastVisit.ended === null ? null : <XpMomentSummary moment={sinceTheLastVisit.ended} />} landed={<AfterTheLanding turns={turns} album={album} shares={shares} />} touched={turns.touched} onTouch={turns.touch} onTurn={turns.turn} onLater={turns.later} />}
      {turns.flight !== null && <TurnFlight flight={turns.flight} boxes={turns.boxes} />}
      {howItWorks.card !== null && <HowItWorks card={howItWorks.card} onClose={visitCard.close} />}
      {album.board !== null && <ItemsWait turns={turns} album={album} shares={shares} pill={!missedXpMoment.glows} />}
      <PutInFlights flights={puttingIn.flights} touchdowns={puttingIn.touchdowns} />
      <p role="status" aria-label="Putting in" className="al-sr">
        {puttingIn.said}
      </p>
      <div className="al-body" inert={playing || covered}>
        {wide && <Sidebar album={landed} place={place} />}
        <main className="al-main" aria-busy={busy || undefined}>
          {place.kind === "profile" && shellQuests === null && <GettingStarted facts={album.gettingStarted} />}
          <ErrorBoundary key={keyOf(place)} fallback={(failure) => <ErrorPage {...failure} />}>
            <LandingProvider value={turns.landing}>
              <ItemTurningProvider value={itemTurningOf(turns)}>
                <QuestsProvider value={shellQuests}>
                  <AlbumPage album={landed} place={place} settings={settings} leaderboard={leaderboard} activity={activity} person={person} profile={profile} hoggies={hoggies} levelUp={levelUp(emojiMoments.shownElsewhere, playing)} unlocking={unlocking} />
                </QuestsProvider>
              </ItemTurningProvider>
            </LandingProvider>
          </ErrorBoundary>
        </main>
        {shellQuests !== null && <QuestsPanel shown={shellQuests} place={{ key: keyOf(place), asTab: isOwnPageD(album, place), wide }} />}
      </div>
    </div>
  );
}

type QuestsWiring = { inSight: boolean; openBoard: () => void; landing: QuestsLanding; viewQuests: (surface: QuestsSurface) => Promise<QuestsViewReply> };

function shellQuestsOf(quests: QuestsShown | undefined, { viewQuests, ...wiring }: QuestsWiring): ShellQuests | null {
  const monday = mondayQuestsIn(quests);
  return monday === null ? null : { quests: monday, ...wiring, view: (surface) => void viewQuests(surface) };
}

function isOwnPageD(album: Album, place: Place) {
  return playerAskedAt(place, album) === album.me.person;
}

function firstShown(buttons: RefObject<HTMLElement | null>[]) {
  return buttons.find(({ current }) => current !== null)?.current;
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

function usePackOpening(answered: Album, trayButton: RefObject<HTMLElement | null>, emojiButton: RefObject<HTMLElement | null>) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const album = useMemo(() => (opened.size === 0 ? answered : { ...answered, packs: answered.packs.filter(({ pack }) => !opened.has(pack)) }), [answered, opened]);
  const rememberOpened = useCallback((pack: string) => setOpened((packs) => new Set(packs).add(pack)), []);
  const packsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !opening) firstShown([packsButton, trayButton, emojiButton])?.focus();
    wasOpen.current = opening;
  }, [opening, trayButton, emojiButton]);
  const open = useCallback(() => setOpening(true), []);
  const close = useCallback(() => setOpening(false), []);
  return { opening, open, close, packsButton, album, rememberOpened };
}
