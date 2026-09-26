import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { MAX_LEVEL, titleForLevel, xpForLevel } from "../../convex/lib/xp";
import { nf } from "@/lib/format";
import type { Toast } from "./life";

/**
 * The simulator in the world (#144, backend #143): the pure rules the sandbox tab, the HUD clock and
 * the fast-forward window share. What a level is called in the picker, what the clock says, which
 * of your workspaces is the simulator, and the toasts a move of the clock brings.
 */

export type SimulatorState = FunctionReturnType<typeof api.simulator.state>;
export type ActiveSimulator = Extract<SimulatorState, { active: true }>;
export type SimulatorRun = NonNullable<ActiveSimulator["lastRun"]>;

/** The simulator you're looking at right now: active and shown (so it is your current workspace). */
export function shownSimulator(state: SimulatorState | undefined): ActiveSimulator | null {
  return state?.active && state.shown ? state : null;
}

/** Every level you can join at: "Level 7, Gardener, from 900 XP". */
export function levelOptions(): { level: number; label: string }[] {
  return Array.from({ length: MAX_LEVEL }, (_, i) => {
    const level = i + 1;
    return { level, label: `Level ${level}, ${titleForLevel(level)}, from ${nf.format(xpForLevel(level))} XP` };
  });
}

/** The simulator's workspace among yours: it is never a Slack team (convex/simulator.ts `SIM-…`). */
export function isSimulatorWorkspace(w: { slackTeamId: string }) {
  return w.slackTeamId.startsWith("SIM-");
}

/** Whether the workspace you're looking at is your simulator. */
export function inYourSimulator(workspaces: { current: boolean; slackTeamId: string }[]) {
  return workspaces.some((w) => w.current && isSimulatorWorkspace(w));
}

/** The day the simulator started on is day 1. */
export const dayNumber = (state: { dayIndex: number }) => state.dayIndex + 1;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A day key as the clock says it: "Wednesday 14 Oct". */
export function clockDate(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** What the clock reads: "Day 3, Wednesday 14 Oct". */
export function clockLabel(state: { day: string; dayIndex: number }) {
  return `Day ${dayNumber(state)}, ${clockDate(state.day)}`;
}

/** Where a change of the clock leads, if anywhere: the quest board, your garden, the sandbox. */
function linkFor(change: string): Toast["link"] | undefined {
  if (/quest/i.test(change)) return { to: "/quests", label: "Go to the quest signpost" };
  if (/plant for/i.test(change)) return { to: "/garden", label: "Go to your garden" };
  if (/for today are back|spree/i.test(change)) return { to: "/playground", label: "Give in the sandbox" };
  return undefined;
}

/** Each line a move of the clock brought, as a toast of its own under the day it landed on. */
export function advanceToasts(result: { day: string; dayIndex: number; changes: string[] }): Toast[] {
  const title = clockLabel(result);
  return result.changes.map((body) => ({ kind: "clock", title, body, link: linkFor(body) }));
}

/** The bot's note in the sandbox's #general once a fast-forward is over: "The bot played 7 days: 35 kudos, level 3 to 5." */
export function runNote(run: SimulatorRun) {
  const s = run.summary;
  const days = s.daysPlayed === 1 ? "1 day" : `${nf.format(s.daysPlayed)} days`;
  const levels = s.levelsGained > 0 ? `level ${run.fromLevel} to ${run.fromLevel + s.levelsGained}` : `still level ${run.fromLevel}`;
  return `${run.status === "done" ? "The bot played" : "The bot stopped after"} ${days}: ${nf.format(s.kudosGiven)} kudos, ${levels}.`;
}

/** How many levels a fast-forward may play from `level`: up to the top. */
export const levelsLeft = (level: number) => Math.max(0, MAX_LEVEL - level);
