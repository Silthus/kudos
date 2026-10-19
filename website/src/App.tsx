import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import type { AlbumRead, BoardsRead, HoggiesRead, PersonRead, ProfileRead, WeekRead } from "./album/answer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { AlbumWaits } from "./pages/AlbumWaits";
import { AnswerPage, type Answers } from "./pages/AnswerPage";
import { ErrorPage } from "./pages/ErrorPage";
import { LoadingPage } from "./pages/LoadingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import type { EmojiMappingsRead } from "./emojiMappingsRead";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "./emojiWizardReads";
import type { SettingsRead } from "./settingsRead";
import { returnAddressOf, useRoute, type Route } from "./route";
import type { MemberProfile, ShellActions, ShellState } from "./shell";
import { forgetSignInStarted, rememberSignInStarted, useSignInOutcome, useSignInWhenAsked } from "./signInAttempt";

export type AppReads = Omit<AppProps, "visitor" | "actions">;

export type AppProps = { visitor: ShellState; actions: ShellActions; useSettings: SettingsRead; useEmojiMappings: EmojiMappingsRead; useSlackEmojiMatches: SlackEmojiMatchesRead; useAppEmojis: AppEmojisRead; useAlbum: AlbumRead; useThoughtfulBoards: BoardsRead; useAlbumWeek: WeekRead; useAlbumPerson: PersonRead; useAlbumProfile: ProfileRead; useAlbumHoggies: HoggiesRead };

const AlbumApp = lazy(() => import("./album/AlbumApp"));

export function App(props: AppProps) {
  const { visitor, actions } = props;
  const arrivedFromAnotherPage = useShellArrival(visitor);
  useSignInFinishedForAMember(visitor);
  if (visitor.kind !== "member") return <VisitorApp visitor={visitor} actions={actions} arrivedFromAnotherPage={arrivedFromAnotherPage} />;
  return (
    <Suspense fallback={<AlbumWaits />}>
      <AlbumApp {...props} arrivedFromAnotherPage={arrivedFromAnotherPage} />
    </Suspense>
  );
}

function useSignInFinishedForAMember(visitor: ShellState) {
  const isAMember = visitor.kind === "member";
  useEffect(() => {
    if (isAMember) forgetSignInStarted();
  }, [isAMember]);
}

type Shell = "album" | "visitor";

function useShellArrival(visitor: ShellState) {
  const shown = useRef<{ shell: Shell | undefined; arrived: boolean }>({ shell: undefined, arrived: false });
  const shell = shellOf(visitor);
  if (shell !== undefined && shell !== shown.current.shell) shown.current = { shell, arrived: shown.current.shell !== undefined };
  return shown.current.arrived;
}

function shellOf(visitor: ShellState): Shell | undefined {
  if (visitor.kind === "loading") return undefined;
  return visitor.kind === "member" ? "album" : "visitor";
}

type Visitor = Exclude<ShellState, MemberProfile>;

function VisitorApp({ visitor, actions, arrivedFromAnotherPage }: { visitor: Visitor; actions: ShellActions; arrivedFromAnotherPage: boolean }) {
  const { route } = useRoute();
  const shown = useSignInOutcome(visitor);
  useTitleFocusAfterChange(shown.kind);
  useTitleFocusOnArrival(arrivedFromAnotherPage);
  useTitleFocusWhenTheFocusedElementGoes();
  const signIn = useCallback(() => {
    rememberSignInStarted();
    actions.signIn(returnAddressOf(route));
  }, [actions, route]);
  const takingToSlack = useSignInWhenAsked(shown, signIn);
  const page: Visitor = takingToSlack ? { kind: "loading" } : shown;
  if (page.kind === "signed-out" && route.page !== "not-found") return <SignedOutPage returnTo={returnAddressOf(route)} onSignIn={signIn} />;
  return (
    <Frame busy={page.kind === "loading"}>
      <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
        <VisitorPage state={page} route={route} onSignIn={signIn} onSignOut={actions.signOut} />
      </ErrorBoundary>
    </Frame>
  );
}

function VisitorPage({ state, route, ...answers }: { state: Visitor; route: Route } & Answers) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return <LoadingPage />;
  if (state.kind === "connecting" || state.kind === "closed" || route.page !== "not-found") return <AnswerPage answer={state} {...answers} />;
  return <NotFoundPage />;
}
