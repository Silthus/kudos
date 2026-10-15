import { useCallback, useLayoutEffect, useRef } from "react";
import { NavigateProvider } from "./AppLink";
import { LevelUpAnnouncement, MomentAnnouncement } from "./crates/MomentAnnouncement";
import { MomentsProvider, useCrateMoments, useMembersShown } from "./crates/moments";
import { isShownOn, readyCratesOf } from "./crates/readyCrates";
import { RevealDialog } from "./crates/RevealDialog";
import { CrateRewardFlight } from "./crates/CrateRewardFlight";
import { ClimbFlight } from "./climb/ClimbFlight";
import { ClimbSummary } from "./climb/ClimbSummary";
import { useClimbOnReturn } from "./climb/useClimbOnReturn";
import { LevelUpCelebration } from "./levelUp/LevelUpCelebration";
import { useLevelUps } from "./levelUp/useLevelUps";
import { rewardsOf, withTheRewardsHeld } from "./crates/rewards";
import type { ActivityRead, ActivityShown, ActivityWatch } from "./activityRead";
import type { BoardAnswer, BoardRead } from "./boardRead";
import type { BookRead, BookShown } from "./bookRead";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { ActivityPage } from "./pages/ActivityPage";
import { HomePage } from "./pages/HomePage";
import { BookPage } from "./pages/BookPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeatureWaitsPage } from "./pages/FeatureWaitsPage";
import { QuestsPage } from "./pages/QuestsPage";
import { SettingsPage } from "./pages/SettingsPage";
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
import { useLinkTargetOnceLanded } from "./linkTarget";
import type { SettingsRead, SettingsShown } from "./settingsRead";
import type { SkillTreeRead, SkillTreeShown } from "./skillTreeRead";
import type { SpotlightDraw } from "./spotlightRead";
import { hrefOf, useRoute, type ActivityFilter, type BookPageId, type Route, type Screen } from "./route";
import type { MemberProfile, Period, ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome, useSignInWhenAsked } from "./signInAttempt";

export type AppReads = Omit<AppProps, "visitor" | "actions">;

type AppProps = { visitor: ShellState; actions: ShellActions; useLeaderboard: BoardRead; useQuests: QuestsRead; useBook: BookRead; useSkillTree: SkillTreeRead; useProfileCard: ProfileCardRead; useRecentKudos: RecentKudosRead; useActivityWatch: ActivityWatch; readActivity: ActivityRead; drawSpotlight: SpotlightDraw; useSettings: SettingsRead };

export function App({ visitor, actions, useLeaderboard, useQuests, useBook, useSkillTree, useProfileCard, useRecentKudos, useActivityWatch, readActivity, drawSpotlight, useSettings }: AppProps) {
  const { route, navigate, choosePeriod, chooseFilter } = useRoute();
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
  const onSettings = member !== undefined && route.page === "settings";
  const settings = useSettings(onSettings);
  const profileCard = useProfileCard(onHome);
  const onActivity = member !== undefined && route.page === "activity";
  const activityWatch = useActivityWatch(onActivity ? route.filter : undefined);
  const activity = useWatchWhileTheNextLoads(activityWatch, onActivity);
  const membersShown = useMembersShown(cratesOf(member));
  const moments = useCrateMoments(actions, { signedOut: member === undefined && !stillAsking(shown), crates: cratesOf(member), onQuests });
  const reveal = member !== undefined ? moments.reveal : undefined;
  const revealing = reveal !== undefined;
  const climb = useClimbOnReturn(member, membersShown, readActivity);
  const memberShown = member === undefined ? undefined : climb.shownOf(withTheRewardsHeld(member, moments.onTheWay));
  const levels = useLevelUps(memberShown, membersShown, climb.climbing);
  const rewards = member === undefined ? [] : rewardsOf(member, moments.onTheWay);
  const { chart } = moments;
  useLayoutEffect(() => chart(rewards), [chart, rewards]);
  useTitleFocusAfterChange(onActivity ? activityPageOf(activity) : onTheBoard ? boardPageOf(board) : onQuests ? questsPageOf(quests) : onBook ? bookPageOf(book) : onSkills ? skillTreePageOf(skillTree) : onSettings ? settingsPageOf(settings) : shown.kind, { held: revealing });
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
  const takingToSlack = useSignInWhenAsked(shown, signIn);
  const page: ShellState = takingToSlack ? { kind: "loading" } : (memberShown ?? shown);
  const busy = page.kind === "loading" || (onTheBoard && answer === undefined) || (onQuests && quests === undefined) || (onBook && book === undefined) || (onSkills && skillTree === undefined) || (onSettings && settings === undefined) || (onActivity && activityWatch === undefined);
  useLinkTargetOnceLanded(route, page.kind === "member" && !busy);
  const signingIn = page.kind === "signed-out" && route.page !== "not-found";
  const readyCrates = member === undefined ? [] : readyCratesOf(member, quests);
  return (
    <NavigateProvider value={arriveAt}>
      <MomentsProvider value={moments}>
        {signingIn ? (
          <SignedOutPage returnTo={hrefOf(route)} onSignIn={signIn} />
        ) : (
          <Frame member={memberShown} ready={readyCrates} readyElsewhere={readyCrates.filter((crate) => !isShownOn(crate, screenOf(route), quests))} current={screenOf(route)} busy={busy} inert={revealing} notice={climb.summary !== undefined && <ClimbSummary text={climb.summary} />} onSignOut={actions.signOut}>
            <ErrorBoundary key={route.page} fallback={(failure) => <ErrorPage {...failure} />}>
              <Page state={page} route={route} board={board} quests={quests} book={book} skillTree={skillTree} settings={settings} profileCard={profileCard} useRecentKudos={useRecentKudos} activity={{ shown: activity, watch: activityWatch, read: readActivity, onChooseFilter: chooseFilter }} drawSpotlight={drawSpotlight} membersShown={membersShown} onChoosePeriod={choosePeriod} onBuyPerk={actions.buyPerk} onSetBoardVisibility={actions.setBoardVisibility} onSwapQuest={actions.swapQuest} settingsActions={actions} onSignIn={signIn} onSignOut={actions.signOut} />
            </ErrorBoundary>
          </Frame>
        )}
        {reveal !== undefined && member !== undefined && (
          <RevealDialog key={reveal.crate.seen} {...reveal} chatUrl={member.chatUrl} questsOpen={questsOpen} othersReady={readyCrates.filter(({ seen }) => seen !== reveal.crate.seen)} onFinish={moments.finish} onClose={moments.close} />
        )}
        {moments.flight !== undefined && member !== undefined && memberShown !== undefined && (
          <CrateRewardFlight key={moments.flight.crate.seen} flight={moments.flight} reward={rewards[0]!} shown={memberShown} onRewardLanded={moments.landed} onLanded={moments.land} />
        )}
        {climb.chips !== undefined && memberShown !== undefined && <ClimbFlight chips={climb.chips} shown={memberShown} onLanded={climb.landed} onFinished={climb.finish} />}
        {levels.levelUp !== undefined && memberShown !== undefined && <LevelUpCelebration key={levels.levelUp.key} levelUp={levels.levelUp} onDone={levels.done} />}
        <MomentAnnouncement text={moments.announcement} />
        <LevelUpAnnouncement text={levels.announcement} />
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

function screenOf(route: Route): Screen | undefined {
  if (route.page === "not-found") return undefined;
  return route.page === "activity" ? "home" : route.page;
}

function activityPageOf(activity: ActivityShown | undefined) {
  return activity === undefined ? "loading" : `activity ${activity.kind}`;
}

function useWatchWhileTheNextLoads(watch: ActivityShown | undefined, onActivity: boolean) {
  const lastShown = useRef<ActivityShown | undefined>(undefined);
  if (!onActivity) lastShown.current = undefined;
  else if (watch !== undefined) lastShown.current = watch;
  return watch ?? lastShown.current;
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

function settingsPageOf(settings: SettingsShown | undefined) {
  return settings === undefined ? "loading" : `settings ${settings.kind}`;
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

type ActivityReads = { shown: ActivityShown | undefined; watch: ActivityShown | undefined; read: ActivityRead; onChooseFilter: (filter: ActivityFilter) => void };

type PageProps = {
  state: ShellState;
  route: Route;
  board: BoardAnswer | undefined;
  quests: QuestsShown | undefined;
  book: BookShown | undefined;
  skillTree: SkillTreeShown | undefined;
  settings: SettingsShown | undefined;
  profileCard: ProfileCardShown | undefined;
  useRecentKudos: RecentKudosRead;
  activity: ActivityReads;
  drawSpotlight: SpotlightDraw;
  membersShown: number;
  onChoosePeriod: (period: Period) => void;
  onBuyPerk: ShellActions["buyPerk"];
  onSetBoardVisibility: ShellActions["setBoardVisibility"];
  onSwapQuest: ShellActions["swapQuest"];
  settingsActions: SettingsActions;
  onSignIn: () => void;
  onSignOut: () => void;
};

function Page({ state, route, board, quests, book, skillTree, settings, profileCard, useRecentKudos, activity, drawSpotlight, membersShown, onChoosePeriod, onBuyPerk, onSetBoardVisibility, onSwapQuest, settingsActions, ...actions }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "connecting" || state.kind === "closed") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "not-found") return <NotFoundPage />;
  if (state.kind !== "member") return <AnswerPage answer={state} {...actions} />;
  if (route.page === "home") return quests?.kind === "connecting" || board?.kind === "connecting" ? <ConnectingPage /> : <HomePage member={state} reads={{ quests, board, card: profileCard }} useRecentKudos={useRecentKudos} />;
  if (route.page === "activity") return <ActivityAnswerPage filter={route.filter} activity={activity} {...actions} />;
  if (route.page === "quests") return <QuestsAnswerPage member={state} quests={quests} onSwapQuest={onSwapQuest} {...actions} />;
  if (route.page === "book") return <BookAnswerPage member={state} book={book} page={route.bookPage} {...actions} />;
  if (route.page === "settings") return <SettingsAnswerPage settings={settings} actions={settingsActions} {...actions} />;
  if (route.page === "skills") return <SkillTreeAnswerPage key={membersShown} member={state} skillTree={skillTree} onBuyPerk={onBuyPerk} {...actions} />;
  if (board === undefined) return null;
  if (board.kind === "not-found") return <NotFoundPage />;
  if (board.kind === "ready" || board.kind === "locked") return <FeatureWaitsPage feature="leaderboard" waiting={board} member={state} />;
  if (board.kind !== "board") return <AnswerPage answer={board} {...actions} />;
  return <LeaderboardPage board={board} coinsShown={state.coins !== null} period={route.period} drawSpotlight={drawSpotlight} onChoosePeriod={onChoosePeriod} onSetBoardVisibility={onSetBoardVisibility} />;
}

type QuestsAnswerPageProps = { member: MemberProfile; quests: QuestsShown | undefined; onSwapQuest: ShellActions["swapQuest"]; onSignIn: () => void; onSignOut: () => void };

function QuestsAnswerPage({ member, quests, onSwapQuest, ...actions }: QuestsAnswerPageProps) {
  if (quests === undefined) return null;
  if (quests.kind === "not-found") return <NotFoundPage />;
  if (quests.kind === "ready" || quests.kind === "locked") return <FeatureWaitsPage feature="quests" waiting={quests} member={member} />;
  if (quests.kind !== "quests") return <AnswerPage answer={quests} {...actions} />;
  return <QuestsPage quests={quests} member={member} swapQuest={onSwapQuest} />;
}

function ActivityAnswerPage({ filter, activity, ...actions }: { filter: ActivityFilter; activity: ActivityReads; onSignIn: () => void; onSignOut: () => void }) {
  const { shown } = activity;
  if (shown === undefined) return null;
  if (shown.kind === "not-found") return <NotFoundPage />;
  if (shown.kind !== "activity") return <AnswerPage answer={shown} {...actions} />;
  return <ActivityPage filter={filter} watch={activity.watch} readActivity={activity.read} onChooseFilter={activity.onChooseFilter} />;
}

type BookAnswerPageProps = { member: MemberProfile; book: BookShown | undefined; page: BookPageId; onSignIn: () => void; onSignOut: () => void };

function BookAnswerPage({ member, book, page, ...actions }: BookAnswerPageProps) {
  if (book === undefined) return null;
  if (book.kind === "not-found") return <NotFoundPage />;
  if (book.kind === "ready" || book.kind === "locked") return <FeatureWaitsPage feature="book" waiting={book} member={member} />;
  if (book.kind !== "book") return <AnswerPage answer={book} {...actions} />;
  return <BookPage book={book} page={page} chatUrl={member.chatUrl} />;
}

type SkillTreeAnswerPageProps = { member: MemberProfile; skillTree: SkillTreeShown | undefined; onBuyPerk: ShellActions["buyPerk"]; onSignIn: () => void; onSignOut: () => void };

function SkillTreeAnswerPage({ member, skillTree, onBuyPerk, ...actions }: SkillTreeAnswerPageProps) {
  if (skillTree === undefined) return null;
  if (skillTree.kind === "not-found") return <NotFoundPage />;
  if (skillTree.kind === "ready" || skillTree.kind === "locked") return <FeatureWaitsPage feature="skillTree" waiting={skillTree} member={member} />;
  if (skillTree.kind !== "tree") return <AnswerPage answer={skillTree} {...actions} />;
  return <SkillTreePage tree={skillTree} level={member.progression?.level} buyPerk={onBuyPerk} />;
}

type SettingsActions = Pick<ShellActions, "setMessageSetting" | "setBoardVisibility" | "pickPrimaryGroup">;

function SettingsAnswerPage({ settings, actions, ...answers }: { settings: SettingsShown | undefined; actions: SettingsActions; onSignIn: () => void; onSignOut: () => void }) {
  if (settings === undefined) return null;
  if (settings.kind === "not-found") return <NotFoundPage />;
  if (settings.kind !== "settings") return <AnswerPage answer={settings} {...answers} />;
  return <SettingsPage settings={settings} actions={actions} />;
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
