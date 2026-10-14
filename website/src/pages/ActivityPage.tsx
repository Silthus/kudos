import { IconCheck } from "@posthog/icons";
import { Button, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { dayHeadingOf, dayKeyOf, zoneOf } from "../activity/days";
import { Entry } from "../activity/Entries";
import { entryIdOf, type TimelineState } from "../activity/timeline";
import { useTimeline, type Timeline } from "../activity/useTimeline";
import type { ActivityRead, ActivityShown } from "../activityRead";
import { MemberTabs } from "../home/MemberTabs";
import { PageTitle } from "../PageTitle";
import type { ActivityFilter } from "../route";

const filters: { filter: ActivityFilter; label: string; showing: string; empty: string }[] = [
  { filter: "all", label: "All", showing: "Showing all activity.", empty: "Your activity shows here once you thank someone or reach a level." },
  { filter: "received", label: "Received", showing: "Showing kudos you received.", empty: "Kudos you receive show here." },
  { filter: "given", label: "Given", showing: "Showing kudos you gave.", empty: "Kudos you give show here, with what each one earned." },
];

function filterNamed(filter: ActivityFilter) {
  return filters.find((each) => each.filter === filter)!;
}

type ActivityPageProps = { filter: ActivityFilter; watch: ActivityShown | undefined; readActivity: ActivityRead; onChooseFilter: (filter: ActivityFilter) => void };

export function ActivityPage({ filter, watch, readActivity, onChooseFilter }: ActivityPageProps) {
  const timeline = useTimeline(filter, readActivity, watch);
  const [announcement, announce] = useState("");
  const choose = (chosen: ActivityFilter) => {
    if (chosen === filter) return;
    onChooseFilter(chosen);
    announce(filterNamed(chosen).showing);
  };
  return (
    <div className="flex flex-col gap-6">
      <MemberTabs current="activity" />
      <header className="flex w-full max-w-3xl flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-xl flex-col gap-1">
          <span className="hud-label">Activity</span>
          <PageTitle tab="Activity" size="display">
            Your kudos story
          </PageTitle>
          <p className="mt-1 text-sm text-muted-foreground">Kudos you received and gave, and the levels you reached. Only you see this page.</p>
        </div>
        <FilterSwitch filter={filter} onChoose={choose} />
      </header>
      <TimelineView timeline={timeline} announce={announce} />
      <p role="status" data-testid="activity-announcement" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function FilterSwitch({ filter, onChoose }: { filter: ActivityFilter; onChoose: (filter: ActivityFilter) => void }) {
  return (
    <ToggleGroup variant="outline" size="sm" aria-label="Show" value={[filter]} onValueChange={(chosen) => chosen[0] && onChoose(chosen[0] as ActivityFilter)}>
      {filters.map((each) => {
        const selected = each.filter === filter;
        return (
          <ToggleGroupItem key={each.filter} value={each.filter} className={`min-h-6 ${selected ? "border-primary bg-fill-selected" : ""}`}>
            {selected && <IconCheck data-selected-mark aria-hidden="true" className="size-3.5" />}
            {each.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

type Announce = (text: string) => void;

function TimelineView({ timeline, announce }: { timeline: Timeline; announce: Announce }) {
  const { state, newActivity, ask, reset } = timeline;
  const list = useRef<HTMLDivElement>(null);
  const loadMoreButton = useRef<HTMLButtonElement | null>(null);
  const focusFirstOnLanding = useRef(false);
  useFocusAndWordsAfterEachRead(state, { list, loadMoreButton, focusFirstOnLanding, announce });
  useNewActivityAnnounced(newActivity, announce);
  const showNew = () => {
    focusFirstOnLanding.current = true;
    reset();
  };
  if (!state.landed) return <FirstPageWaiting state={state} onTryAgain={() => ask("button")} />;
  const timeZone = zoneOf(state.timeZone);
  return (
    <div ref={list} className="flex w-full max-w-3xl flex-col gap-4">
      {newActivity && (
        <Button variant="outline" size="sm" className="self-center" onClick={showNew}>
          Show new activity
        </Button>
      )}
      {state.entries.length === 0 && state.status === "end" ? (
        <p data-timeline-empty tabIndex={-1} className="text-sm text-muted-foreground outline-none">
          {filterNamed(state.filter).empty}
        </p>
      ) : (
        <Entries state={state} timeZone={timeZone} />
      )}
      <TimelineEnd state={state} loadMoreButton={loadMoreButton} onLoadMore={() => ask("button")} onNearTheEnd={() => ask("scroll")} />
    </div>
  );
}

function FirstPageWaiting({ state, onTryAgain }: { state: TimelineState; onTryAgain: () => void }) {
  const retrying = state.status === "first" && state.askedBy !== null;
  if (state.status !== "failed" && !retrying) return null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <p>Couldn't load your activity.</p>
      <Button variant="outline" size="sm" aria-disabled={retrying || undefined} onClick={() => !retrying && onTryAgain()}>
        {retrying ? "Loading…" : "Try again"}
      </Button>
    </div>
  );
}

function Entries({ state, timeZone }: { state: TimelineState; timeZone: string | undefined }) {
  const now = Date.now();
  return (
    <ol aria-label="Your activity" className="relative flex flex-col gap-3 before:absolute before:top-6 before:bottom-2 before:left-[1.25rem] before:w-px before:bg-muted-foreground/40">
      {state.entries.map((entry, index) => {
        const day = dayKeyOf(entry.at, timeZone);
        const startsADay = index === 0 || dayKeyOf(state.entries[index - 1]!.at, timeZone) !== day;
        return (
          <li key={entryIdOf(entry)} className="flex flex-col gap-3">
            {startsADay && <h2 className="relative z-10 ml-[3.25rem] pt-2 text-xs font-semibold text-muted-foreground first:pt-0">{dayHeadingOf(entry.at, now, timeZone)}</h2>}
            <Entry entry={entry} index={index} timeZone={timeZone} />
          </li>
        );
      })}
    </ol>
  );
}

type TimelineEndProps = { state: TimelineState; loadMoreButton: RefObject<HTMLButtonElement | null>; onLoadMore: () => void; onNearTheEnd: () => void };

function TimelineEnd({ state, loadMoreButton, onLoadMore, onNearTheEnd }: TimelineEndProps) {
  const end = useRef<HTMLDivElement>(null);
  useNearTheEnd(end, state, onNearTheEnd);
  if (state.status === "end") {
    if (state.entries.length === 0) return null;
    return (
      <p data-timeline-start tabIndex={-1} className="ml-[3.25rem] text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        That's the start of your activity.
      </p>
    );
  }
  const loading = state.status === "loading";
  return (
    <div ref={end} className="ml-[3.25rem] flex">
      <Button ref={loadMoreButton} variant="outline" size="sm" aria-disabled={loading || undefined} onClick={() => !loading && onLoadMore()}>
        {loading ? "Loading…" : state.status === "failed" ? "Try again" : "Load more"}
      </Button>
    </div>
  );
}

function useNearTheEnd(end: RefObject<HTMLDivElement | null>, state: TimelineState, onNearTheEnd: () => void) {
  const nearTheEnd = useRef(onNearTheEnd);
  nearTheEnd.current = onNearTheEnd;
  useEffect(() => {
    const target = end.current;
    if (state.status !== "idle" || target === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((seen) => seen.some(({ isIntersecting }) => isIntersecting) && nearTheEnd.current(), { rootMargin: "100% 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [end, state.status, state.entries.length, state.cursor]);
}

type FocusPlaces = { list: RefObject<HTMLDivElement | null>; loadMoreButton: RefObject<HTMLButtonElement | null>; focusFirstOnLanding: RefObject<boolean>; announce: Announce };

function useFocusAndWordsAfterEachRead(state: TimelineState, { list, loadMoreButton, focusFirstOnLanding, announce }: FocusPlaces) {
  const before = useRef(state);
  const heldTheButton = useButtonHeld(loadMoreButton);
  useLayoutEffect(() => {
    const was = before.current;
    before.current = state;
    if (was === state) return;
    const place = list.current;
    const at = (selector: string) => place?.querySelector<HTMLElement>(selector) ?? null;
    if (was.status === "first" && state.status === "failed") announce("Couldn't load your activity.");
    if (was.status === "first" && state.landed && focusFirstOnLanding.current) {
      focusFirstOnLanding.current = false;
      (at('[data-entry-index="0"]') ?? at("[data-timeline-empty]"))?.focus();
    }
    if (was.status === "loading" && state.status === "failed") announce("Couldn't load more. Try again.");
    if (was.status !== "loading" || (state.status !== "idle" && state.status !== "end")) return;
    if (state.added > 0) announce(`Loaded ${state.added} more.`);
    if (!heldTheButton()) return;
    const firstNew = state.added > 0 && state.askedBy === "button" ? at(`[data-entry-index="${state.entries.length - state.added}"]`) : null;
    (firstNew ?? (state.status === "end" ? at("[data-timeline-start]") : null))?.focus();
  }, [state, list, focusFirstOnLanding, announce, heldTheButton]);
}

function useButtonHeld(button: RefObject<HTMLButtonElement | null>) {
  const lastButton = useRef<HTMLButtonElement | null>(null);
  const lastFocused = useRef<EventTarget | null>(null);
  if (button.current !== null) lastButton.current = button.current;
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      lastFocused.current = event.target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  return useRef(() => {
    const held = button.current ?? lastButton.current;
    if (held === null || lastFocused.current !== held) return false;
    return document.activeElement === held || document.activeElement === document.body || document.activeElement === null;
  }).current;
}

function useNewActivityAnnounced(newActivity: boolean, announce: Announce) {
  const announced = useRef(false);
  useEffect(() => {
    if (newActivity && !announced.current) announce("New activity.");
    announced.current = newActivity;
  }, [newActivity, announce]);
}
