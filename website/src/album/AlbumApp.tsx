import { useCallback, useEffect } from "react";
import type { AppProps } from "../App";
import { AlbumWaits } from "../pages/AlbumWaits";
import { AnswerPage } from "../pages/AnswerPage";
import { SettingsAnswerPage } from "../pages/SettingsAnswerPage";
import { NavigateProvider } from "../AppLink";
import { Frame } from "../Frame";
import { ClosedPage } from "../pages/ClosedPage";
import { useSectionOnceLanded } from "../linkTarget";
import { useTitleFocusAfterChange, useTitleFocusOnArrival } from "../pageFocus";
import { currentAddress, keepingSignInCode, returnAddressOf, useRoute } from "../route";
import { rememberSignInStarted } from "../signInAttempt";
import type { Album, BoardPeriod, HoggiesShown } from "./answer";
import { ActivityAnswerPage } from "./Activity";
import { ActivityPrototype } from "./ActivityPrototype";
import { isPrototypeBuild } from "./PrototypeSwitcher";
import { AlbumShell } from "./AlbumShell";
import { myTeamOf } from "./facts";
import { isWaitingForTheBoards, useBoardsOfPeriod, type AddressedChoice } from "./boardPeriods";
import { useHoggieAddress } from "./hoggieAddress";
import { HoggiesAnswerPage, isWaitingForTheHoggies } from "./Hoggies";
import { NewLabelsProvider, newLabelsSinceOf } from "./newLabels";
import { isWaitingForTheLevelUp, LevelUpAnswerPage } from "./LevelUp";
import { LeaderboardAnswerPage } from "./Leaderboard";
import { isWaitingForThePerson, PersonAnswerPage } from "./PersonPage";
import { isWaitingForThePlayer, PlayerAnswerPage, playerAskedAt } from "./PlayerPage";
import { SharedEmojis } from "./SharedEmojis";
import { AppEmojiSection } from "../settings/AppEmojiList";
import { EmojiWizardHost } from "./findInSlack";
import { isWaitingForTheProfile, ProfileAnswerPage } from "./ProfilePage";
import { addressOf, home, landingStateOf, myPageOf, placeOf, placeShownAt, type MyPage, type Place } from "./place";
import { useQuestsLanding } from "./questsFold";
import { useForge } from "./useForge";
import { useVisitArrival } from "./visitArrival";
import { isWaitingForTheWeek, useWeekEdition } from "./weekEdition";

export default function AlbumApp({ arrivals, actions, useAlbum, useSettings, useEmojiMappings, useSlackEmojiMatches, useAppEmojis, useThoughtfulBoards, useAlbumWeek, useAlbumPerson, useAlbumProfile, useAlbumHoggies, useLevelUp, useXpMoment, usePlayerCard, useQuests }: AppProps & { arrivals: number }) {
  const { route, navigate, replaceAddress } = useRoute();
  const album = useAlbum(true);
  const myPage = myPageOf(album?.kind === "album" ? album : undefined);
  const place = placeShownAt(placeOf(route, window.location.hash, window.history.state), myPage);
  const quests = useQuests(album?.kind === "album");
  const questsLanding = useQuestsLanding();
  const visit = useVisitArrival(album, useXpMoment(album?.kind === "album"), actions);
  const newLabelsSince = newLabelsSinceOf(album, visit.arrivedAt);
  useCanonicalAddressOnceShown(place, myPage, album?.kind === "album", replaceAddress);
  const viewAddress = useViewAddress(myPage, replaceAddress);
  const onSettings = place.kind === "settings";
  const settings = useSettings(onSettings);
  const onLeaderboard = place.kind === "leaderboard";
  const player = album?.kind === "album" ? playerAskedAt(place, album) : null;
  const ownPlayer = album?.kind === "album" && player === album.me.person;
  const onProfile = place.kind === "profile" && player === null;
  const boards = useBoardsOfPeriod(useThoughtfulBoards, onLeaderboard, onProfile, viewAddress && periodAddressedIn(place, viewAddress));
  const profile = useAlbumProfile(onProfile);
  const onHoggies = place.kind === "hoggies";
  const hoggies = useAlbumHoggies(onProfile || onHoggies);
  const playerCards = usePlayerCard(player !== null, player);
  const ownWeek = useAlbumWeek(ownPlayer, undefined);
  const forging = useForge(actions.forgeHoggie);
  const onLevelUp = place.kind === "levelUp";
  const levelUp = useLevelUp(place.kind === "levelUp" ? place.level : null);
  useTheAlbumInsteadOfAClosedReveal(onLevelUp && levelUp?.kind === "off" && album?.kind === "album" && album.board !== null, myPage, replaceAddress);
  const onPerson = place.kind === "person" && player === null;
  const person = useAlbumPerson(onPerson || player !== null, player ?? (place.kind === "person" ? place.person : null));
  const playerReads = { cards: playerCards, week: ownWeek, together: person };
  const hoggieAddress = useHoggieAddress(navigate, replaceAddress);
  const onActivity = place.kind === "activity";
  const edition = useWeekEdition(useAlbumWeek, onActivity, viewAddress && weekAddressedIn(place, viewAddress));
  const expectArrival = useTitleFocusOnArrival(arrivals);
  useTitleFocusAfterChange(album === undefined ? "loading" : album.kind);
  useSectionOnceLanded(route, album?.kind === "album" && onSettings && settings?.kind === "settings");
  const arriveAt = useCallback(
    (href: string) => {
      expectArrival();
      navigate(href);
    },
    [expectArrival, navigate],
  );
  const signIn = useCallback(() => {
    rememberSignInStarted();
    actions.signIn(returnAddressOf(route));
  }, [actions, route]);
  const answers = { onSignIn: signIn, onSignOut: actions.signOut };
  if (album === undefined) return <AlbumWaits />;
  if (album.kind !== "album") return <Frame busy={false}>{album.kind === "off" ? <ClosedPage /> : <AnswerPage answer={album} {...answers} />}</Frame>;
  return (
    <NavigateProvider value={arriveAt}>
      <EmojiWizardHost on={album.emojiWizard} inPlace={album.emojiInPlace} emojis={album.emojis} emojiPage={album.emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} mapMyEmoji={actions.mapMyEmoji}>
      <NewLabelsProvider value={newLabelsSince}>
      <AlbumShell
        album={album}
        place={place}
        busy={(onSettings && settings === undefined) || (onLeaderboard && isWaitingForTheBoards(boards.shown)) || (onActivity && isWaitingForTheWeek(edition)) || (onPerson && isWaitingForThePerson(person)) || (onProfile && isWaitingForTheProfile({ profile, boards: boards.shown, hoggies })) || (onHoggies && isWaitingForTheHoggies(hoggies)) || (onLevelUp && isWaitingForTheLevelUp(levelUp)) || (player !== null && isWaitingForThePlayer(ownPlayer, playerReads))}
        settings={<SettingsAnswerPage settings={settings} actions={actions} useEmojiMappings={useEmojiMappings} albumSections={<AlbumSettingsSections album={album} useAppEmojis={useAppEmojis} useSlackEmojiMatches={useSlackEmojiMatches} mapSlackEmoji={actions.mapSlackEmoji} />} {...answers} />}
        leaderboard={<LeaderboardAnswerPage boards={boards} teams={album.teams} homeTeam={myTeamOf(album)?.team ?? null} {...answers} />}
        activity={isPrototypeBuild ? <ActivityPrototype /> : <ActivityAnswerPage edition={edition} me={album.me.person} {...answers} />}
        person={player !== null ? <PlayerAnswerPage album={album} own={ownPlayer} reads={playerReads} picker={{ useSlackEmojiMatches, pickMyHypeEmoji: actions.pickMyHypeEmoji }} {...answers} /> : <PersonAnswerPage shown={person} album={album} picker={{ useSlackEmojiMatches, pickMyHypeEmoji: actions.pickMyHypeEmoji }} {...answers} />}
        profile={player !== null ? <PlayerAnswerPage album={album} own={ownPlayer} reads={playerReads} picker={{ useSlackEmojiMatches, pickMyHypeEmoji: actions.pickMyHypeEmoji }} {...answers} /> : <ProfileAnswerPage album={album} profile={profile} boards={boards.shown} hoggies={hoggies} {...answers} />}
        levelUp={(emojisShown, covered) => <LevelUpAnswerPage shown={levelUp} covered={covered} onEmojisShown={emojisShown} {...answers} />}
        hoggies={<HoggiesAnswerPage shown={hoggies} place={place.kind === "hoggies" ? place : { hoggie: null }} address={hoggieAddress} makePet={actions.makePet} forging={forging} {...answers} />}
        openThoughtfulPack={actions.openThoughtfulPack}
        unlockTeamSticker={actions.unlockTeamSticker}
        putIn={actions.putIn}
        putAllIn={actions.putAllIn}
        markEmojisSeen={actions.markEmojisSeen}
        pickKudosEmoji={actions.pickKudosEmoji}
        turnItem={actions.turnItem}
        xpMoment={visit.moment}
        endXpMoment={visit.endTheMoment}
        missedXpMoment={visit.missed}
        closeHowItWorks={actions.closeHowItWorks}
        quests={quests}
        questsLanding={questsLanding}
        viewQuests={actions.viewQuests}
        anEntryIsOpen={anEntryIsOpenAt(place, hoggies)}
      />
      </NewLabelsProvider>
      </EmojiWizardHost>
    </NavigateProvider>
  );
}

type AlbumSettingsSectionsProps = { album: Album; useAppEmojis: AppProps["useAppEmojis"]; useSlackEmojiMatches: AppProps["useSlackEmojiMatches"]; mapSlackEmoji: AppProps["actions"]["mapSlackEmoji"] };

function AlbumSettingsSections({ album, useAppEmojis, useSlackEmojiMatches, mapSlackEmoji }: AlbumSettingsSectionsProps) {
  return (
    <>
      <AppEmojiSection useAppEmojis={useAppEmojis} useSlackEmojiMatches={useSlackEmojiMatches} mapSlackEmoji={mapSlackEmoji} />
      {album.sharedEmojis !== null && <SharedEmojis emojis={album.sharedEmojis} emojiPage={album.emojiPage} />}
    </>
  );
}

type ReplaceAddress = (href: string, state: unknown) => void;

function anEntryIsOpenAt(place: Place, hoggies: HoggiesShown | undefined) {
  if (place.kind !== "hoggies" || place.hoggie === null) return false;
  return hoggies === undefined || (hoggies.kind === "hoggies" && hoggies.hoggies.some(({ hoggie }) => hoggie === place.hoggie));
}

function useTheAlbumInsteadOfAClosedReveal(closed: boolean, myPage: MyPage, replaceAddress: ReplaceAddress) {
  useEffect(() => {
    if (closed) replaceAddress(keepingSignInCode(addressOf(home, myPage)), null);
  }, [closed, myPage, replaceAddress]);
}

function useViewAddress(myPage: MyPage, replaceAddress: ReplaceAddress) {
  const replaceTheView = useCallback((place: Place) => replaceAddress(keepingSignInCode(addressOf(place, myPage)), window.history.state), [myPage, replaceAddress]);
  return myPage === null ? null : replaceTheView;
}

function periodAddressedIn(place: Place, viewAddress: (place: Place) => void): AddressedChoice<BoardPeriod> {
  return {
    chosen: (place.kind === "leaderboard" && place.period) || "week",
    choose: (period) => viewAddress(period === "week" ? { kind: "leaderboard" } : { kind: "leaderboard", period }),
  };
}

function weekAddressedIn(place: Place, viewAddress: (place: Place) => void): AddressedChoice<string | undefined> {
  return {
    chosen: place.kind === "activity" ? place.week : undefined,
    choose: (week) => viewAddress(week === undefined ? { kind: "activity" } : { kind: "activity", week }),
  };
}

function useCanonicalAddressOnceShown(place: Place, myPage: MyPage, shown: boolean, replaceAddress: ReplaceAddress) {
  const canonical = keepingSignInCode(addressOf(place, myPage));
  const landingState = landingStateOf(place);
  useEffect(() => {
    if (shown && canonical !== currentAddress()) replaceAddress(canonical, landingState);
  });
}
