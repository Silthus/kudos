import { App } from "./App";
import { fixtureReadsFor } from "./fixtureReads";
import { builtShell, fixtureActions } from "./shell";

export default function FixtureApp({ fixture }: { fixture: string | undefined }) {
  return <App visitor={builtShell(fixture)} actions={fixtureActions} {...fixtureReadsFor(fixture)} />;
}
