import { useCallback } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ConnectingPage } from "./pages/ConnectingPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { NotAMemberPage } from "./pages/NotAMemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import { SignInUnfinishedPage } from "./pages/SignInUnfinishedPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifyingPage } from "./pages/VerifyingPage";
import { useTitleFocusAfterChange } from "./pageFocus";
import type { ShellActions, ShellState } from "./shell";
import { rememberSignInStarted, useSignInOutcome } from "./signInAttempt";

export function App({ visitor, actions }: { visitor: ShellState; actions: ShellActions }) {
  const atHome = window.location.pathname === "/";
  const shown = useSignInOutcome(visitor);
  useTitleFocusAfterChange(shown.kind);
  const signIn = useCallback(() => {
    rememberSignInStarted();
    actions.signIn();
  }, [actions]);
  const member = shown.kind === "member" ? shown : undefined;
  return (
    <Frame member={member} atHome={atHome} busy={shown.kind === "loading"} onSignOut={actions.signOut}>
      <ErrorBoundary fallback={(failure) => <ErrorPage {...failure} />}>
        <Page state={shown} atHome={atHome} onSignIn={signIn} onSignOut={actions.signOut} />
      </ErrorBoundary>
    </Frame>
  );
}

type PageProps = { state: ShellState; atHome: boolean; onSignIn: () => void; onSignOut: () => void };

function Page({ state, atHome, onSignIn, onSignOut }: PageProps) {
  if (state.kind === "broken") throw new Error("This page failed to render.");
  if (state.kind === "loading") return null;
  if (state.kind === "connecting") return <ConnectingPage />;
  if (state.kind === "closed") return <ClosedPage />;
  if (!atHome) return <NotFoundPage />;
  switch (state.kind) {
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
    case "member":
      return <HomePage member={state} />;
  }
}
