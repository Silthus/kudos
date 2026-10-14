import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ActivityRead, ActivityShown } from "../activityRead";
import type { ActivityFilter } from "../route";
import type { Activity } from "../shell";
import { firstPage, hasNewActivity, timeline, type AskedBy, type TimelineState } from "./timeline";

export type Timeline = { state: TimelineState; newActivity: boolean; ask: (by: AskedBy) => void; reset: () => void };

export function useTimeline(filter: ActivityFilter, read: ActivityRead, watched: ActivityShown | undefined): Timeline {
  const [state, dispatch] = useReducer(timeline, filter, firstPage);
  const generation = useRef(0);
  const mounted = useRef(true);
  const watch = watched?.kind === "activity" && state.filter === filter ? watched : undefined;

  const reset = useCallback((to: ActivityFilter) => {
    generation.current += 1;
    dispatch({ kind: "reset", filter: to });
  }, []);

  useEffect(() => {
    if (state.filter !== filter) reset(filter);
  }, [filter, state.filter, reset]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  usePageReads(state, read, { generation, mounted, dispatch });
  useEmptyTimelineTakingTheWatch(state, watch, dispatch);

  const ask = useCallback((by: AskedBy) => dispatch({ kind: "asked", by }), []);
  const resetHere = useCallback(() => reset(state.filter), [reset, state.filter]);
  return { state, newActivity: hasNewActivity(state, watch), ask, reset: resetHere };
}

type Dispatch = (event: Parameters<typeof timeline>[1]) => void;

type Liveness = { generation: { current: number }; mounted: { current: boolean }; dispatch: Dispatch };

function usePageReads(state: TimelineState, read: ActivityRead, { generation, mounted, dispatch }: Liveness) {
  const readFor = useRef<TimelineState | undefined>(undefined);
  useEffect(() => {
    if (state.status !== "first" && state.status !== "loading") return;
    if (readFor.current === state) return;
    readFor.current = state;
    const askedIn = generation.current;
    const stillWanted = () => mounted.current && generation.current === askedIn;
    read({ filter: state.filter, cursor: state.cursor }).then(
      (answer) => {
        if (!stillWanted()) return;
        dispatch(answer.kind === "activity" ? { kind: "read", answer } : { kind: "failed" });
      },
      () => {
        if (stillWanted()) dispatch({ kind: "failed" });
      },
    );
  }, [state, read, generation, mounted, dispatch]);
}

function useEmptyTimelineTakingTheWatch(state: TimelineState, watch: Activity | undefined, dispatch: Dispatch) {
  useEffect(() => {
    if (watch !== undefined) dispatch({ kind: "watched", answer: watch });
  }, [state, watch, dispatch]);
}
