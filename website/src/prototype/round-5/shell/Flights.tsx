// PROTOTYPE (#625, round 6): cards flying from one place to another on a curved path: a lift out of the tray, a gentle overshoot, a squash on landing with a ring of light and sparkles, and a beckon on where a card goes next. Never merge to main.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { storeOf, type Store } from "./store";

export type Box = { left: number; top: number; width: number; height: number };

export type Landing = { colour: string; sparkles?: number; press?: "card" | "sticker" };

export type Trip = { content: ReactNode; width: number; height: number; from: Box; to: Box; arc?: number; durationMs?: number; delayMs?: number; spin?: number; peak?: number; lift?: boolean; landing?: Landing };

type Flight = Trip & { key: number; landed: () => void };

type Touchdown = { key: number; box: Box; landing: Landing };

type Beckon = { key: number; box: Box; round: boolean };

const flights = storeOf<Flight[]>([]);

const touchdowns = storeOf<Touchdown[]>([]);

const beckons = storeOf<Beckon[]>([]);

let nextKey = 1;

const fadeOutMs = 240;

const touchdownLastsMs = 1100;

const liftMs = 280;

const holdMs = 170;

const settleMs = 320;

const pathSamples = 18;

export function motionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fly(trip: Trip): Promise<void> {
  const key = nextKey++;
  return new Promise((resolve) => flights.set([...flights.get(), { ...trip, key, landed: resolve }]));
}

function grounded(key: number) {
  flights.set(flights.get().filter((flight) => flight.key !== key));
}

function showFor<T extends { key: number }>(store: Store<T[]>, entry: T, ms: number) {
  store.set([...store.get(), entry]);
  const remove = () => store.set(store.get().filter(({ key }) => key !== entry.key));
  if (ms > 0) window.setTimeout(remove, ms);
  return remove;
}

export function beckonAt(element: Element | null, round = false): () => void {
  if (element === null) return () => undefined;
  return showFor(beckons, { key: nextKey++, box: boxOf(element), round }, 0);
}

function touchDown(box: Box, landing: Landing) {
  if (motionReduced()) return;
  showFor(touchdowns, { key: nextKey++, box, landing }, touchdownLastsMs);
}

export function boxOf(element: Element): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

export function FlightLayer() {
  const flying = flights.use();
  const touching = touchdowns.use();
  const beckoning = beckons.use();
  return (
    <div className="r5-flights" aria-hidden="true">
      {beckoning.map(({ key, box, round }) => (
        <span key={key} className="r5-beckon" data-round={round ? "" : undefined} style={boxStyleOf(box, 6)} />
      ))}
      {touching.map((touchdown) => (
        <TouchdownMark key={touchdown.key} touchdown={touchdown} />
      ))}
      {flying.map((flight) => (
        <FlyingThing key={flight.key} flight={flight} />
      ))}
    </div>
  );
}

function boxStyleOf(box: Box, grow = 0): CSSProperties {
  return { left: box.left - grow, top: box.top - grow, width: box.width + grow * 2, height: box.height + grow * 2 };
}

function sparkleStylesOf(count: number, seed: number, reach: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + ((seed * (index + 3)) % 7) / 10;
    const distance = reach * (0.75 + (((seed + index) * 37) % 10) / 30);
    return { "--x": `${Math.cos(angle) * distance}px`, "--y": `${Math.sin(angle) * distance}px`, "--delay": `${(index % 3) * 40}ms` } as CSSProperties;
  });
}

function TouchdownMark({ touchdown }: { touchdown: Touchdown }) {
  const { box, landing, key } = touchdown;
  const reach = Math.max(34, Math.max(box.width, box.height) * 0.75);
  return (
    <span className="r5-touchdown" data-press={landing.press ?? "card"} style={{ ...boxStyleOf(box), "--landing": landing.colour } as CSSProperties}>
      <span className="r5-touchdown-press" />
      <span className="r5-touchdown-ring" />
      {sparkleStylesOf(landing.sparkles ?? 8, key, reach).map((style, index) => (
        <span key={index} className="r5-touchdown-sparkle" style={style} />
      ))}
    </span>
  );
}

type Pose = { x: number; y: number; scaleX: number; scaleY: number; turn: number };

function scaleToFit(box: Box, width: number, height: number) {
  return Math.min(box.width / width, box.height / height);
}

function centreOf(box: Box) {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function transformOf(pose: Pose, width: number, height: number) {
  return `translate(${pose.x - width / 2}px, ${pose.y - height / 2}px) rotate(${pose.turn}deg) scale(${pose.scaleX}, ${pose.scaleY})`;
}

function easeInOutSine(share: number) {
  return (1 - Math.cos(Math.PI * share)) / 2;
}

function gentleOvershoot(share: number) {
  const pull = 0.9;
  return 1 + (pull + 1) * (share - 1) ** 3 + pull * (share - 1) ** 2;
}

function along(start: number, control: number, end: number, share: number) {
  return (1 - share) ** 2 * start + 2 * (1 - share) * share * control + share ** 2 * end;
}

function travelPoses(flight: Flight): Pose[] {
  const { width, height, from, to, arc = 90, spin = -8, peak = 0 } = flight;
  const start = centreOf(from);
  const end = centreOf(to);
  const startScale = scaleToFit(from, width, height) * (flight.lift ? 1.14 : 1);
  const endScale = scaleToFit(to, width, height);
  const grow = Math.max(1, peak / Math.max(1, (from.width + to.width) / 2));
  const control = { x: (start.x + end.x) / 2 + (end.x - start.x) * 0.12, y: Math.min(start.y, end.y) - arc };
  const liftTurn = flight.lift ? -3 : 0;
  return Array.from({ length: pathSamples + 1 }, (_, index) => {
    const time = index / pathSamples;
    const share = gentleOvershoot(easeInOutSine(time));
    const scale = startScale + (endScale - startScale) * Math.min(1, share) + Math.sin(Math.PI * Math.min(1, time)) * (grow - 1) * endScale;
    return { x: along(start.x, control.x, end.x, share), y: along(start.y - (flight.lift ? 10 : 0), control.y, end.y, share), scaleX: scale, scaleY: scale, turn: liftTurn * (1 - time) + spin * Math.sin(Math.PI * time) };
  });
}

function liftFrames(flight: Flight): Keyframe[] {
  const { width, height, from } = flight;
  const start = centreOf(from);
  const scale = scaleToFit(from, width, height);
  const resting = { ...start, scaleX: scale, scaleY: scale, turn: 0 };
  const lifted = { x: start.x, y: start.y - 10, scaleX: scale * 1.14, scaleY: scale * 1.14, turn: -3 };
  const total = liftMs + holdMs;
  return [
    { offset: 0, transform: transformOf(resting, width, height), filter: "drop-shadow(0 2px 2px rgb(35 37 29 / 20%))", opacity: 0.4 },
    { offset: liftMs / total, transform: transformOf(lifted, width, height), filter: "drop-shadow(0 16px 18px rgb(35 37 29 / 34%))", opacity: 1, easing: "linear" },
    { offset: 1, transform: transformOf(lifted, width, height), filter: "drop-shadow(0 16px 18px rgb(35 37 29 / 34%))", opacity: 1 },
  ];
}

function travelFrames(flight: Flight): Keyframe[] {
  const poses = travelPoses(flight);
  return poses.map((pose, index) => ({ offset: index / pathSamples, transform: transformOf(pose, flight.width, flight.height), filter: `drop-shadow(0 ${16 - (index / pathSamples) * 12}px ${18 - (index / pathSamples) * 14}px rgb(35 37 29 / 32%))`, opacity: 1 }));
}

function settleFrames(flight: Flight): Keyframe[] {
  const { width, height, to } = flight;
  const end = centreOf(to);
  const scale = scaleToFit(to, width, height);
  const at = (scaleX: number, scaleY: number) => transformOf({ ...end, scaleX: scale * scaleX, scaleY: scale * scaleY, turn: 0 }, width, height);
  return [
    { offset: 0, transform: at(1, 1), filter: "drop-shadow(0 2px 2px rgb(35 37 29 / 30%))" },
    { offset: 0.3, transform: at(1.09, 0.9), filter: "drop-shadow(0 1px 1px rgb(35 37 29 / 38%))" },
    { offset: 0.62, transform: at(0.97, 1.04), filter: "drop-shadow(0 1px 1px rgb(35 37 29 / 22%))" },
    { offset: 1, transform: at(1, 1), filter: "drop-shadow(0 0 0 rgb(35 37 29 / 0%))" },
  ];
}

function fadeInPlaceFrames(flight: Flight): Keyframe[] {
  const { width, height, to } = flight;
  const scale = scaleToFit(to, width, height);
  const placed = transformOf({ ...centreOf(to), scaleX: scale, scaleY: scale, turn: 0 }, width, height);
  return [
    { transform: placed, opacity: 0 },
    { transform: placed, opacity: 1 },
  ];
}

async function played(thing: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, running: Set<Animation>) {
  const animation = thing.animate(frames, { fill: "both", ...options });
  running.add(animation);
  await animation.finished;
  running.delete(animation);
}

async function journeyOf(thing: HTMLElement, flight: Flight, running: Set<Animation>, cancelled: () => boolean) {
  if (motionReduced()) {
    await played(thing, fadeInPlaceFrames(flight), { duration: 240, easing: "ease-out" }, running);
    if (!cancelled()) flight.landed();
    return;
  }
  const { durationMs = 800, delayMs = 0 } = flight;
  if (flight.lift) await played(thing, liftFrames(flight), { duration: liftMs + holdMs, delay: delayMs, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" }, running);
  await played(thing, travelFrames(flight), { duration: durationMs, delay: flight.lift ? 0 : delayMs, easing: "linear" }, running);
  if (cancelled()) return;
  if (flight.landing !== undefined) touchDown(flight.to, flight.landing);
  flight.landed();
  if (flight.landing !== undefined) await played(thing, settleFrames(flight), { duration: settleMs, easing: "ease-out" }, running);
}

function FlyingThing({ flight }: { flight: Flight }) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const thing = element.current;
    if (thing === null) return;
    const running = new Set<Animation>();
    let cancelled = false;
    const fadeOut = () => thing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeOutMs, fill: "forwards" }).finished.then(() => grounded(flight.key), () => grounded(flight.key));
    journeyOf(thing, flight, running, () => cancelled).then(() => {
      if (!cancelled) void fadeOut();
    }, () => undefined);
    return () => {
      cancelled = true;
      for (const animation of running) animation.cancel();
    };
  }, [flight]);
  return (
    <div ref={element} className="r5-flying" style={{ width: flight.width, height: flight.height, opacity: 0 }}>
      {flight.content}
    </div>
  );
}
