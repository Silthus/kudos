import { useCallback, useEffect, useState } from "react";
import { questXpOf, type QuestDone } from "../../../convex/activity/entries";
import { levelOf, xpToReach } from "../../../convex/progression/levels";
import type { Climb, XpMoment } from "../../../convex/website/xpMoment";
import { prefersReducedMotion } from "../reducedMotion";
import type { AlbumLevel } from "./answer";
import type { XpMomentAhead } from "./visitArrival";

export const xpMomentTiming = { settleMs: 600, staggerMs: 170, readBeatMs: 550, dissolveStaggerMs: 140, sweepMs: 720, beatMs: 550, streamMs: 700, streamSteps: 10, landedMs: 380, caughtUpMs: 2600, questChargeMs: 1400, chainedChargeMs: 700, questRevealMs: 600, questRewardMs: 1100 } as const;

export type XpMomentPhase = "settle" | "arrive" | "hold" | "collect" | "stream" | "quests" | "takeover" | "caughtUp" | "done";

export type XpMomentCard = { key: string; xp: number } & ({ kind: "excerpt"; excerpt: XpMoment["excerpts"][number] } | { kind: "fold"; count: number });

export type QuestStage = "charge" | "burst" | "stream" | "reward";

type Progress = { out: number; dissolving: number; dissolved: number; filled: number; quest: number; questStage: QuestStage; questFilled: number };

export type XpMomentPlay = { moment: XpMoment; cards: XpMomentCard[]; phase: XpMomentPhase; orbXp: number; collect: () => void; skip: () => void; tookOver: () => void } & Progress;

export type XpMomentSequence = { play: XpMomentPlay | null; waits: boolean; covers: boolean; heldLevel: AlbumLevel | null; climbing: Climb | null; ended: XpMoment | null };

type Step = [ms: number, step: () => void];

const unstarted: Progress = { out: 0, dissolving: 0, dissolved: 0, filled: 0, quest: 0, questStage: "charge", questFilled: 0 };

const playing: ReadonlySet<XpMomentPhase> = new Set(["settle", "arrive", "hold", "collect", "stream", "quests"]);

const onTheCanvas: ReadonlySet<XpMomentPhase> = new Set(["arrive", "hold", "collect", "stream", "quests", "takeover", "caughtUp"]);

export function useXpMomentSequence(ahead: XpMomentAhead, { itemsWait, onEnd }: { itemsWait: boolean; onEnd: (skipped: boolean) => void }): XpMomentSequence {
  const moment = ahead === "reading" ? null : ahead;
  const [started, setPhase] = useState<XpMomentPhase | null>(null);
  const [progress, setProgress] = useState<Progress>(unstarted);
  const [played, setPlayed] = useState(moment);
  if (played !== moment) {
    setPlayed(moment);
    setPhase(null);
    setProgress(unstarted);
  }
  const landed = itemsWait ? "done" : "caughtUp";
  if (moment !== null && started === null && prefersReducedMotion()) setPhase(landed);
  const phase = moment === null ? null : (started ?? "settle");
  const cards = moment === null ? [] : cardsOf(moment);
  const advance = useCallback((patch: Partial<Progress>) => setProgress((now) => ({ ...now, ...patch })), []);
  const collect = useCallback(() => {
    setPhase((now) => (now === "arrive" || now === "hold" ? "collect" : now));
    setProgress((now) => ({ ...now, dissolving: Math.max(now.dissolving, 1) }));
  }, []);
  const skip = useCallback(() => {
    onEnd(true);
    setProgress((now) => ({ ...now, filled: xpMomentTiming.streamSteps }));
    setPhase(landed);
  }, [onEnd, landed]);
  const tookOver = useCallback(() => setPhase(landed), [landed]);
  const quests = moment?.quests ?? noQuests;
  const afterTheQuests = moment !== null && crossesALevel(moment.climb) ? "takeover" : landed;
  const afterTheBar = quests.length > 0 ? "quests" : afterTheQuests;
  useEffect(() => {
    if (phase === null) return;
    const timers = stepsOf(phase, { count: cards.length, quests }, { setPhase, advance, afterTheBar, afterTheQuests }).map(([ms, step]) => window.setTimeout(step, ms));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, cards.length, quests, advance, afterTheBar, afterTheQuests]);
  useEndedOnceItLands(phase, onEnd);
  useEscapeLandsIt(phase, skip, () => setPhase("done"));
  if (moment === null || phase === null) return { play: null, waits: ahead === "reading", covers: false, heldLevel: null, climbing: null, ended: null };
  const play = { moment, cards, phase, orbXp: orbXpOf(cards, progress, phase), collect, skip, tookOver, ...progress };
  return { play: onTheCanvas.has(phase) ? play : null, waits: phase !== "done", covers: onTheCanvas.has(phase), heldLevel: playing.has(phase) ? barLevelOf(moment, progress) : null, climbing: playing.has(phase) ? moment.climb : null, ended: playing.has(phase) ? null : moment };
}

type Setters = { setPhase: (phase: XpMomentPhase) => void; advance: (patch: Partial<Progress>) => void; afterTheBar: XpMomentPhase; afterTheQuests: XpMomentPhase };

const noQuests: QuestDone[] = [];

function stepsOf(phase: XpMomentPhase, { count, quests }: { count: number; quests: QuestDone[] }, { setPhase, advance, afterTheBar, afterTheQuests }: Setters): Step[] {
  const { settleMs, staggerMs, readBeatMs, dissolveStaggerMs, sweepMs, beatMs, streamMs, streamSteps, landedMs, caughtUpMs } = xpMomentTiming;
  const each = (from: number, step: (index: number) => Step) => Array.from({ length: Math.max(0, count - from) }, (_, index) => step(index + from));
  switch (phase) {
    case "settle":
      return [[settleMs, () => (setPhase("arrive"), advance({ out: Math.min(1, count) }))]];
    case "arrive":
      return [...each(1, (index): Step => [index * staggerMs, () => advance({ out: index + 1 })]), [count * staggerMs + readBeatMs, () => setPhase("hold")]];
    case "collect":
      return [...each(1, (index): Step => [index * dissolveStaggerMs, () => advance({ dissolving: index + 1 })]), ...each(0, (index): Step => [index * dissolveStaggerMs + sweepMs, () => advance({ dissolved: index + 1 })]), [Math.max(0, count - 1) * dissolveStaggerMs + sweepMs + beatMs, () => setPhase("stream")]];
    case "stream":
      return [...Array.from({ length: streamSteps }, (_, index): Step => [((index + 1) * streamMs) / streamSteps, () => advance({ filled: index + 1 })]), [streamMs + landedMs, () => setPhase(afterTheBar)]];
    case "quests":
      return questStepsOf(quests, advance, () => setPhase(afterTheQuests));
    case "caughtUp":
      return [[caughtUpMs, () => setPhase("done")]];
    default:
      return [];
  }
}

function questStepsOf(quests: QuestDone[], advance: (patch: Partial<Progress>) => void, end: () => void): Step[] {
  const { questChargeMs, chainedChargeMs, questRevealMs, streamMs, streamSteps, questRewardMs } = xpMomentTiming;
  const steps: Step[] = [];
  let start = 0;
  quests.forEach((quest, index) => {
    const burst = start + (index === 0 ? questChargeMs : chainedChargeMs);
    const stream = burst + questRevealMs;
    const reward = stream + streamMs;
    const fills = quest.waiting ? [] : Array.from({ length: streamSteps }, (_, step): Step => [stream + ((step + 1) * streamMs) / streamSteps, () => advance({ questFilled: step + 1 })]);
    steps.push([start, () => advance({ quest: index, questStage: "charge", questFilled: 0 })], [burst, () => advance({ questStage: "burst" })], [stream, () => advance({ questStage: "stream" })], ...fills, [reward, () => advance({ questStage: "reward" })]);
    start = reward + questRewardMs;
  });
  return [...steps, [start, end]];
}

function useEndedOnceItLands(phase: XpMomentPhase | null, onEnd: (skipped: boolean) => void) {
  const landed = phase !== null && !playing.has(phase);
  useEffect(() => {
    if (landed) onEnd(false);
  }, [landed, onEnd]);
}

function useEscapeLandsIt(phase: XpMomentPhase | null, skip: () => void, close: () => void) {
  useEffect(() => {
    if (phase === null || phase === "done" || phase === "takeover") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (phase === "caughtUp") close();
      else skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, skip, close]);
}

function cardsOf({ excerpts, fold }: XpMoment): XpMomentCard[] {
  const shown = excerpts.map((excerpt, index): XpMomentCard => ({ key: `${index}`, kind: "excerpt", excerpt, xp: excerpt.xp }));
  return fold === null ? shown : [...shown, { key: "fold", kind: "fold", count: fold.count, xp: fold.xp }];
}

function orbXpOf(cards: XpMomentCard[], { dissolved, filled }: Progress, phase: XpMomentPhase): number {
  const soaked = cards.slice(0, dissolved).reduce((sum, { xp }) => sum + xp, 0);
  return phase === "stream" ? Math.round(soaked * (1 - filled / xpMomentTiming.streamSteps)) : soaked;
}

function barLevelOf({ climb: { from, to }, quests }: XpMoment, { filled, quest, questFilled }: Progress): AlbumLevel {
  const { streamSteps } = xpMomentTiming;
  const streaming = quests.slice(quest, quest + 1).filter(({ waiting }) => !waiting);
  const ofTheCards = Math.round(((to.xp - from.xp - questXpOf(quests)) * filled) / streamSteps);
  const ofTheQuests = questXpOf(quests.slice(0, quest)) + Math.round((questXpOf(streaming) * questFilled) / streamSteps);
  return standingAt(from.xp + ofTheCards + ofTheQuests);
}

function standingAt(xp: number): AlbumLevel {
  const level = levelOf(xp);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}

export function crossesALevel({ from, to }: Climb) {
  return to.level > from.level;
}
