import { useCallback, useRef, type ReactNode } from "react";
import { NavigateProvider } from "./AppLink";
import { MomentAnnouncement } from "./crates/MomentAnnouncement";
import { MomentsProvider, useCrateMoments } from "./crates/moments";
import { readyCratesOf } from "./crates/readyCrates";
import { RevealDialog } from "./crates/RevealDialog";
import type { BoardAnswer, BoardRead } from "./boardRead";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { QuestsPage } from "./pages/QuestsPage";
import { ReadyPage } from "./pages/ReadyPage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { WaitsPage } from "./pages/WaitsPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import type { QuestsRead, QuestsShown } from "./questsRead";
import { hrefOf, useRoute, type Route } from "./route";
import type { Feature, MemberProfile, Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome } from "./signInAttempt";

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: BoardRead; useQuests: QuestsRead };

export function App({ visitor, actions, useLeaderboard, useQuests }: AppProps) {
  const { route, navigate, choosePeriod } = useRoute();
  const shown = useSignInOutcome(visitor);
  const member = shown.kind === "member" ? shown : undefined;
  const onTheBoard = member !== undefined && route.page === "leaderboard";
  const answer = useLeaderboard(onTheBoard ? route.period : undefined);
  const board = useBoardWhileTheNextLoads(answer, onTheBoard);
  const onQuests = member !== undefined && route.page === "quests";
  const questsOpen = isQuestsOpenFor(member);
  const quests = useQuests(onQuests || questsOpen);
  const moments = useCrateMoments(actions, { signedOut: member === undefined && !stillAsking(shown), crates: cratesOf(member), onQuests });
  const reveal = member !== undefined ? moments.reveal : undefined;
  const revealing = reveal !== undefined;
  useTitleFocusAfterChange(onTheBoard ? boardPageOf(board) : onQuests ? questsPageOf(quests) : shown.kind, { held: revealing });
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
        <Frame member={member} ready={member === undefined ? [] : readyCratesOf(member, quests)} current={route.page === "not-found" ? undefined : route.page} busy={shown.kind === "loading" || (onTheBoard && answer === undefined) || (onQuests && quests === undefined)} inert={revealing} onSignOut={actions.signOut}>
          <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
            <Page state={shown} route={route} board={board} quests={quests} onChoosePeriod={choosePeriod} onSignIn={signIn} onSignOut={actions.signOut} />
          </ErrorBoundary>
        </Frame>
        {reveal !== undefined && member !== undefined && (
          <RevealDialog key={reveal.crate.seen} {...reveal} chatUrl={member.chatUrl} questsOpen={questsOpen} onFinish={moments.finish} onClose={moments.close} />
        )}
        <MomentAnnouncement text={moments.announcement} />
      </MomentsProvider>
    </NavigateProvider>
  );
}

function cratesOf(member: MemberProfile | undefined) {
  if (member === undefined) return undefined;
  const journeyCrates = (member.journey ?? []).flatMap(({ seen }) => seen ?? []);
  return [...(member.features?.map(({ seen }) => seen) ?? []), ...journeyCrates];
}

function isQuestsOpenFor(member: MemberProfile | undefined) {
  return member?.features?.some(({ feature, state }) => feature === "quests" && state === "open") ?? false;
}

function stillAsking(state: ShellState) {
  return state.kind === "loading" || state.kind === "connecting";
}

function boardPageOf(board: BoardAnswer | undefined) {
  return board === undefined ? "loading" : `leaderboard ${board.kind}`;
}

function questsPageOf(quests: QuestsShown | undefined) {
  return quests === undefined ? "loading" : `quests ${quests.kind}`;
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
  quests: QuestsShown | undefined;
  onChoosePeriod: (period: Period) => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function Page({ state, route, board, quests, onChoosePeriod, ...actions }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "connecting" || state.kind === "closed") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "not-found") return <NotFoundPage />;
  if (state.kind !== "member") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "home") return <HomePage member={state} />;
  if (route.page === "quests") return <QuestsAnswerPage member={state} quests={quests} {...actions} />;
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind === "ready") return <ReadyPageOf member={state} feature="leaderboard" orElse={<WaitsPage name="Leaderboard" waiting={board} chatUrl={state.chatUrl} />} />;
  if (board.kind === "locked") return <WaitsPage name="Leaderboard" waiting={board} chatUrl={state.chatUrl} />;
  if (board.kind !== "board") return <AnswerPage answer={board} {...actions} />;
  return <LeaderboardPage board={board} period={route.period} onChoosePeriod={onChoosePeriod} />;
}

type QuestsAnswerPageProps = { member: MemberProfile; quests: QuestsShown | undefined; onSignIn: () => void; onSignOut: () => void };

function QuestsAnswerPage({ member, quests, ...actions }: QuestsAnswerPageProps) {
  if (quests === undefined) return null;
  if (quests.kind === "not-found") return <NotFoundPage />;
  if (quests.kind === "ready") return <ReadyPageOf member={member} feature="quests" orElse={<WaitsPage name="Quests" waiting={quests} chatUrl={member.chatUrl} />} />;
  if (quests.kind === "locked") return <WaitsPage name="Quests" waiting={quests} chatUrl={member.chatUrl} />;
  if (quests.kind !== "quests") return <AnswerPage answer={quests} {...actions} />;
  return <QuestsPage quests={quests} />;
}

function ReadyPageOf({ member, feature, orElse }: { member: MemberProfile; feature: Feature; orElse: ReactNode }) {
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
