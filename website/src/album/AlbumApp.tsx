import { useCallback } from "react";
import { AlbumWaits, AnswerPage, SettingsAnswerPage, type AppProps } from "../App";
import { NavigateProvider } from "../AppLink";
import { Frame } from "../Frame";
import { ErrorPage } from "../pages/ErrorPage";
import { useTitleFocusOnArrival } from "../pageFocus";
import { returnAddressOf, useRoute } from "../route";
import type { MemberProfile } from "../shell";
import { AlbumShell } from "./AlbumShell";
import { isWaitingForTheBoards, LeaderboardAnswerPage } from "./Leaderboard";
import { placeOf } from "./place";

export default function AlbumApp({ member, actions, useAlbum, useSettings, useThoughtfulBoards }: AppProps & { member: MemberProfile }) {
  const { route, navigate } = useRoute();
  const album = useAlbum(true);
  const onSettings = route.page === "settings";
  const settings = useSettings(onSettings);
  const onLeaderboard = route.page === "leaderboard";
  const boards = useThoughtfulBoards(onLeaderboard);
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
      <AlbumShell album={album} place={placeOf(route, window.location.hash)} busy={(onSettings && settings === undefined) || (onLeaderboard && isWaitingForTheBoards(boards))}
        settings={<SettingsAnswerPage settings={settings} actions={actions} {...answers} />}
        leaderboard={<LeaderboardAnswerPage boards={boards} {...answers} />} onSignOut={actions.signOut} />
    </NavigateProvider>
  );
}
