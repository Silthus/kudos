import { useCallback } from "react";
import { NavigateProvider } from "./AppLink";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import type { LeaderboardRead, MyLeaderboard } from "./leaderboardFixtures";
import { ClosedPage } from "./pages/ClosedPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival } from "./pageFocus";
import { useRoute, type Route } from "./route";
import type { Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome } from "./signInAttempt";

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: LeaderboardRead };

export function App({ visitor, actions, useLeaderboard }: AppProps) {
  const { route, navigate, choosePeriod } = useRoute();
  const shown = useSignInOutcome(visitor);
  const member = shown.kind === "member" ? shown : undefined;
  const board = useLeaderboard(member !== undefined && route.page === "leaderboard" ? route.period : undefined);
  useTitleFocusAfterChange(shown.kind);
  const expectArrival = useTitleFocusOnArrival();
  const arriveAt = useCallback(
    (href: string) => {
      expectArrival();
      navigate(href);
    },
    [expectArrival, navigate],
  );
  const signIn = useCallback(() => {
    rememberSignInStarted();
    actions.signIn();
  }, [actions]);
  return (
    <NavigateProvider value={arriveAt}>
      <Frame member={member} current={route.page === "not-found" ? undefined : route.page} busy={shown.kind === "loading"} onSignOut={actions.signOut}>
        <ErrorBoundary fallback={(failure) => <ErrorPage {...failure} />}>
          <Page state={shown} route={route} board={board} onChoosePeriod={choosePeriod} onSignIn={signIn} onSignOut={actions.signOut} />
        </ErrorBoundary>
      </Frame>
    </NavigateProvider>
  );
}

type PageProps = {
  state: ShellState;
  route: Route;
  board: MyLeaderboard | undefined;
  onChoosePeriod: (period: Period) => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function Page({ state, route, board, onChoosePeriod, ...actions }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "closed") return <ClosedPage />;
  if (route.page === "not-found") return <NotFoundPage />;
  if (state.kind !== "member") return <VisitorPage state={state} {...actions} />;
  if (route.page === "home") return <HomePage member={state} />;
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind !== "board") return <VisitorPage state={board} {...actions} />;
  return <LeaderboardPage board={board} onChoosePeriod={onChoosePeriod} />;
}

type Visitor = Exclude<ShellState, { kind: "member" | "broken" | "loading" }>;

function VisitorPage({ state, onSignIn, onSignOut }: { state: Visitor; onSignIn: () => void; onSignOut: () => void }) {
  switch (state.kind) {
    case "closed":
      return <ClosedPage />;
    case "signed-out":
      return <SignedOutPage onSignIn={onSignIn} />;
    case "sign-in-unfinished":
      return <SignInUnfinishedPage onSignIn={onSignIn} />;
    case "verifying":
      return <VerifyingPage onSignOut={onSignOut} />;
    case "unverified":
      return <UnverifiedPage onSignIn={onSignIn} onSignOut={onSignOut} />;
    case "not-a-member":
      return <NotAMemberPage onSignOut={onSignOut} />;
  }
}
