import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type Origin = Pick<DOMRect, "left" | "top" | "width" | "height">;

export type Arrival = "landed" | "cancelled";

export type RewardFlightProps = {
  source: () => Origin | undefined;
  target: () => HTMLElement | null;
  amount: string;
  glow?: string;
  onArrived: (target: HTMLElement) => void;
  onLanded: (how: Arrival) => void;
};

type Course = { from: Origin; dx: number; dy: number; target: HTMLElement };

const particles = [
  { delay: 0, arc: -48, spread: 0, size: 6 },
  { delay: 40, arc: -64, spread: -18, size: 4 },
  { delay: 80, arc: -36, spread: 16, size: 8 },
  { delay: 120, arc: -56, spread: -8, size: 4 },
  { delay: 160, arc: -30, spread: 22, size: 6 },
  { delay: 200, arc: -70, spread: 6, size: 8 },
];

const chipLandsLast = "260ms";

const settleMs = 900;

export function rewardTokenAttributes(kind: string) {
  return { "data-reward-token": kind };
}

export function hudAvatarAttributes() {
  return { "data-hud-avatar": "" };
}

export function heroRingAttributes() {
  return { "data-hero-ring": "" };
}

export function heroXpBarAttributes() {
  return { "data-xp-bar": "" };
}

export function skillPointChipAttributes() {
  return { "data-skill-point-chip": "" };
}

export function coinsChipAttributes() {
  return { "data-coins-chip": "" };
}

export function rewardTokenOrigin(kind: string): Origin | undefined {
  return document.querySelector<HTMLElement>(`[role="dialog"] [data-reward-token="${kind}"]`)?.getBoundingClientRect();
}

export function hudAvatar() {
  return document.querySelector<HTMLElement>("header [data-hud-avatar]");
}

export function xpDisplay() {
  const bar = document.querySelector<HTMLElement>("main [data-xp-bar]");
  return bar !== null && isInView(bar) ? bar : hudAvatar();
}

export function heroRing() {
  return document.querySelector<HTMLElement>("main [data-hero-ring]");
}

export function levelDisplay() {
  const ring = heroRing();
  return ring !== null && isInView(ring) ? ring : hudAvatar();
}

export function skillPointChip() {
  return document.querySelector<HTMLElement>("header [data-skill-point-chip]");
}

export function coinsChip() {
  return document.querySelector<HTMLElement>("header [data-coins-chip]");
}

export function isInView(element: HTMLElement) {
  if (underAMoment()) return false;
  const { top, bottom, width } = element.getBoundingClientRect();
  const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  return width > 0 && top >= headerBottom && bottom <= window.innerHeight;
}

function underAMoment() {
  return document.querySelector(".moment-scrim") !== null;
}

export function RewardFlight({ source, target, amount, glow, onArrived, onLanded }: RewardFlightProps) {
  const [course, setCourse] = useState<Course>();
  const flying = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const charted = courseOf(source(), target());
    if (charted === undefined) onLanded("cancelled");
    else setCourse(charted);
  }, [source, target, onLanded]);

  useEffect(() => {
    const swarm = flying.current;
    if (course === undefined || swarm === null) return;
    let ended = 0;
    const arrive = (how: Arrival) => {
      if (how === "landed") onArrived(course.target);
      onLanded(how);
    };
    const onEnd = () => {
      ended += 1;
      if (ended === particles.length + 1) arrive("landed");
    };
    const onCancel = () => arrive("cancelled");
    swarm.addEventListener("animationend", onEnd);
    swarm.addEventListener("animationcancel", onCancel, { once: true });
    return () => {
      swarm.removeEventListener("animationend", onEnd);
      swarm.removeEventListener("animationcancel", onCancel);
    };
  }, [course, onArrived, onLanded]);

  if (course === undefined) return null;
  return (
    <span ref={flying} data-reward-flight aria-hidden="true" className="reward-flight" data-look={glow === undefined ? undefined : "token"} style={styleOf(course, glow)}>
      <span data-particle className="reward-flight-chip" style={{ "--delay": chipLandsLast } as CSSProperties}>
        {amount}
      </span>
      {particles.map(({ delay, arc, spread, size }) => (
        <span key={delay} data-particle className="reward-flight-particle" style={{ "--delay": `${delay}ms`, "--arc": `${arc}px`, "--spread": `${spread}px`, "--size": `${size}px` } as CSSProperties} />
      ))}
    </span>
  );
}

const settling = new WeakMap<HTMLElement, Map<string, ReturnType<typeof setTimeout>>>();

export function settle(target: HTMLElement, classes: string[], forMs = settleMs) {
  const timers = settling.get(target) ?? new Map<string, ReturnType<typeof setTimeout>>();
  settling.set(target, timers);
  const key = classes.join(" ");
  clearTimeout(timers.get(key));
  target.classList.remove(...classes);
  void target.offsetWidth;
  target.classList.add(...classes);
  timers.set(key, setTimeout(() => target.classList.remove(...classes), forMs));
}

function courseOf(from: Origin | undefined, target: HTMLElement | null): Course | undefined {
  if (from === undefined || target === null) return undefined;
  const to = target.getBoundingClientRect();
  return { from, target, dx: centreOf(to.left, to.width) - centreOf(from.left, from.width), dy: centreOf(to.top, to.height) - centreOf(from.top, from.height) };
}

function centreOf(start: number, size: number) {
  return start + size / 2;
}

function styleOf({ from, dx, dy }: Course, glow: string | undefined) {
  return { left: from.left, top: from.top, width: from.width, height: from.height, "--flight-x": `${dx}px`, "--flight-y": `${dy}px`, ...(glow !== undefined && { "--token-glow": glow }) } as CSSProperties;
}
