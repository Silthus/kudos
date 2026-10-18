// PROTOTYPE (#625, round 4): the one obvious next step toward a full team, with the pack button when a pack is already waiting. Never merge to main.
import type { Album, Team } from "../../../round-3/album";
import { nextStepOf, nextStepWords } from "./team";
import { OpenThePack } from "./OpenThePack";

export function NextStep({ album, team, className = "" }: { album: Album; team: Team; className?: string }) {
  const step = nextStepOf(album, team);
  return (
    <p className={`r4t-next ${step.kind === "complete" ? "r4t-next-done" : ""} ${className}`}>
      <span>{nextStepWords(step, team)}</span>
      {step.kind === "open-pack" && (
        <OpenThePack />
      )}
    </p>
  );
}
