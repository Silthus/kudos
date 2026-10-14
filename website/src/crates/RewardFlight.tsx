import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type Origin = Pick<DOMRect, "left" | "top" | "width" | "height">;

type Arrival = "landed" | "cancelled";

export type RewardFlightProps = {
  source: () => Origin | undefined;
  target: () => HTMLElement | null;
  amount: string;
  reduced: boolean;
  onArrived: (target: HTMLElement) => void;
  onLanded: () => void;
};

type Course = { from: Origin; dx: number; dy: number; target: HTMLElement };

const particles = [
  { delay: 0, arc: -48, spread: 0 },
  { delay: 70, arc: -64, spread: -18 },
  { delay: 130, arc: -36, spread: 16 },
  { delay: 190, arc: -56, spread: -8 },
  { delay: 240, arc: -30, spread: 22 },
  { delay: 290, arc: -70, spread: 6 },
];

const settleMs = 900;

export function rewardChipAttributes(seen: string | null) {
  return seen === null ? {} : { "data-reward-chip": seen };
}

export function hudAvatarAttributes() {
  return { "data-hud-avatar": "" };
}

export function rewardChipOrigin(seen: string): Origin | undefined {
  return document.querySelector<HTMLElement>(`main [data-reward-chip="${seen}"]`)?.getBoundingClientRect();
}

export function hudAvatar() {
  return document.querySelector<HTMLElement>("header [data-hud-avatar]");
}

export function RewardFlight({ source, target, amount, reduced, onArrived, onLanded }: RewardFlightProps) {
  const [course, setCourse] = useState<Course>();
  const flying = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const destination = target();
    if (reduced && destination !== null) settle(destination, ["reward-faded"]);
    const charted = reduced ? undefined : courseOf(source(), destination);
    if (charted === undefined) onLanded();
    else setCourse(charted);
  }, [source, target, reduced, onLanded]);

  useEffect(() => {
    const swarm = flying.current;
    if (course === undefined || swarm === null) return;
    let ended = 0;
    const arrive = (how: Arrival) => {
      if (how === "landed") onArrived(course.target);
      onLanded();
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
    <span ref={flying} data-reward-flight aria-hidden="true" className="reward-flight" style={styleOf(course)}>
      <span data-particle className="reward-flight-chip">
        {amount}
      </span>
      {particles.map(({ delay, arc, spread }) => (
        <span key={delay} data-particle className="reward-flight-particle" style={{ "--delay": `${delay}ms`, "--arc": `${arc}px`, "--spread": `${spread}px` } as CSSProperties} />
      ))}
    </span>
  );
}

export function settle(target: HTMLElement, classes: string[]) {
  target.classList.add(...classes);
  setTimeout(() => target.classList.remove(...classes), settleMs);
}

function courseOf(from: Origin | undefined, target: HTMLElement | null): Course | undefined {
  if (from === undefined || target === null) return undefined;
  const to = target.getBoundingClientRect();
  return { from, target, dx: centreOf(to.left, to.width) - centreOf(from.left, from.width), dy: centreOf(to.top, to.height) - centreOf(from.top, from.height) };
}

function centreOf(start: number, size: number) {
  return start + size / 2;
}

function styleOf({ from, dx, dy }: Course) {
  return { left: from.left, top: from.top, width: from.width, height: from.height, "--flight-x": `${dx}px`, "--flight-y": `${dy}px` } as CSSProperties;
}
