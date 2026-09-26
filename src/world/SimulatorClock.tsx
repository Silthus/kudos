import clsx from "clsx";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Dialog, inputCls, Progress } from "@/components/ui";
import { nf } from "@/lib/format";
import { xpForLevel } from "../../convex/lib/xp";
import { advanceToasts, clockLabel, levelsLeft, type ActiveSimulator, type SimulatorRun } from "./simulator";
import { pushToasts } from "./toastBus";

/**
 * The simulator's clock (#144): a small parchment note with the simulated day, Next day and Next
 * week (what each move brought comes as the world's toasts, one at a time), and Simulate levels,
 * which opens the fast-forward window: pick how many levels the bot plays, watch its progress
 * (Abort stops it after the day it's on), then read its summary as a ledger.
 *
 * It stands in the HUD, and in the sandbox's window too (`inWindow`): a place's window is modal and
 * covers the HUD, and the sandbox is where you give kudos between moves of the clock.
 */

const reason = (e: unknown) => (e instanceof ConvexError && typeof e.data === "string" ? e.data : "That didn't go through. Try again in a moment.");

export function SimulatorClock({ simulator, inWindow = false }: { simulator: ActiveSimulator; inWindow?: boolean }) {
  const advance = useMutation(api.simulator.advance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  // The run the fast-forward window follows: the latest one when it opens, or the one it starts.
  const [watching, setWatching] = useState<Id<"simulatorRuns"> | null>(null);
  const run = simulator.lastRun;
  const playing = run?.status === "running";
  const top = levelsLeft(simulator.level) === 0;

  const move = (days: number) => {
    setBusy(true);
    setError(null);
    advance({ days })
      .then((result) => pushToasts(advanceToasts(result)))
      .catch((e: unknown) => setError(reason(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section data-simulator-clock aria-label="Simulator clock" className={clsx("pixel-note w-full max-w-96 px-3 py-2 text-ink", !inWindow && "sm:w-auto")}>
      {/* Nunito, not Pixelify: its 5 reads as an S, and a date is mostly numbers. */}
      <p className="text-base font-bold leading-6 tabular">{clockLabel(simulator)}</p>
      {playing && <p className="max-w-80 text-xs text-ink/75">The bot is playing your days. If it seems stuck, abort it under Simulate levels.</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy || playing} onClick={() => move(1)}>
          Next day
        </Button>
        <Button size="sm" variant="primary" disabled={busy || playing} onClick={() => move(7)}>
          Next week
        </Button>
        {top && !run ? (
          <span className="text-xs text-ink/75">You're at the top level.</span>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setWatching(run?._id ?? null);
              setWindowOpen(true);
            }}
          >
            Simulate levels
          </Button>
        )}
      </div>
      <p role="alert" className="max-w-64 text-xs font-semibold text-ember-deep empty:hidden [&:not(:empty)]:mt-1.5">
        {error}
      </p>
      <FastForward open={windowOpen} onClose={() => setWindowOpen(false)} simulator={simulator} watching={watching} onWatch={setWatching} />
    </section>
  );
}

/** The fast-forward window: the choice, the run's progress, then its summary. */
function FastForward({
  open,
  onClose,
  simulator,
  watching,
  onWatch,
}: {
  open: boolean;
  onClose: () => void;
  simulator: ActiveSimulator;
  watching: Id<"simulatorRuns"> | null;
  onWatch: (run: Id<"simulatorRuns"> | null) => void;
}) {
  const fastForward = useMutation(api.simulator.fastForward);
  const abort = useMutation(api.simulator.abort);
  const max = levelsLeft(simulator.level);
  const [levels, setLevels] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerId = useId();
  const run = simulator.lastRun;
  // A run playing is always what the window shows, even one started elsewhere; a finished one only if it's the one followed.
  const shown = run && (run.status === "running" || run._id === watching) ? run : null;
  const phase = !shown ? "pick" : shown.status === "running" ? "playing" : "summary";
  const count = Math.min(levels, max);

  // A new phase replaces the buttons focus was on: focus goes to its heading, not the page.
  const heading = useRef<HTMLParagraphElement>(null);
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (open && lastPhase.current !== phase) heading.current?.focus();
    lastPhase.current = phase;
  }, [phase, open]);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const act = (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    action()
      .catch((e: unknown) => setError(reason(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onClose={onClose} title="Simulate levels" subtitle="A bot plays your days through the real game.">
      {phase === "playing" && shown ? (
        <Progressing run={shown} simulator={simulator} busy={busy} heading={heading} onAbort={() => act(() => abort({}))} />
      ) : phase === "summary" && shown ? (
        <div className="space-y-4">
          <Summary run={shown} heading={heading} onLeave={onClose} />
          {max > 0 && (
            <Button variant="primary" onClick={() => onWatch(null)}>
              Simulate more levels
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p ref={heading} tabIndex={-1} className="text-[15px] leading-relaxed text-ink">
            Each day the bot thanks teammates with thoughtful notes up to your allowance, picks fruit and plants for a teammate when it can. It never takes skills
            or buys from the store stall: those stay yours.
          </p>
          {max === 0 ? (
            <p className="text-[15px] font-semibold text-ink">You're at the top level already.</p>
          ) : (
            <>
              <div>
                <label htmlFor={pickerId} className="block text-sm font-semibold text-ink">
                  Levels to play
                </label>
                <select id={pickerId} value={count} onChange={(e) => setLevels(Number(e.target.value))} className={clsx(inputCls, "mt-2 max-w-40")} disabled={busy}>
                  {Array.from({ length: max }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-ink/75">
                  From level {simulator.level} to level {simulator.level + count}.
                </p>
              </div>
              <Button variant="primary" disabled={busy} onClick={() => act(() => fastForward({ levels: count }).then((id) => onWatch(id)))}>
                Fast-forward {count} {count === 1 ? "level" : "levels"}
              </Button>
            </>
          )}
        </div>
      )}
      <p role="alert" className="text-sm font-semibold text-ember-deep empty:hidden [&:not(:empty)]:mt-3">
        {error}
      </p>
    </Dialog>
  );
}

type HeadingRef = React.RefObject<HTMLParagraphElement | null>;

function Progressing({ run, simulator, busy, heading, onAbort }: { run: SimulatorRun; simulator: ActiveSimulator; busy: boolean; heading: HeadingRef; onAbort: () => void }) {
  const days = run.summary.daysPlayed;
  // By XP, not by level: a one-level run moves too before its level comes.
  const from = xpForLevel(run.fromLevel);
  const span = xpForLevel(run.toLevel) - from;
  return (
    <div className="space-y-3">
      {/* Only the level is announced: the days tick by too often to read out. */}
      <p ref={heading} tabIndex={-1} aria-live="polite" className="text-lg font-bold text-ink tabular">
        Level {Math.min(simulator.level, run.toLevel)} of {run.toLevel}
      </p>
      <Progress value={Math.min(span, Math.max(0, simulator.xp - from))} max={span} height={12} label={`Fast-forward from level ${run.fromLevel} to ${run.toLevel}`} />
      <p className="text-sm text-ink/75">
        {days === 1 ? "1 day played" : `${days} days played`}, {nf.format(run.summary.kudosGiven)} kudos given so far.
      </p>
      <Button variant="danger" disabled={busy} onClick={onAbort}>
        Abort
      </Button>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;

/** The run's summary, a parchment ledger: what the days brought, then a row per level gained. */
function Summary({ run, heading, onLeave }: { run: SimulatorRun; heading: HeadingRef; onLeave: () => void }) {
  const s = run.summary;
  const days = plural(s.daysPlayed, "day", "days");
  const title =
    run.status === "done" ? `Level ${run.toLevel} in ${days}` : run.status === "aborted" ? `You stopped it after ${days}` : (run.stopReason ?? `It stopped after ${days}`).replace(/\.$/, "");
  const rows: [string, string][] = [
    ["Days played", nf.format(s.daysPlayed)],
    ["Kudos given", s.thoughtfulKudos === s.kudosGiven ? `${nf.format(s.kudosGiven)}${s.kudosGiven > 0 ? ", all thoughtful" : ""}` : `${nf.format(s.kudosGiven)}, ${nf.format(s.thoughtfulKudos)} thoughtful`],
    ["Quests", `${nf.format(s.questsCompleted.weekly)} weekly, ${nf.format(s.questsCompleted.daily)} daily, ${plural(s.questsCompleted.sweeps, "clean sweep", "clean sweeps")}`],
    ["Hog coins earned", nf.format(s.coinsEarned)],
    ["Fruit picked", nf.format(s.fruitPicked)],
    ["Plants planted", nf.format(s.plantsPlanted)],
    ["New connections", nf.format(s.newConnections)],
  ];
  return (
    <div className="space-y-3">
      <p ref={heading} tabIndex={-1} className="text-lg font-bold text-ink">
        {title}.
      </p>
      <table data-ledger className="w-full border-collapse text-sm text-ink">
        <tbody>
          {rows.map(([what, value]) => (
            <tr key={what} className="border-b border-parchment-deep">
              <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                {what}
              </th>
              <td className="py-1.5 text-right tabular">{value}</td>
            </tr>
          ))}
          {run.levelDays.map((l) => (
            <tr key={l.level} className="border-b border-parchment-deep">
              <th scope="row" className="py-1.5 pr-3 text-left font-semibold tabular">
                Level {l.level}
              </th>
              <td className="py-1.5 text-right tabular">{plural(l.days, "day", "days")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The bot never takes skills: every level it played left a point for you (lib/xp.ts). */}
      {s.levelsGained > 0 && (
        <p className="text-sm text-ink">
          {s.levelsGained === 1 ? "1 new skill point waits" : `${nf.format(s.levelsGained)} new skill points wait`} for you.{" "}
          <Link to="/skills" onClick={onLeave} className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
            Go to the elder oak
          </Link>
        </p>
      )}
    </div>
  );
}
