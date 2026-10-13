import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { ErrorBoundary, type Failure } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { LiveShell } from "./LiveApp";
import { ErrorPage } from "./pages/ErrorPage";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { builtShell, fixtureActions } from "./shell";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <App visitor={builtShell(fixture)} actions={fixtureActions} useLeaderboard={fixtureLeaderboard} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
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
