import type { ActivityFilter } from "../route";
import type { Activity, ActivityEntry } from "../shell";

export type EntryId = string;

export type AskedBy = "button" | "scroll";

export type TimelineState = {
  filter: ActivityFilter;
  entries: ActivityEntry[];
  timeZone: string | null;
  cursor: string | null;
  status: "first" | "idle" | "loading" | "failed" | "end";
  askedBy: AskedBy | null;
  landed: boolean;
  added: number;
};

export type TimelineEvent =
  | { kind: "reset"; filter: ActivityFilter }
  | { kind: "asked"; by: AskedBy }
  | { kind: "read"; answer: Activity }
  | { kind: "failed" }
  | { kind: "watched"; answer: Activity };

export function firstPage(filter: ActivityFilter): TimelineState {
  return { filter, entries: [], timeZone: null, cursor: null, status: "first", askedBy: null, landed: false, added: 0 };
}

export function timeline(state: TimelineState, event: TimelineEvent): TimelineState {
  switch (event.kind) {
    case "reset":
      return firstPage(event.filter);
    case "asked":
      return asked(state, event.by);
    case "read":
      return isWaiting(state) ? landed(state, event.answer) : state;
    case "failed":
      return isWaiting(state) ? { ...state, status: "failed" } : state;
    case "watched":
      return takesTheWatch(state, event.answer) ? landed(state, event.answer) : state;
  }
}

function asked(state: TimelineState, by: AskedBy): TimelineState {
  if (state.status === "failed" && !state.landed) return { ...state, status: "first", askedBy: by };
  if (state.status !== "idle" && state.status !== "failed") return state;
  return { ...state, status: "loading", askedBy: by };
}

function isWaiting({ status }: TimelineState) {
  return status === "first" || status === "loading";
}

function landed(state: TimelineState, answer: Activity): TimelineState {
  const added = knownOf(answer.entries);
  return {
    ...state,
    entries: [...state.entries, ...added],
    timeZone: answer.timeZone,
    cursor: answer.cursor,
    status: answer.cursor === null ? "end" : "idle",
    landed: true,
    added: added.length,
  };
}

function takesTheWatch(state: TimelineState, watch: Activity) {
  return state.landed && state.entries.length === 0 && !isWaiting(state) && knownOf(watch.entries).length > 0;
}

export function hasNewActivity(state: TimelineState, watch: Activity | undefined): boolean {
  if (watch === undefined || !state.landed || state.entries.length === 0) return false;
  const shown = new Map(state.entries.map((entry) => [entryIdOf(entry), entry]));
  return knownOf(watch.entries).some((entry) => {
    const copy = shown.get(entryIdOf(entry));
    return copy === undefined || JSON.stringify(copy) !== JSON.stringify(entry);
  });
}

export function entryIdOf(entry: ActivityEntry): EntryId {
  return entry.kind === "levelUp" ? `levelUp:${entry.at}:${entry.level}` : `${entry.kind}:${entry.key}`;
}

const knownKinds = new Set<string>(["kudosReceived", "kudosGiven", "levelUp", "found", "hugReceived", "hugGiven"] satisfies ActivityEntry["kind"][]);

function knownOf(entries: ActivityEntry[]) {
  return entries.filter((entry) => knownKinds.has(entry.kind));
}
