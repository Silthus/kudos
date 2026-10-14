import { useCallback, useRef, type ReactNode } from "react";
import { NavigateProvider } from "./AppLink";
import { MomentAnnouncement } from "./crates/MomentAnnouncement";
import { MomentsProvider, useCrateMoments } from "./crates/moments";
import { RevealDialog } from "./crates/RevealDialog";
import type { BoardAnswer, BoardRead } from "./boardRead";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LeaderboardWaitsPage } from "./pages/LeaderboardWaitsPage";
import { ReadyPage } from "./pages/ReadyPage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import { hrefOf, useRoute, type Route } from "./route";
import type { MemberProfile, Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome } from "./signInAttempt";

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: BoardRead };

export function App({ visitor, actions, useLeaderboard }: AppProps) {
  const { route, navigate, choosePeriod } = useRoute();
  const shown = useSignInOutcome(visitor);
  const member = shown.kind === "member" ? shown : undefined;
  const onTheBoard = member !== undefined && route.page === "leaderboard";
  const answer = useLeaderboard(onTheBoard ? route.period : undefined);
  const board = useBoardWhileTheNextLoads(answer, onTheBoard);
  const moments = useCrateMoments(actions.openFeature, { signedOut: member === undefined && !stillAsking(shown), crates: cratesOf(member) });
  const reveal = member !== undefined ? moments.reveal : undefined;
  const revealing = reveal !== undefined;
  useTitleFocusAfterChange(onTheBoard ? boardPageOf(board) : shown.kind, { held: revealing });
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
    actions.signIn(hrefOf(route));
  }, [actions, route]);
  return (
    <NavigateProvider value={arriveAt}>
      <MomentsProvider value={moments}>
        <Frame member={member} current={route.page === "not-found" ? undefined : route.page} busy={shown.kind === "loading" || (onTheBoard && answer === undefined)} inert={revealing} onSignOut={actions.signOut}>
          <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
            <Page state={shown} route={route} board={board} onChoosePeriod={choosePeriod} onSignIn={signIn} onSignOut={actions.signOut} />
          </ErrorBoundary>
        </Frame>
        {reveal !== undefined && member !== undefined && (
          <RevealDialog key={reveal.card.seen} {...reveal} chatUrl={member.chatUrl} onFinish={moments.finish} onClose={moments.close} />
        )}
        <MomentAnnouncement text={moments.announcement} />
      </MomentsProvider>
    </NavigateProvider>
  );
}

function cratesOf(member: MemberProfile | undefined) {
  if (member === undefined) return undefined;
  return member.features?.map(({ seen }) => seen) ?? [];
}

function stillAsking(state: ShellState) {
  return state.kind === "loading" || state.kind === "connecting";
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
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind === "ready") return <ReadyPageOf member={state} feature="leaderboard" orElse={<LeaderboardWaitsPage waiting={board} chatUrl={state.chatUrl} />} />;
  if (board.kind === "locked") return <LeaderboardWaitsPage waiting={board} chatUrl={state.chatUrl} />;
  if (board.kind !== "board") return <AnswerPage answer={board} {...actions} />;
  return <LeaderboardPage board={board} period={route.period} onChoosePeriod={onChoosePeriod} />;
}

function ReadyPageOf({ member, feature, orElse }: { member: MemberProfile; feature: "leaderboard"; orElse: ReactNode }) {
  const card = member.features?.find((entry) => entry.feature === feature && entry.state === "ready");
  return card === undefined ? orElse : <ReadyPage card={card} />;
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
