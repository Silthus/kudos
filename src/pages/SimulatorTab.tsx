import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useId, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, inputCls } from "@/components/ui";
import { useViewer } from "@/lib/viewer";
import { dayNumber, isSimulatorWorkspace, levelOptions } from "@/world/simulator";
import { GARDEN_LEVEL } from "../../convex/lib/garden";
import { QUESTS_LEVEL, titleForLevel } from "../../convex/lib/xp";

/**
 * The sandbox's Simulator tab (#144): your own private copy of the game, joined at a level you pick.
 * Starting it switches the world to it (twelve teammates, an empty garden, the HUD at that level);
 * the clock in the HUD moves its days on. From here you restart it at another level, go back to it
 * from the shared demo, or stop it and return to the demo.
 */

const LEVELS = levelOptions();

/** A refused call's reason, in the backend's own words (they're written for the visitor). */
const reason = (e: unknown) => (e instanceof ConvexError && typeof e.data === "string" ? e.data : "That didn't go through. Try again in a moment.");

export function SimulatorTab() {
  const viewer = useViewer();
  const state = useQuery(api.simulator.state, {});
  const start = useMutation(api.simulator.start);
  const reset = useMutation(api.simulator.reset);
  const stop = useMutation(api.simulator.stop);
  const switchWorkspace = useMutation(api.session.switchWorkspace);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerId = useId();
  if (state === undefined) return <div data-simulator-tab className="h-40" aria-busy="true" />;

  const active = state.active ? state : null;
  const level = picked ?? active?.level ?? 1;
  const simulatorMember = viewer.workspaces.find(isSimulatorWorkspace)?.memberId;
  const run = (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    action()
      .catch((e: unknown) => setError(reason(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div data-simulator-tab className="space-y-5">
      <p className="pixel-note max-w-prose px-4 py-3 text-[15px] leading-relaxed text-ink">
        The simulator is your own private copy of the game: twelve teammates, an empty garden and a clock that only moves when you say so. Join at any level, give
        kudos in the Playground tab, and move the days on or let a bot play levels for you from the clock in the corner.
      </p>

      {active && (
        <p className="text-[15px] text-ink">
          {active.shown ? "You're in your simulator" : "Your simulator is waiting"} at <b className="font-semibold">level {active.level}</b>, <b className="font-semibold">day {dayNumber(active)}</b>.
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor={pickerId} className="block text-sm font-semibold text-ink">
          {active ? "Restart at level" : "Join at level"}
        </label>
        <select id={pickerId} value={level} onChange={(e) => setPicked(Number(e.target.value))} className={clsx(inputCls, "max-w-80")} disabled={busy}>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-ink/75">
          <span className="font-display text-base font-medium text-ink">{titleForLevel(level)}.</span> Your garden opens at level {GARDEN_LEVEL}, the quest signpost at level {QUESTS_LEVEL}, and the
          store stall sells from level {QUESTS_LEVEL}. Every level brings a skill point for the elder oak.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!active && (
          <Button variant="primary" disabled={busy} onClick={() => run(() => start({ level }))}>
            Start the simulator
          </Button>
        )}
        {active && !active.shown && simulatorMember && (
          <Button variant="primary" disabled={busy} onClick={() => run(() => switchWorkspace({ memberId: simulatorMember as Id<"members"> }))}>
            Go back to your simulator
          </Button>
        )}
        {active && (
          <>
            <Button variant={active.shown ? "primary" : "outline"} disabled={busy} onClick={() => run(() => reset({ level }))}>
              Restart at level {level}
            </Button>
            <Button disabled={busy} onClick={() => run(() => stop({}))}>
              {active.shown ? "Stop and return to the demo" : "Stop the simulator"}
            </Button>
          </>
        )}
      </div>
      <p role="alert" className="text-sm font-semibold text-ember-deep empty:hidden">
        {error}
      </p>
    </div>
  );
}
