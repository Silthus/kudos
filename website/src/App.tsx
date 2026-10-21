import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import type { AlbumRead, BoardsRead, HoggiesRead, LevelUpRead, PersonRead, ProfileRead, WeekRead, XpMomentRead } from "./album/answer";
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
import type { Member, ShellActions, ShellState } from "./shell";
import { forgetSignInStarted, rememberSignInStarted, useSignInOutcome, useSignInWhenAsked } from "./signInAttempt";

export type AppReads = Omit<AppProps, "visitor" | "actions">;

export type AppProps = { visitor: ShellState; actions: ShellActions; useSettings: SettingsRead; useEmojiMappings: EmojiMappingsRead; useSlackEmojiMatches: SlackEmojiMatchesRead; useAppEmojis: AppEmojisRead; useAlbum: AlbumRead; useThoughtfulBoards: BoardsRead; useAlbumWeek: WeekRead; useAlbumPerson: PersonRead; useAlbumProfile: ProfileRead; useAlbumHoggies: HoggiesRead; useLevelUp: LevelUpRead; useXpMoment: XpMomentRead };

const AlbumApp = lazy(() => import("./album/AlbumApp"));

export function App(props: AppProps) {
  const { visitor, actions } = props;
  const arrivals = useShellArrivals(visitor);
  useSignInFinishedForAMember(visitor);
  if (visitor.kind !== "member") return <VisitorApp visitor={visitor} actions={actions} arrivals={arrivals} />;
  return (
    <Suspense fallback={<AlbumWaits />}>
      <AlbumApp {...props} arrivals={arrivals} />
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

function useShellArrivals(visitor: ShellState) {
  const shown = useRef<{ shell: Shell | undefined; arrivals: number }>({ shell: undefined, arrivals: 0 });
  const shell = shellOf(visitor);
  if (shell !== undefined && shell !== shown.current.shell) shown.current = { shell, arrivals: shown.current.shell === undefined ? 0 : shown.current.arrivals + 1 };
  return shown.current.arrivals;
}

function shellOf(visitor: ShellState): Shell | undefined {
  if (visitor.kind === "loading") return undefined;
  return visitor.kind === "member" ? "album" : "visitor";
}

type NotYetAMember = Exclude<ShellState, Member>;

function VisitorApp({ visitor, actions, arrivals }: { visitor: NotYetAMember; actions: ShellActions; arrivals: number }) {
  const { route } = useRoute();
  const shown = useSignInOutcome(visitor);
  useTitleFocusAfterChange(shown.kind);
  useTitleFocusOnArrival(arrivals);
  useTitleFocusWhenTheFocusedElementGoes();
  const signIn = useCallback(() => {
    rememberSignInStarted();
    actions.signIn(returnAddressOf(route));
  }, [actions, route]);
  const takingToSlack = useSignInWhenAsked(shown, signIn);
  const page: NotYetAMember = takingToSlack ? { kind: "loading" } : shown;
  if (page.kind === "signed-out" && route.page !== "not-found") return <SignedOutPage returnTo={returnAddressOf(route)} onSignIn={signIn} />;
  return (
    <Frame busy={page.kind === "loading"}>
      <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
        <VisitorPage state={page} route={route} onSignIn={signIn} onSignOut={actions.signOut} />
      </ErrorBoundary>
    </Frame>
  );
}

function VisitorPage({ state, route, ...answers }: { state: NotYetAMember; route: Route } & Answers) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return <LoadingPage />;
  if (state.kind === "connecting" || state.kind === "closed" || route.page !== "not-found") return <AnswerPage answer={state} {...answers} />;
  return <NotFoundPage />;
}
