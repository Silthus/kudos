import { useCallback, useRef } from "react";
import { NavigateProvider } from "./AppLink";
import { MomentsProvider, useCrateMoments, type Moments } from "./crates/moments";
import { RevealDialog } from "./crates/RevealDialog";
import type { BoardAnswer, BoardRead } from "./boardRead";
import { ErrorBoundary } from "./ErrorBoundary";
import { featureOn } from "./features";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeatureInSlackPage } from "./pages/FeatureInSlackPage";
import { FeatureWaitsPage } from "./pages/FeatureWaitsPage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import { useRoute, type Route } from "./route";
import type { Feature, MemberProfile, Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome } from "./signInAttempt";

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: BoardRead };

export function App({ visitor, actions, useLeaderboard }: AppProps) {
  const { route, navigate, choosePeriod } = useRoute();
  const shown = useSignInOutcome(visitor);
  const member = shown.kind === "member" ? shown : undefined;
  const onTheBoard = member !== undefined && route.page === "leaderboard";
  const answer = useLeaderboard(onTheBoard ? route.period : undefined);
  const board = useBoardWhileTheNextLoads(answer, onTheBoard);
  const moments = useCrateMoments(actions.openFeature, { signedOut: member === undefined && !stillAsking(shown) });
  const revealing = moments.reveal !== undefined && member !== undefined;
  useTitleFocusAfterChange(onTheBoard ? boardPageOf(board) : pageOf(route, member) ?? shown.kind, { held: revealing });
  useTitleFocusWhenTheFocusedElementGoes();
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
      <MomentsProvider value={moments}>
        <Frame member={member} current={route.page === "not-found" ? undefined : route.page} busy={shown.kind === "loading" || (onTheBoard && answer === undefined)} inert={revealing} onSignOut={actions.signOut}>
          <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
            <Page state={shown} route={route} board={board} onChoosePeriod={choosePeriod} onSignIn={signIn} onSignOut={actions.signOut} />
          </ErrorBoundary>
        </Frame>
        {revealing && <RevealDialog key={moments.reveal!.card.seen} {...moments.reveal!} chatUrl={member.chatUrl} onFinish={moments.finish} onClose={moments.close} />}
        <Announcement moments={moments} />
      </MomentsProvider>
    </NavigateProvider>
  );
}

function stillAsking(state: ShellState) {
  return state.kind === "loading" || state.kind === "connecting";
}

function Announcement({ moments }: { moments: Moments }) {
  return (
    <p role="status" data-testid="moment-announcement" className="sr-only">
      {moments.announcement}
    </p>
  );
}

function pageOf(route: Route, member: MemberProfile | undefined) {
  if (member === undefined || route.page === "home" || route.page === "leaderboard" || route.page === "not-found") return undefined;
  return `${route.page} ${cardOf(member, featureOn(route.page))?.state ?? "off"}`;
}

function cardOf(member: MemberProfile, feature: Feature) {
  return member.features?.find((entry) => entry.feature === feature);
}

function boardPageOf(board: BoardAnswer | undefined) {
  return board === undefined ? "loading" : `leaderboard ${board.kind}`;
}

function useBoardWhileTheNextLoads(board: BoardAnswer | undefined, onTheBoard: boolean) {
  const lastShown = useRef<BoardAnswer | undefined>(undefined);
  if (!onTheBoard) lastShown.current = undefined;
  else if (board !== undefined) lastShown.current = board;
  return board ?? lastShown.current;
}

type PageProps = {
  state: ShellState;
  route: Route;
  board: BoardAnswer | undefined;
  onChoosePeriod: (period: Period) => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function Page({ state, route, board, onChoosePeriod, ...actions }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "connecting" || state.kind === "closed") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "not-found") return <NotFoundPage />;
  if (state.kind !== "member") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "home") return <HomePage member={state} />;
  if (route.page !== "leaderboard") return <FeaturePage member={state} feature={featureOn(route.page)} />;
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind === "ready" || board.kind === "locked") return <FeatureWaitsPage name="Leaderboard" waiting={board} readyCard={readyCardOf(state, "leaderboard")} chatUrl={state.chatUrl} />;
  if (board.kind !== "board") return <AnswerPage answer={board} {...actions} />;
  return <LeaderboardPage board={board} period={route.period} onChoosePeriod={onChoosePeriod} />;
}

function FeaturePage({ member, feature }: { member: MemberProfile; feature: Feature }) {
  const card = cardOf(member, feature);
  if (card === undefined) return <NotFoundPage />;
  if (card.state === "open") return <FeatureInSlackPage card={card} chatUrl={member.chatUrl} />;
  const waiting = card.state === "locked" ? { kind: "locked" as const, level: card.level } : { kind: "ready" as const };
  return <FeatureWaitsPage name={card.name} waiting={waiting} readyCard={readyCardOf(member, feature)} chatUrl={member.chatUrl} />;
}

function readyCardOf(member: MemberProfile, feature: Feature) {
  const card = cardOf(member, feature);
  return card?.state === "ready" ? card : undefined;
}

type NotAMember = Exclude<ShellState, { kind: "member" | "loading" }>;

function AnswerPage({ answer, onSignIn, onSignOut }: { answer: NotAMember; onSignIn: () => void; onSignOut: () => void }) {
  switch (answer.kind) {
    case "broken":
      return <ErrorPage focusWasOnPage={false} />;
    case "connecting":
      return <ConnectingPage />;
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
