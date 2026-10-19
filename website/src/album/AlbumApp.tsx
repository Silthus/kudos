import { useCallback, useEffect } from "react";
import { AlbumWaits, AnswerPage, SettingsAnswerPage, type AppProps } from "../App";
import { NavigateProvider } from "../AppLink";
import { Frame } from "../Frame";
import { ErrorPage } from "../pages/ErrorPage";
import { useLinkTargetOnceLanded } from "../linkTarget";
import { useTitleFocusOnArrival } from "../pageFocus";
import { currentAddress, keepingSignInCode, returnAddressOf, useRoute } from "../route";
import type { MemberProfile } from "../shell";
import { AlbumShell } from "./AlbumShell";
import { hrefOf, landingStateOf, placeOf, type Place } from "./place";

export default function AlbumApp({ member, actions, useAlbum, useSettings }: AppProps & { member: MemberProfile }) {
  const { route, navigate, replaceAddress } = useRoute();
  const place = placeOf(route, window.location.hash, window.history.state);
  useCanonicalAddress(place, replaceAddress);
  const album = useAlbum(true);
  const onSettings = place.kind === "settings";
  const settings = useSettings(onSettings);
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
      <AlbumShell album={album} place={place} busy={onSettings && settings === undefined} settings={<SettingsAnswerPage settings={settings} actions={actions} {...answers} />} onSignOut={actions.signOut} openThoughtfulPack={actions.openThoughtfulPack} />
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
