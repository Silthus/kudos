import { useCallback, useLayoutEffect, useRef } from "react";
import { NavigateProvider } from "./AppLink";
import { MomentAnnouncement } from "./crates/MomentAnnouncement";
import { MomentsProvider, useCrateMoments, useMembersShown } from "./crates/moments";
import { readyCratesOf } from "./crates/readyCrates";
import { RevealDialog } from "./crates/RevealDialog";
import { CrateRewardFlight } from "./crates/CrateRewardFlight";
import { rewardsOf, withTheRewardsHeld } from "./crates/rewards";
import type { BoardAnswer, BoardRead } from "./boardRead";
import type { BookRead, BookShown } from "./bookRead";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { BookPage } from "./pages/BookPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeatureWaitsPage } from "./pages/FeatureWaitsPage";
import { QuestsPage } from "./pages/QuestsPage";
import { SkillTreePage } from "./pages/SkillTreePage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage, SignInCard } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import type { ProfileCardRead, ProfileCardShown } from "./profileCardRead";
import type { QuestsRead, QuestsShown } from "./questsRead";
import type { RecentKudosRead } from "./recentKudosRead";
import { useQuestTargetOnceLanded } from "./questTarget";
import type { SkillTreeRead, SkillTreeShown } from "./skillTreeRead";
import { hrefOf, useRoute, type BookPageId, type Route } from "./route";
import type { MemberProfile, Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome, useSignInWhenAsked } from "./signInAttempt";

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: BoardRead; useQuests: QuestsRead; useBook: BookRead; useSkillTree: SkillTreeRead; useProfileCard: ProfileCardRead; useRecentKudos: RecentKudosRead };

export function App({ visitor, actions, useLeaderboard, useQuests, useBook, useSkillTree, useProfileCard, useRecentKudos }: AppProps) {
  const { route, navigate, choosePeriod } = useRoute();
  const shown = useSignInOutcome(visitor);
  const member = shown.kind === "member" ? shown : undefined;
  const onTheBoard = member !== undefined && route.page === "leaderboard";
  const onHome = member !== undefined && route.page === "home";
  const answer = useLeaderboard(onTheBoard ? route.period : onHome && member.leaderboard.kind === "open" ? "week" : undefined);
  const board = useBoardWhileTheNextLoads(answer, onTheBoard);
  const onQuests = member !== undefined && route.page === "quests";
  const questsOpen = isQuestsOpenFor(member);
  const quests = useQuests(onQuests || questsOpen);
  const onBook = member !== undefined && route.page === "book";
  const book = useBook(onBook);
  const onSkills = member !== undefined && route.page === "skills";
  const skillTree = useSkillTree(onSkills);
  const profileCard = useProfileCard(onHome);
  const membersShown = useMembersShown(cratesOf(member));
  const moments = useCrateMoments(actions, { signedOut: member === undefined && !stillAsking(shown), crates: cratesOf(member), onQuests });
  const reveal = member !== undefined ? moments.reveal : undefined;
  const revealing = reveal !== undefined;
  const memberShown = member === undefined ? undefined : withTheRewardsHeld(member, moments.onTheWay);
  const rewards = member === undefined ? [] : rewardsOf(member, moments.onTheWay);
  const { chart } = moments;
  useLayoutEffect(() => chart(rewards), [chart, rewards]);
  useTitleFocusAfterChange(onTheBoard ? boardPageOf(board) : onQuests ? questsPageOf(quests) : onBook ? bookPageOf(book) : onSkills ? skillTreePageOf(skillTree) : shown.kind, { held: revealing });
  useTitleFocusWhenTheFocusedElementGoes();
  const expectArrival = useTitleFocusOnArrival();
  useQuestTargetOnceLanded(route, onQuests && quests?.kind === "quests");
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
  const takingToSlack = useSignInWhenAsked(shown, signIn);
  const page: ShellState = takingToSlack ? { kind: "loading" } : (memberShown ?? shown);
  const signingIn = page.kind === "signed-out" && route.page !== "not-found";
  const readyCrates = member === undefined ? [] : readyCratesOf(member, quests);
  return (
    <NavigateProvider value={arriveAt}>
      <MomentsProvider value={moments}>
        {signingIn ? (
          <SignedOutPage returnTo={hrefOf(route)} onSignIn={signIn} />
        ) : (
          <Frame member={memberShown} ready={readyCrates} current={route.page === "not-found" ? undefined : route.page} busy={page.kind === "loading" || (onTheBoard && answer === undefined) || (onQuests && quests === undefined) || (onBook && book === undefined) || (onSkills && skillTree === undefined)} inert={revealing} onSignOut={actions.signOut}>
            <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
              <Page state={page} route={route} board={board} quests={quests} book={book} skillTree={skillTree} profileCard={profileCard} useRecentKudos={useRecentKudos} membersShown={membersShown} onChoosePeriod={choosePeriod} onBuyPerk={actions.buyPerk} onSetBoardVisibility={actions.setBoardVisibility} onSwapQuest={actions.swapQuest} onSignIn={signIn} onSignOut={actions.signOut} />
            </ErrorBoundary>
          </Frame>
        )}
        {reveal !== undefined && member !== undefined && (
          <RevealDialog key={reveal.crate.seen} {...reveal} chatUrl={member.chatUrl} questsOpen={questsOpen} othersReady={readyCrates.filter(({ seen }) => seen !== reveal.crate.seen)} onFinish={moments.finish} onClose={moments.close} />
        )}
        {moments.flight !== undefined && member !== undefined && memberShown !== undefined && (
          <CrateRewardFlight key={moments.flight.crate.seen} flight={moments.flight} reward={rewards[0]!} shown={memberShown} onRewardLanded={moments.landed} onLanded={moments.land} />
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

function bookPageOf(book: BookShown | undefined) {
  return book === undefined ? "loading" : `book ${book.kind}`;
}

function skillTreePageOf(skillTree: SkillTreeShown | undefined) {
  return skillTree === undefined ? "loading" : `skills ${skillTree.kind}`;
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
  book: BookShown | undefined;
  skillTree: SkillTreeShown | undefined;
  profileCard: ProfileCardShown | undefined;
  useRecentKudos: RecentKudosRead;
  membersShown: number;
  onChoosePeriod: (period: Period) => void;
  onBuyPerk: ShellActions["buyPerk"];
  onSetBoardVisibility: ShellActions["setBoardVisibility"];
  onSwapQuest: ShellActions["swapQuest"];
  onSignIn: () => void;
  onSignOut: () => void;
};

function Page({ state, route, board, quests, book, skillTree, profileCard, useRecentKudos, membersShown, onChoosePeriod, onBuyPerk, onSetBoardVisibility, onSwapQuest, ...actions }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "connecting" || state.kind === "closed") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "not-found") return <NotFoundPage />;
  if (state.kind !== "member") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "home") return quests?.kind === "connecting" || board?.kind === "connecting" ? <ConnectingPage /> : <HomePage member={state} reads={{ quests, board, card: profileCard }} useRecentKudos={useRecentKudos} />;
  if (route.page === "quests") return <QuestsAnswerPage member={state} quests={quests} onSwapQuest={onSwapQuest} {...actions} />;
  if (route.page === "book") return <BookAnswerPage member={state} book={book} page={route.bookPage} {...actions} />;
  if (route.page === "skills") return <SkillTreeAnswerPage key={membersShown} member={state} skillTree={skillTree} onBuyPerk={onBuyPerk} {...actions} />;
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind === "ready" || board.kind === "locked") return <FeatureWaitsPage feature="leaderboard" waiting={board} member={state} />;
  if (board.kind !== "board") return <AnswerPage answer={board} {...actions} />;
  return <LeaderboardPage board={board} period={route.period} onChoosePeriod={onChoosePeriod} onSetBoardVisibility={onSetBoardVisibility} />;
}

type QuestsAnswerPageProps = { member: MemberProfile; quests: QuestsShown | undefined; onSwapQuest: ShellActions["swapQuest"]; onSignIn: () => void; onSignOut: () => void };

function QuestsAnswerPage({ member, quests, onSwapQuest, ...actions }: QuestsAnswerPageProps) {
  if (quests === undefined) return null;
  if (quests.kind === "not-found") return <NotFoundPage />;
  if (quests.kind === "ready" || quests.kind === "locked") return <FeatureWaitsPage feature="quests" waiting={quests} member={member} />;
  if (quests.kind !== "quests") return <AnswerPage answer={quests} {...actions} />;
  return <QuestsPage quests={quests} swapQuest={onSwapQuest} />;
}

type BookAnswerPageProps = { member: MemberProfile; book: BookShown | undefined; page: BookPageId; onSignIn: () => void; onSignOut: () => void };

function BookAnswerPage({ member, book, page, ...actions }: BookAnswerPageProps) {
  if (book === undefined) return null;
  if (book.kind === "not-found") return <NotFoundPage />;
  if (book.kind === "ready" || book.kind === "locked") return <FeatureWaitsPage feature="book" waiting={book} member={member} />;
  if (book.kind !== "book") return <AnswerPage answer={book} {...actions} />;
  return <BookPage book={book} page={page} />;
}

type SkillTreeAnswerPageProps = { member: MemberProfile; skillTree: SkillTreeShown | undefined; onBuyPerk: ShellActions["buyPerk"]; onSignIn: () => void; onSignOut: () => void };

function SkillTreeAnswerPage({ member, skillTree, onBuyPerk, ...actions }: SkillTreeAnswerPageProps) {
  if (skillTree === undefined) return null;
  if (skillTree.kind === "not-found") return <NotFoundPage />;
  if (skillTree.kind === "ready" || skillTree.kind === "locked") return <FeatureWaitsPage feature="skillTree" waiting={skillTree} member={member} />;
  if (skillTree.kind !== "tree") return <AnswerPage answer={skillTree} {...actions} />;
  return <SkillTreePage tree={skillTree} level={member.progression?.level} buyPerk={onBuyPerk} />;
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
      return <SignInCard onSignIn={onSignIn} />;
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
