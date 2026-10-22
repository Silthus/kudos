import { App } from "./App";
import { arcadeActions, arcadeReadsOf } from "./album/arcade/arcadeFixtures";
import { arrives, startLookSwitch } from "./album/arcade/look";
import { PrototypeBar } from "./album/arcade/PrototypeBar";
import "./album/arcade/arcade.css";
import { fixtureReadsFor } from "./fixtureReads";
import { builtShell, fixtureActions } from "./shell";

const arcadeFixture = "arcade";

if (import.meta.env.VITE_SHELL_FIXTURE === arcadeFixture) startLookSwitch();

export default function FixtureApp({ fixture }: { fixture: string | undefined }) {
  if (fixture !== arcadeFixture) return <App visitor={builtShell(fixture)} actions={fixtureActions} {...fixtureReadsFor(fixture)} />;
  return (
    <>
      <App visitor={builtShell("album")} actions={arcadeActions} {...arcadeReadsOf(fixtureReadsFor("album"), arrives())} />
      <PrototypeBar />
    </>
  );
}
