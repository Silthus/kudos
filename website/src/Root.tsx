import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { ErrorBoundary, type Failure } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { LiveShell } from "./LiveApp";
import { ErrorPage } from "./pages/ErrorPage";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { builtShell, fixtureActions } from "./shell";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

const fixtureQuests = fixedQuests(questsFixtures.weekWithLastWeeksCrate);

const fixtureBook = fixedBook(bookFixtures.book);

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <App visitor={builtShell(fixture)} actions={fixtureActions} useLeaderboard={fixtureLeaderboard} useQuests={fixtureQuests} useBook={fixtureBook} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
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
