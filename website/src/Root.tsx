import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { LiveShell } from "./LiveApp";
import { ErrorPage } from "./pages/ErrorPage";
import { builtShell, fixtureActions } from "./shell";

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <App visitor={builtShell(fixture)} actions={fixtureActions} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
}

export function ShellBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={<FailedShell />}>{children}</ErrorBoundary>;
}

function FailedShell() {
  return (
    <Frame atHome={false} busy={false}>
      <ErrorPage />
    </Frame>
  );
}
