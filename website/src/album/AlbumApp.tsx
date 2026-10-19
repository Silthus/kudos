import { useCallback, useEffect } from "react";
import { AlbumWaits, AnswerPage, SettingsAnswerPage, type AppProps } from "../App";
import { NavigateProvider } from "../AppLink";
import { Frame } from "../Frame";
import { ErrorPage } from "../pages/ErrorPage";
import { useLinkTargetOnceLanded } from "../linkTarget";
import { useTitleFocusOnArrival } from "../pageFocus";
import { currentAddress, keepingSignInCode, returnAddressOf, useRoute } from "../route";
import type { MemberProfile } from "../shell";
import { ActivityAnswerPage } from "./Activity";
import { AlbumShell } from "./AlbumShell";
import { myTeamOf } from "./facts";
import { isWaitingForTheBoards, useBoardsOfPeriod } from "./boardPeriods";
import { useHoggieAddress } from "./hoggieAddress";
import { HoggiesAnswerPage, isWaitingForTheHoggies } from "./Hoggies";
import { LeaderboardAnswerPage } from "./Leaderboard";
import { isWaitingForThePerson, PersonAnswerPage } from "./PersonPage";
import { isWaitingForTheProfile, ProfileAnswerPage } from "./ProfilePage";
import { hrefOf, landingStateOf, placeOf, type Place } from "./place";
import { isWaitingForTheWeek, useWeekEdition } from "./weekEdition";

export default function AlbumApp({ member, actions, useAlbum, useSettings, useThoughtfulBoards, useAlbumWeek, useAlbumPerson, useAlbumProfile, useAlbumHoggies }: AppProps & { member: MemberProfile }) {
  const { route, navigate, replaceAddress } = useRoute();
  const place = placeOf(route, window.location.hash, window.history.state);
  useCanonicalAddress(place, replaceAddress);
  const album = useAlbum(true);
  const onSettings = place.kind === "settings";
  const settings = useSettings(onSettings);
  const onLeaderboard = place.kind === "leaderboard";
  const onProfile = place.kind === "profile";
  const boards = useBoardsOfPeriod(useThoughtfulBoards, onLeaderboard, onProfile);
  const onOverview = place.kind === "team" && place.team === null && album?.kind === "album" && myTeamOf(album) === undefined;
  const profile = useAlbumProfile(onProfile || onOverview);
  const onHoggies = place.kind === "hoggies";
  const hoggies = useAlbumHoggies(onProfile || onHoggies);
  const onPerson = place.kind === "person";
  const person = useAlbumPerson(onPerson, place.kind === "person" ? place.person : null);
  const hoggieAddress = useHoggieAddress(navigate, replaceAddress);
  const onActivity = place.kind === "activity";
  const edition = useWeekEdition(useAlbumWeek, onActivity);
  useLinkTargetOnceLanded(route, { quest: false, perk: false, crate: false, panel: false, section: album?.kind === "album" && onSettings && settings?.kind === "settings" });
  const expectArrival = useTitleFocusOnArrival();
  const arriveAt = useCallback(
    (href: string) => {
      expectArrival();
      navigate(href);
    },
    [expectArrival, navigate],
  );
  const signIn = useCallback(() => actions.signIn(returnAddressOf(route)), [actions, route]);
  const answers = { onSignIn: signIn, onSignOut: actions.signOut };
  if (album === undefined || album.kind === "off") return <AlbumWaits />;
  if (album.kind !== "album")
    return (
      <Frame member={member} busy={false}>
        {album.kind === "broken" ? <ErrorPage focusWasOnPage={false} /> : <AnswerPage answer={album} {...answers} />}
      </Frame>
    );
  return (
    <NavigateProvider value={arriveAt}>
      <AlbumShell
        album={album}
        place={place}
        busy={(onSettings && settings === undefined) || (onLeaderboard && isWaitingForTheBoards(boards.shown)) || (onActivity && isWaitingForTheWeek(edition)) || (onPerson && isWaitingForThePerson(person)) || (onProfile && isWaitingForTheProfile({ profile, boards: boards.shown, hoggies })) || (onHoggies && isWaitingForTheHoggies(hoggies))}
        settings={<SettingsAnswerPage settings={settings} actions={actions} {...answers} />}
        leaderboard={<LeaderboardAnswerPage boards={boards} teams={album.teams} homeTeam={myTeamOf(album)?.team ?? null} {...answers} />}
        activity={<ActivityAnswerPage edition={edition} me={album.me.person} {...answers} />}
        person={<PersonAnswerPage shown={person} album={album} {...answers} />}
        profile={<ProfileAnswerPage album={album} profile={profile} boards={boards.shown} hoggies={hoggies} {...answers} />}
        hoggies={<HoggiesAnswerPage shown={hoggies} place={place.kind === "hoggies" ? place : { hoggie: null }} address={hoggieAddress} {...answers} />}
        newest={profile?.kind === "profile" ? profile.newest : null}
        onSignOut={actions.signOut}
        openThoughtfulPack={actions.openThoughtfulPack}
        unlockTeamSticker={actions.unlockTeamSticker}
        putIn={actions.putIn}
        putAllIn={actions.putAllIn}
      />
    </NavigateProvider>
  );
}

function useCanonicalAddress(place: Place, replaceAddress: (href: string, state: unknown) => void) {
  const canonical = keepingSignInCode(hrefOf(place));
  const landingState = landingStateOf(place);
  useEffect(() => {
    if (canonical !== currentAddress()) replaceAddress(canonical, landingState);
  });
}
