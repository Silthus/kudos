import { ConvexReactClient } from "convex/react";
import { lazy, Suspense } from "react";
import { LiveShell } from "./LiveApp";
import { ShellBoundary } from "./ShellBoundary";

const FixtureApp = lazy(() => import("./FixtureApp"));

export function Root({ fixture, convexUrl }: { fixture?: string; convexUrl?: string }) {
  return (
    <ShellBoundary>
      {fixture || !convexUrl ? (
        <Suspense>
          <FixtureApp fixture={fixture} />
        </Suspense>
      ) : (
        <LiveShell client={new ConvexReactClient(convexUrl)} />
      )}
    </ShellBoundary>
  );
}
