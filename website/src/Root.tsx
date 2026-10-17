import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { ErrorBoundary, type Failure } from "./ErrorBoundary";
import { fixtureReadsFor } from "./fixtureReads";
import { Frame } from "./Frame";
import { LiveShell } from "./LiveApp";
import { ErrorPage } from "./pages/ErrorPage";
import { builtShell, fixtureActions, type ShellState } from "./shell";
import { PrototypeBar } from "./prototype/PrototypeBar";
import { WorldProvider } from "./prototype/world";

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <FixtureApp visitor={builtShell(fixture)} fixture={fixture} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
}

function FixtureApp({ visitor, fixture }: { visitor: ShellState; fixture: string | undefined }) {
  return (
    <WorldProvider>
      <App visitor={visitor} actions={fixtureActions} {...fixtureReadsFor(visitor, fixture)} />
      <PrototypeBar />
    </WorldProvider>
  );
}

export function ShellBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={(failure) => <FailedShell {...failure} />}>{children}</ErrorBoundary>;
}

function FailedShell(failure: Failure) {
  return (
    <Frame busy={false}>
      <ErrorPage {...failure} />
    </Frame>
  );
}
