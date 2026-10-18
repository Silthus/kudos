import { ConvexReactClient } from "convex/react";
import { App } from "./App";
import { fixtureReadsFor } from "./fixtureReads";
import { LiveShell } from "./LiveApp";
import { ShellBoundary } from "./ShellBoundary";
import { builtShell, fixtureActions, type ShellState } from "./shell";

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return <ShellBoundary>{fixture || !convexUrl ? <FixtureApp visitor={builtShell(fixture)} fixture={fixture} /> : <LiveShell client={new ConvexReactClient(convexUrl)} />}</ShellBoundary>;
}

function FixtureApp({ visitor, fixture }: { visitor: ShellState; fixture: string | undefined }) {
  return <App visitor={visitor} actions={fixtureActions} {...fixtureReadsFor(visitor, fixture)} />;
}
