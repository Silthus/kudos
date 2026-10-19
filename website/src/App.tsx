import { lazy, Suspense, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { AlbumRead, BoardsRead, HoggiesRead, PersonRead, ProfileRead, WeekRead } from "./album/answer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { LoadingPage } from "./pages/LoadingPage";
import { SettingsPage, ThemeAndSignOut } from "./pages/SettingsPage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage, SignInCard } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange, useTitleFocusOnArrival, useTitleFocusWhenTheFocusedElementGoes } from "./pageFocus";
import type { EmojiMappingsRead } from "./emojiMappingsRead";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "./emojiWizardReads";
import type { SettingsRead, SettingsShown } from "./settingsRead";
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

export function AlbumWaits() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">
      <LoadingPage />
    </main>
  );
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

type Answers = { onSignIn: () => void; onSignOut: () => void };

export type SettingsActions = Pick<ShellActions, "setMessageSetting" | "setBoardVisibility" | "pickPrimaryGroup" | "linkMyCompanyProfile" | "linkCompanyProfile" | "setWorkspaceSettings" | "mapSlackEmoji">;

type SettingsAnswerPageProps = { settings: SettingsShown | undefined; actions: SettingsActions; useEmojiMappings: EmojiMappingsRead; withThemeAndSignOut?: boolean; albumSections?: ReactNode } & Answers;

export function SettingsAnswerPage({ settings, actions, useEmojiMappings, withThemeAndSignOut = false, albumSections, ...answers }: SettingsAnswerPageProps) {
  if (settings?.kind === "settings") return <SettingsPage settings={settings} actions={actions} useEmojiMappings={useEmojiMappings} themeAndSignOut={withThemeAndSignOut ? { onSignOut: answers.onSignOut } : undefined} albumSections={albumSections} />;
  const answered = <SettingsElsewhere settings={settings} {...answers} />;
  if (!withThemeAndSignOut || !settingsStillMissing(settings)) return answered;
  return (
    <>
      {answered}
      <ThemeAndSignOut onSignOut={answers.onSignOut} />
    </>
  );
}

function SettingsElsewhere({ settings, ...answers }: { settings: Exclude<SettingsShown, { kind: "settings" }> | undefined } & Answers) {
  if (settings === undefined) return <LoadingPage shape="column" />;
  if (settings.kind === "not-found") return <NotFoundPage />;
  return <AnswerPage answer={settings} {...answers} />;
}

function settingsStillMissing(settings: SettingsShown | undefined) {
  return settings === undefined || settings.kind === "not-found" || settings.kind === "broken" || settings.kind === "connecting";
}

export type NotAMember = Exclude<ShellState, { kind: "member" | "loading" }>;

export function AnswerPage({ answer, onSignIn, onSignOut }: { answer: NotAMember } & Answers) {
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
