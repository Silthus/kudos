import { useCallback, useEffect } from "react";
import { AlbumWaits, AnswerPage, SettingsAnswerPage, type AppProps } from "../App";
import { NavigateProvider } from "../AppLink";
import { Frame } from "../Frame";
import { ClosedPage } from "../pages/ClosedPage";
import { useSectionOnceLanded } from "../linkTarget";
import { useTitleFocusOnArrival } from "../pageFocus";
import { currentAddress, keepingSignInCode, returnAddressOf, useRoute } from "../route";
import type { Album } from "./answer";
import { ActivityAnswerPage } from "./Activity";
import { AlbumShell } from "./AlbumShell";
import { myTeamOf } from "./facts";
import { isWaitingForTheBoards, useBoardsOfPeriod } from "./boardPeriods";
import { useHoggieAddress } from "./hoggieAddress";
import { HoggiesAnswerPage, isWaitingForTheHoggies } from "./Hoggies";
import { LeaderboardAnswerPage } from "./Leaderboard";
import { isWaitingForThePerson, PersonAnswerPage } from "./PersonPage";
import { SharedEmojis } from "./SharedEmojis";
import { AppEmojiSection } from "../settings/AppEmojiList";
import { EmojiWizardHost } from "./findInSlack";
import { isWaitingForTheProfile, ProfileAnswerPage } from "./ProfilePage";
import { hrefOf, landingStateOf, placeOf, type Place } from "./place";
import { isWaitingForTheWeek, useWeekEdition } from "./weekEdition";

export default function AlbumApp({ arrivedFromAnotherPage, actions, useAlbum, useSettings, useEmojiMappings, useSlackEmojiMatches, useAppEmojis, useThoughtfulBoards, useAlbumWeek, useAlbumPerson, useAlbumProfile, useAlbumHoggies }: AppProps & { arrivedFromAnotherPage: boolean }) {
  const { route, navigate, replaceAddress } = useRoute();
  const place = placeOf(route, window.location.hash, window.history.state);
  const album = useAlbum(true);
  useCanonicalAddressOnceShown(place, album?.kind === "album", replaceAddress);
  const onSettings = place.kind === "settings";
  const settings = useSettings(onSettings);
  const onLeaderboard = place.kind === "leaderboard";
  const onProfile = place.kind === "profile";
  const boards = useBoardsOfPeriod(useThoughtfulBoards, onLeaderboard, onProfile);
  const profile = useAlbumProfile(onProfile);
  const onHoggies = place.kind === "hoggies";
  const hoggies = useAlbumHoggies(onProfile || onHoggies);
  const onPerson = place.kind === "person";
  const person = useAlbumPerson(onPerson, place.kind === "person" ? place.person : null);
  const hoggieAddress = useHoggieAddress(navigate, replaceAddress);
  const onActivity = place.kind === "activity";
  const edition = useWeekEdition(useAlbumWeek, onActivity);
  useSectionOnceLanded(route, album?.kind === "album" && onSettings && settings?.kind === "settings");
  const expectArrival = useTitleFocusOnArrival(arrivedFromAnotherPage);
  const arriveAt = useCallback(
    (href: string) => {
      expectArrival();
      navigate(href);
    },
    [expectArrival, navigate],
  );
  const signIn = useCallback(() => actions.signIn(returnAddressOf(route)), [actions, route]);
  const answers = { onSignIn: signIn, onSignOut: actions.signOut };
  if (album === undefined) return <AlbumWaits />;
  if (album.kind !== "album") return <Frame busy={false}>{album.kind === "off" ? <ClosedPage /> : <AnswerPage answer={album} {...answers} />}</Frame>;
  return (
    <NavigateProvider value={arriveAt}>
      <EmojiWizardHost on={album.emojiWizard} emojis={album.emojis} emojiPage={album.emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} mapMyEmoji={actions.mapMyEmoji}>
      <AlbumShell
        album={album}
        place={place}
        busy={(onSettings && settings === undefined) || (onLeaderboard && isWaitingForTheBoards(boards.shown)) || (onActivity && isWaitingForTheWeek(edition)) || (onPerson && isWaitingForThePerson(person)) || (onProfile && isWaitingForTheProfile({ profile, boards: boards.shown, hoggies })) || (onHoggies && isWaitingForTheHoggies(hoggies))}
        settings={<SettingsAnswerPage settings={settings} actions={actions} useEmojiMappings={useEmojiMappings} withThemeAndSignOut albumSections={<AlbumSettingsSections album={album} useAppEmojis={useAppEmojis} useSlackEmojiMatches={useSlackEmojiMatches} mapSlackEmoji={actions.mapSlackEmoji} />} {...answers} />}
        leaderboard={<LeaderboardAnswerPage boards={boards} teams={album.teams} homeTeam={myTeamOf(album)?.team ?? null} {...answers} />}
        activity={<ActivityAnswerPage edition={edition} me={album.me.person} {...answers} />}
        person={<PersonAnswerPage shown={person} album={album} {...answers} />}
        profile={<ProfileAnswerPage album={album} profile={profile} boards={boards.shown} hoggies={hoggies} {...answers} />}
        hoggies={<HoggiesAnswerPage shown={hoggies} place={place.kind === "hoggies" ? place : { hoggie: null }} address={hoggieAddress} {...answers} />}
        openThoughtfulPack={actions.openThoughtfulPack}
        unlockTeamSticker={actions.unlockTeamSticker}
        putIn={actions.putIn}
        putAllIn={actions.putAllIn}
        markEmojisSeen={actions.markEmojisSeen}
      />
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

function useCanonicalAddressOnceShown(place: Place, shown: boolean, replaceAddress: (href: string, state: unknown) => void) {
  const canonical = keepingSignInCode(hrefOf(place));
  const landingState = landingStateOf(place);
  useEffect(() => {
    if (shown && canonical !== currentAddress()) replaceAddress(canonical, landingState);
  });
}
