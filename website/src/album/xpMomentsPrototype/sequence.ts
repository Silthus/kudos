// PROTOTYPE (Silthus/personal#98), throwaway: the beat sequencer and the XP flight into the real top-bar XP bar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumLevel } from "../answer";
import { levelOf, xpToReach, type Excerpt, type Pace, type Scenario } from "./moments";

export type Beat = { kind: "excerpt"; excerpt: Excerpt } | { kind: "fold"; count: number; xp: number; initials: string[] } | { kind: "items"; count: number };

export type Run = {
  beats: Beat[];
  at: number;
  landed: ReadonlySet<number>;
  done: boolean;
  skipped: boolean;
  level: AlbumLevel;
  moving: boolean;
  chip: (index: number) => (element: HTMLElement | null) => void;
  advance: () => void;
  skip: () => void;
};

export function beatsOf(scenario: Scenario): Beat[] {
  const beats: Beat[] = scenario.excerpts.map((excerpt) => ({ kind: "excerpt", excerpt }));
  if (scenario.folded) beats.push({ kind: "fold", ...scenario.folded });
  if (scenario.items > 0 || beats.length > 0) beats.push({ kind: "items", count: scenario.items });
  return beats;
}

function xpOf(beat: Beat) {
  if (beat.kind === "excerpt") return beat.excerpt.xp;
  if (beat.kind === "fold") return beat.xp;
  return 0;
}

function isLevelUp(beat: Beat) {
  return beat.kind === "excerpt" && beat.excerpt.kind === "level";
}

export function useRun(scenario: Scenario, pace: Pace, reduced: boolean): Run {
  const beats = useMemo(() => beatsOf(scenario), [scenario]);
  const last = beats.length - 1;
  const everything = useMemo(() => new Set(beats.map((_, index) => index)), [beats]);
  const [at, setAt] = useState(reduced ? last : -1);
  const [landed, setLanded] = useState<ReadonlySet<number>>(reduced ? everything : new Set());
  const [skipped, setSkipped] = useState(false);
  const landedNow = useRef<Set<number>>(new Set(reduced ? everything : []));
  const chips = useRef(new Map<number, HTMLElement>());
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  const later = (ms: number, then: () => void) => timers.current.push(window.setTimeout(then, ms));

  const land = useCallback((index: number) => {
    if (landedNow.current.has(index)) return;
    landedNow.current.add(index);
    setLanded(new Set(landedNow.current));
    const beat = beats[index];
    if (beat && isLevelUp(beat)) popTheLevel();
    else if (beat && xpOf(beat) > 0) pulseTheBar(xpOf(beat));
  }, [beats]);

  useEffect(() => {
    if (reduced || last < 0) return;
    if (at === -1) {
      later(pace.settle, () => setAt(0));
      return clearTimers;
    }
    const beat = beats[at];
    if (!beat || beat.kind === "items") return;
    if (isLevelUp(beat)) {
      later(pace.read * 0.35, () => land(at));
      later(pace.read + pace.gap, () => setAt(at + 1));
      return clearTimers;
    }
    later(pace.read, () => {
      const from = chips.current.get(at);
      if (from) flyXp(from, xpOf(beat), pace.flight, () => land(at));
      else land(at);
    });
    later(pace.read + pace.flight * 0.7 + pace.gap, () => setAt(at + 1));
    return clearTimers;
  }, [at, beats, last, pace, reduced, land]);

  const advance = () => {
    if (at >= last) return;
    clearTimers();
    if (at >= 0 && !landed.has(at)) land(at);
    setAt(at + 1);
  };

  const skip = () => {
    clearTimers();
    landedNow.current = new Set(everything);
    setLanded(everything);
    setSkipped(true);
    setAt(last);
  };

  const xp = scenario.startXp + beats.reduce((sum, beat, index) => sum + (landed.has(index) ? xpOf(beat) : 0), 0);
  const levelUpsLanded = beats.filter((beat, index) => isLevelUp(beat) && landed.has(index)).length;
  const shownLevel = Math.min(levelOf(xp), levelOf(scenario.startXp) + levelUpsLanded);
  const level: AlbumLevel = { level: shownLevel, xp, startsAt: xpToReach(shownLevel), nextAt: xpToReach(shownLevel + 1) };
  const chip = (index: number) => (element: HTMLElement | null) => {
    if (element) chips.current.set(index, element);
    else chips.current.delete(index);
  };
  const done = last >= 0 && at === last;
  return { beats, at, landed, done, skipped, level, moving: !reduced && !done, chip, advance, skip };
}

export function shell() {
  return document.querySelector<HTMLElement>(".al-shell") ?? document.body;
}

export function barEnd() {
  const fill = document.querySelector<HTMLElement>(".al-xp-fill") ?? document.querySelector<HTMLElement>(".al-xp");
  if (!fill) return null;
  const box = fill.getBoundingClientRect();
  return { x: box.right, y: box.top + box.height / 2 };
}

export function flyXp(from: HTMLElement, amount: number, ms: number, onLand: () => void) {
  const end = barEnd();
  if (!end) return onLand();
  const start = from.getBoundingClientRect();
  const x = start.left + start.width / 2;
  const y = start.top + start.height / 2;
  const dx = end.x - x;
  const dy = end.y - y;
  const ghost = document.createElement("span");
  ghost.className = "xpm-ghost";
  ghost.textContent = `+${amount} XP`;
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
  shell().appendChild(ghost);
  from.dataset.flown = "";
  const flight = ghost.animate(
    [
      { transform: "translate(-50%, -50%) translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(-50%, -50%) translate(${dx * 0.25}px, ${dy * 0.25 - 60}px) scale(1.12)`, opacity: 1, offset: 0.35 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.7 },
    ],
    { duration: ms, easing: "cubic-bezier(0.45, 0, 0.7, 0.4)", fill: "forwards" },
  );
  flight.onfinish = () => {
    ghost.remove();
    onLand();
  };
}

function pulseTheBar(amount: number) {
  const track = document.querySelector<HTMLElement>(".al-xp-track");
  track?.animate([{ boxShadow: "0 0 0 0 var(--al-accent)" }, { boxShadow: "0 0 0 5px var(--al-accent-soft)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 450, easing: "ease-out" });
  const end = barEnd();
  if (!end) return;
  const gain = document.createElement("span");
  gain.className = "xpm-gain";
  gain.textContent = `+${amount}`;
  gain.style.left = `${end.x}px`;
  gain.style.top = `${end.y}px`;
  shell().appendChild(gain);
  gain.animate([{ transform: "translate(-50%, 0) scale(0.6)", opacity: 0 }, { transform: "translate(-50%, -14px) scale(1.1)", opacity: 1, offset: 0.3 }, { transform: "translate(-50%, -26px) scale(1)", opacity: 0 }], { duration: 900, easing: "ease-out" }).onfinish = () => gain.remove();
}

export function popTheLevel() {
  document.querySelector<HTMLElement>(".al-level")?.animate(
    [
      { transform: "scale(1)", background: "transparent", color: "inherit" },
      { transform: "scale(1.45)", background: "var(--al-accent)", color: "var(--al-count-ink)", offset: 0.35 },
      { transform: "scale(1)", background: "transparent", color: "inherit" },
    ],
    { duration: 1100, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)" },
  );
}
