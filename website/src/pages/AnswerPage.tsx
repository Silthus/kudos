import type { ShellState } from "../shell";
import { ClosedPage } from "./ClosedPage";
import { ConnectingPage } from "./ConnectingPage";
import { ErrorPage } from "./ErrorPage";
import { NotAMemberPage } from "./NotAMemberPage";
import { SignInCard } from "./SignedOutPage";
import { SignInUnfinishedPage } from "./SignInUnfinishedPage";
import { UnverifiedPage } from "./UnverifiedPage";
import { VerifyingPage } from "./VerifyingPage";

export type Answers = { onSignIn: () => void; onSignOut: () => void };

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
