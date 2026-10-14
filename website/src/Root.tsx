import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { fixtureBookFor } from "./bookFixtures";
import { ErrorBoundary, type Failure } from "./ErrorBoundary";
import { Frame } from "./Frame";
import { LiveShell } from "./LiveApp";
import { ErrorPage } from "./pages/ErrorPage";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixtureProfileCardFor } from "./profileCardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixtureRecentKudos } from "./recentKudosFixtures";
import { builtShell, fixtureActions, type ShellState } from "./shell";
import { fixtureSkillTreeFor } from "./skillTreeFixtures";
import { fixtureSpotlight } from "./spotlightFixtures";

const fixtureLeaderboard = fixedLeaderboard(leaderboardFixtures.midBoard);

const fixtureQuests = fixedQuests(questsFixtures.weekWithLastWeeksCrate);

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <FixtureApp visitor={builtShell(fixture)} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
}

function FixtureApp({ visitor }: { visitor: ShellState }) {
  return <App visitor={visitor} actions={fixtureActions} useLeaderboard={fixtureLeaderboard} useQuests={fixtureQuests} useBook={fixtureBookFor(visitor)} useSkillTree={fixtureSkillTreeFor(visitor)} useProfileCard={fixtureProfileCardFor(visitor)} useRecentKudos={fixtureRecentKudos} drawSpotlight={fixtureSpotlight} />;
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
