// PROTOTYPE (#625, round 6): the one obvious next step toward a full team: the pack button when a pack is waiting, the unlock button once everyone is in. Never merge to main.
import type { Album, Team } from "../../../round-3/album";
import { nextStepOf, nextStepWords } from "./team";
import { OpenThePack } from "./OpenThePack";

export function NextStep({ album, team, onUnlock, className = "" }: { album: Album; team: Team; onUnlock: () => void; className?: string }) {
  const step = nextStepOf(album, team);
  const readyToUnlock = step.kind === "complete" && team.claimedAt === null;
  return (
    <p className={`r6t-next ${step.kind === "complete" ? "r6t-next-done" : ""} ${className}`}>
      <span>{nextStepWords(step, team)}</span>
      {step.kind === "open-pack" && <OpenThePack />}
      {readyToUnlock && <UnlockButton team={team} onUnlock={onUnlock} />}
    </p>
  );
}

function UnlockButton({ team, onUnlock }: { team: Team; onUnlock: () => void }) {
  return (
    <button type="button" className="r6t-cta r6t-unlock" onClick={onUnlock}>
      <LockOpen />
      Unlock the {team.name} sticker
    </button>
  );
}

function LockOpen() {
  return (
    <svg viewBox="0 0 24 24" className="r6t-unlock-icon" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 7.6-1.8" fill="none" />
    </svg>
  );
}
