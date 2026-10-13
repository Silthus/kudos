import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { ClosedPage } from "./pages/ClosedPage";
import { ErrorPage } from "./pages/ErrorPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignedOutPage } from "./pages/SignedOutPage";
import type { ShellFixture } from "./shell";

export function App({ shell }: { shell: ShellFixture }) {
  const atHome = window.location.pathname === "/";
  const member = shell.kind === "member" ? shell.member : undefined;
  return (
    <Frame member={member} atHome={atHome}>
      <ErrorBoundary fallback={<ErrorPage />}>
        <Page shell={shell} atHome={atHome} />
      </ErrorBoundary>
    </Frame>
  );
}

function Page({ shell, atHome }: { shell: ShellFixture; atHome: boolean }) {
  if (shell.kind === "broken") throw new Error("This page failed to render.");
  if (shell.kind === "closed") return <ClosedPage />;
  if (!atHome) return <NotFoundPage />;
  if (shell.kind === "signed-out") return <SignedOutPage />;
  return <HomePage member={shell.member} />;
}
