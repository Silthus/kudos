// PROTOTYPE (#625, round 5): cards flying across the page from one place to another, and the gold burst when a page completes. Never merge to main.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ConfettiBurst } from "./Celebration";
import { storeOf } from "./store";

export type Box = { left: number; top: number; width: number; height: number };

export type Trip = { content: ReactNode; width: number; height: number; from: Box; to: Box; arc?: number; durationMs?: number; delayMs?: number; spin?: number; peak?: number };

type Flight = Trip & { key: number; landed: () => void };

type Burst = { key: number; x: number; y: number };

const flights = storeOf<Flight[]>([]);

const bursts = storeOf<Burst[]>([]);

let nextKey = 1;

const fadeOutMs = 220;

const burstLastsMs = 3400;

export function motionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fly(trip: Trip): Promise<void> {
  if (motionReduced()) return Promise.resolve();
  const key = nextKey++;
  return new Promise((resolve) => flights.set([...flights.get(), { ...trip, key, landed: resolve }]));
}

function grounded(key: number) {
  flights.set(flights.get().filter((flight) => flight.key !== key));
}

export function burstAt(element: Element | null) {
  if (element === null || motionReduced()) return;
  const box = element.getBoundingClientRect();
  const burst = { key: nextKey++, x: box.left + box.width / 2, y: box.top + box.height / 2 };
  bursts.set([...bursts.get(), burst]);
  window.setTimeout(() => bursts.set(bursts.get().filter(({ key }) => key !== burst.key)), burstLastsMs);
}

export function boxOf(element: Element): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

export function FlightLayer() {
  const flying = flights.use();
  const bursting = bursts.use();
  return (
    <div className="r5-flights" aria-hidden="true">
      {flying.map((flight) => (
        <FlyingThing key={flight.key} flight={flight} />
      ))}
      {bursting.map(({ key, x, y }) => (
        <span key={key} className="r5-landing-burst" style={{ left: x, top: y }}>
          <ConfettiBurst kind="gold" seed={key * 97} />
        </span>
      ))}
    </div>
  );
}

function placedAt(box: Box, width: number, height: number, lift = 0, turn = 0) {
  const scale = Math.min(box.width / width, box.height / height);
  const x = box.left + box.width / 2 - width / 2;
  const y = box.top + box.height / 2 - height / 2 - lift;
  return `translate(${x}px, ${y}px) rotate(${turn}deg) scale(${scale})`;
}

function midway(from: Box, to: Box, peak: number): Box {
  const between = (first: number, second: number) => (first + second) / 2;
  const grow = Math.max(1.15, peak / Math.max(1, between(from.width, to.width)));
  const width = between(from.width, to.width) * grow;
  const height = between(from.height, to.height) * grow;
  return { left: between(from.left + from.width / 2, to.left + to.width / 2) - width / 2, top: between(from.top + from.height / 2, to.top + to.height / 2) - height / 2, width, height };
}

function FlyingThing({ flight }: { flight: Flight }) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const thing = element.current;
    if (thing === null) return;
    const { width, height, from, to, arc = 90, durationMs = 720, delayMs = 0, spin = -8, peak = 0 } = flight;
    const trip = thing.animate(
      [
        { transform: placedAt(from, width, height), opacity: 1, easing: "cubic-bezier(0.3, 0, 0.6, 1)" },
        { transform: placedAt(midway(from, to, peak), width, height, arc, spin), opacity: 1, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
        { transform: placedAt(to, width, height), opacity: 1 },
      ],
      { duration: durationMs, delay: delayMs, fill: "both" },
    );
    let cancelled = false;
    const land = () => {
      if (cancelled) return;
      flight.landed();
      thing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeOutMs, fill: "forwards" }).finished.then(() => grounded(flight.key), () => grounded(flight.key));
    };
    trip.finished.then(land, () => undefined);
    return () => {
      cancelled = true;
      trip.cancel();
    };
  }, [flight]);
  return (
    <div ref={element} className="r5-flying" style={{ width: flight.width, height: flight.height }}>
      {flight.content}
    </div>
  );
}
