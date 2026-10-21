import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ReachedTier } from "../../../convex/album/milestones";
import type { TurnedFaceShown } from "../../../convex/website/album";
import { medalKeyOf } from "./milestones";
import { playTurn, turnClock, turnTiming, type FlightStage, type TurnClock, type Turned, type TurnSteps } from "./turnSequence";

export type Point = { x: number; y: number };

export type Flight = { item: string; from: DOMRect; stage: FlightStage; dark: boolean; face: TurnedFaceShown | null; spot: Point; size: number; burst: boolean; caption: boolean; chip: Chip | null; rings: DOMRect | null; flourish: DOMRect | null; medal: MedalPop | null };

export type MedalPop = { tier: ReachedTier; rect: DOMRect };

export type Chip = { xp: number; from: Point; to: Point };

export type FlightBoxes = { flyer: RefObject<HTMLDivElement | null>; flip: RefObject<HTMLDivElement | null>; disc: RefObject<HTMLSpanElement | null> };

export type Arrival = { land: (turned: Turned) => void; landed: () => void; unlocked: () => void; toTheMilestones: () => void; medalShown: () => void; paid: () => void; nothingWaits: () => boolean };

type FaceKind = TurnedFaceShown["kind"];

type Change = (patch: Partial<Flight>) => void;

export function useTurnFlight() {
  const [flight, setFlight] = useState<Flight | null>(null);
  const boxes: FlightBoxes = { flyer: useRef<HTMLDivElement>(null), flip: useRef<HTMLDivElement>(null), disc: useRef<HTMLSpanElement>(null) };
  const clock = useRef<TurnClock | null>(null);
  useSkipWhileFlying(flight !== null, clock);
  const { flyer, flip, disc } = boxes;
  const fly = useCallback(
    async (item: string, from: DOMRect, answer: Promise<Turned | null>, arrival: Arrival) => {
      const running = turnClock();
      clock.current = running;
      const { spot, size } = middleFor(from);
      setFlight({ item, from, stage: "lift", dark: false, face: null, spot, size, burst: false, caption: false, chip: null, rings: null, flourish: null, medal: null });
      const change: Change = (patch) => setFlight((flying) => (flying === null ? null : { ...flying, ...patch }));
      const turned = await playTurn(running, stepsOf(running, { flyer, flip, disc }, change, arrival, { from, spot, size }), answer);
      clock.current = null;
      setFlight(null);
      return turned;
    },
    [flyer, flip, disc],
  );
  return { flight, boxes, fly, flying: flight !== null };
}

function useSkipWhileFlying(flying: boolean, clock: RefObject<TurnClock | null>) {
  useEffect(() => {
    if (!flying) return;
    const skip = () => clock.current?.skip();
    const onKey = (event: KeyboardEvent) => {
      if (!skipKeys.has(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      skip();
    };
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [flying, clock]);
}

const skipKeys = new Set(["Enter", " ", "Escape"]);

type Start = { from: DOMRect; spot: Point; size: number };

function stepsOf(clock: TurnClock, boxes: FlightBoxes, change: Change, arrival: Arrival, start: Start): TurnSteps {
  const motion = flyerMotion(clock, boxes, start);
  let kind: FaceKind = "hoggie";
  return {
    stage: (stage) => change({ stage }),
    darken: (dark) => change({ dark }),
    lift: () => motion.moveTo(start.spot, start.size / Math.max(1, start.from.width), turnTiming.liftMs, liftEasing, 40),
    goToThePage(turned) {
      kind = turned.face.kind;
      change({ face: turned.face });
      arrival.land(turned);
      scrollToTheTop();
    },
    flip: () => clock.animate(boxes.flip.current, flipFrames, { duration: turnTiming.flipMs, easing: "cubic-bezier(0.45, 0, 0.2, 1)" }),
    burst: () => change({ burst: true }),
    caption: () => change({ caption: true }),
    payTheXp: (xp) => payTheXp(clock, change, arrival, start, xp),
    slotInView: () => inView(theSlot()),
    jumpToTheSlot: () => jumpTo(theSlot()),
    aboveTheSlot: () => motion.aboveTheSlot(),
    dropIntoTheSlot: () => motion.dropIntoTheSlot(kind),
    landed() {
      arrival.landed();
      const target = theTarget();
      change({ burst: false, caption: false, rings: target?.getBoundingClientRect() ?? null });
      target?.animate?.(slotPopFrames, { duration: turnTiming.popMs, easing: "ease-out" });
    },
    squash: () => motion.squash(),
    sealInView: (team) => inView(theSealSpot(team)),
    jumpToTheSeal: (team) => jumpTo(theSealSpot(team)),
    async unlockTheTeam(team) {
      arrival.unlocked();
      const seal = document.querySelector<HTMLElement>(`main [data-al-seal="${team}"]`);
      change({ flourish: seal?.getBoundingClientRect() ?? null });
      await clock.animate(seal, sealPopFrames, { duration: turnTiming.sealPopMs, easing: "cubic-bezier(0.3, 0.8, 0.3, 1)" });
      seal?.getAnimations?.().forEach((animation) => animation.cancel());
    },
    endTheUnlock: () => change({ flourish: null }),
    medalInView: (tier) => isInView(theMedal(tier)),
    goToTheMilestones: arrival.toTheMilestones,
    jumpToTheMedal: (tier) => jumpTo(theMedal(tier)),
    popTheMedal: (tier) => popTheMedal(clock, change, arrival, tier),
    endTheMedal: () => change({ medal: null }),
    nothingWaits: arrival.nothingWaits,
  };
}

async function popTheMedal(clock: TurnClock, change: Change, arrival: Arrival, tier: ReachedTier) {
  arrival.medalShown();
  const medal = theMedal(tier);
  change({ medal: { tier, rect: medal?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0) } });
  const emoji = medal?.querySelector(".al-ms-emoji");
  await Promise.all([clock.animate(medal?.querySelector(".al-ms-medal-art"), medalPopFrames, { duration: turnTiming.medalPopMs, easing: "cubic-bezier(0.3, 0.8, 0.3, 1)" }), clock.animate(emoji, emojiPopFrames, { duration: turnTiming.medalPopMs, easing: "ease-out" })]);
}

async function payTheXp(clock: TurnClock, change: Change, arrival: Arrival, { spot, size }: Start, xp: number) {
  if (xp === 0) return arrival.paid();
  await clock.sleep(turnTiming.chipAfterMs);
  const bar = document.querySelector(".al-xp-track")?.getBoundingClientRect();
  const from = { x: spot.x + size * 0.32, y: spot.y - size * 0.42 };
  change({ chip: { xp, from, to: bar === undefined ? from : { x: bar.left + bar.width * 0.8, y: bar.top + bar.height / 2 } } });
  await clock.sleep(turnTiming.chipFlightMs);
  change({ chip: null });
  arrival.paid();
  document.querySelector(".al-xp")?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
}

function flyerMotion(clock: TurnClock, boxes: FlightBoxes, { from }: Start) {
  const origin = centreOf(from);
  let here = origin;
  let scale = 1;
  let goal = origin;
  let endScale = 1;
  const at = (point: Point, size: number) => `translate(${point.x - origin.x}px, ${point.y - origin.y}px) scale(${size})`;
  const moveTo = async (point: Point, nextScale: number, duration: number, easing: string, lift = 0) => {
    const middle = { x: (here.x + point.x) / 2, y: Math.min(here.y, point.y) - lift };
    const frames = lift === 0 ? [{ transform: at(here, scale) }, { transform: at(point, nextScale) }] : [{ transform: at(here, scale) }, { transform: at(middle, (scale + nextScale) / 2 + 0.1), offset: 0.45 }, { transform: at(point, nextScale) }];
    here = point;
    scale = nextScale;
    await clock.animate(boxes.flyer.current, frames, { duration, easing });
  };
  return {
    moveTo,
    async aboveTheSlot() {
      const target = theTarget()?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - 40, window.innerHeight / 2 - 40, 80, 80);
      goal = centreOf(target);
      endScale = Math.max(0.2, Math.min(target.width, target.height) / Math.max(1, from.width));
      await moveTo({ x: goal.x, y: Math.max(140, goal.y - target.height * 0.5 - 60) }, 1.35, turnTiming.aboveMs, liftEasing, 40);
    },
    async dropIntoTheSlot(kind: FaceKind) {
      await Promise.all([moveTo(goal, endScale, turnTiming.dropMs, "cubic-bezier(0.7, 0, 1, 0.6)"), clock.animate(boxes.disc.current, discFramesFor(kind, theTarget()), { duration: turnTiming.fitMs, easing: "ease-in" })]);
    },
    squash: () => clock.animate(boxes.flyer.current, [{ transform: at(goal, endScale) }, { transform: `${at(goal, endScale)} scale(1.16, 0.84)`, offset: 0.35 }, { transform: at(goal, endScale), opacity: 0 }], { duration: turnTiming.squashMs, easing: "ease-out" }),
  };
}

function discFramesFor(kind: FaceKind, target: HTMLElement | null): Keyframe[] {
  if (kind === "hoggie") return [{ opacity: 1 }, { opacity: 0 }];
  const radius = target === null ? Number.NaN : parseFloat(getComputedStyle(target).borderRadius);
  const width = target?.getBoundingClientRect().width ?? 0;
  return [{ borderRadius: "50%" }, { borderRadius: Number.isNaN(radius) || width === 0 ? "50%" : `${(radius / width) * 100}%` }];
}

const liftEasing = "cubic-bezier(0.3, 0.8, 0.3, 1)";

const flipFrames: Keyframe[] = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(205deg)", offset: 0.72 }, { transform: "rotateY(180deg)" }];

const slotPopFrames: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.26)", offset: 0.3 }, { transform: "scale(0.93)", offset: 0.6 }, { transform: "scale(1.04)", offset: 0.82 }, { transform: "scale(1)" }];

const sealPopFrames: Keyframe[] = [{ transform: "scale(0.6) rotate(-14deg)", filter: "saturate(0)" }, { transform: "scale(1.28) rotate(6deg)", filter: "saturate(1.3)", offset: 0.45 }, { transform: "scale(0.96) rotate(-2deg)", offset: 0.75 }, { transform: "none", filter: "none" }];

const medalPopFrames: Keyframe[] = [{ transform: "scale(0.7)", filter: "grayscale(1)" }, { transform: "scale(1.3)", filter: "grayscale(0) saturate(1.3)", offset: 0.45 }, { transform: "scale(0.95)", offset: 0.75 }, { transform: "none", filter: "none" }];

const emojiPopFrames: Keyframe[] = [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(0)", opacity: 0, offset: 0.4 }, { transform: "scale(1.25)", opacity: 1, offset: 0.75 }, { transform: "none", opacity: 1 }];

function middleFor(from: DOMRect) {
  const big = Math.min(1.8, (Math.min(window.innerWidth, window.innerHeight) * 0.3) / Math.max(1, from.width));
  return { spot: { x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, size: from.width * big };
}

function theSlot() {
  return document.querySelector<HTMLElement>("main [data-landed]");
}

function theTarget() {
  const slot = theSlot();
  return slot?.querySelector<HTMLElement>(".al-photo-sticker, .al-hoggies-plate-art") ?? slot;
}

function theMedal(tier: ReachedTier) {
  return document.querySelector<HTMLElement>(`main [data-al-medal="${medalKeyOf(tier)}"]`);
}

function theSealSpot(team: string) {
  return document.querySelector<HTMLElement>(`main [data-al-seal="${team}"]`)?.closest<HTMLElement>(".al-seal-spot") ?? null;
}

function inView(element: HTMLElement | null) {
  if (element === null) return true;
  const { top, bottom } = element.getBoundingClientRect();
  return top > window.innerHeight * 0.15 && bottom < window.innerHeight * 0.8;
}

function isInView(element: HTMLElement | null) {
  return element !== null && inView(element);
}

function jumpTo(element: HTMLElement | null) {
  element?.scrollIntoView({ block: "center", behavior: "instant" });
}

function scrollToTheTop() {
  document.scrollingElement?.scrollTo?.({ top: 0, behavior: "instant" });
}

function centreOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
