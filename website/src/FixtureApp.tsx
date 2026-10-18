import { App } from "./App";
import { fixtureReadsFor } from "./fixtureReads";
import { builtShell, fixtureActions } from "./shell";

export default function FixtureApp({ fixture }: { fixture: string | undefined }) {
  const visitor = builtShell(fixture);
  return <App visitor={visitor} actions={fixtureActions} {...fixtureReadsFor(visitor, fixture)} />;
}
