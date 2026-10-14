import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Flight } from "./moments";

type Course = { from: DOMRect; dx: number; dy: number; target: HTMLElement };

export function rewardChipAttributes(seen: string | null) {
  return seen === null ? {} : { "data-reward-chip": seen };
}

export function hudAvatarAttributes() {
  return { "data-hud-avatar": "" };
}

export function RewardFlight({ flight, onLanded }: { flight: Flight; onLanded: () => void }) {
  const [course, setCourse] = useState<Course>();
  const chip = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const charted = courseOf(flight);
    if (charted === undefined) onLanded();
    else setCourse(charted);
  }, [flight, onLanded]);

  useEffect(() => {
    if (course === undefined) return;
    const land = () => {
      bump(course.target);
      onLanded();
    };
    const flying = chip.current;
    flying?.addEventListener("animationend", land, { once: true });
    return () => flying?.removeEventListener("animationend", land);
  }, [course, onLanded]);

  if (course === undefined) return null;
  return (
    <span ref={chip} data-reward-flight aria-hidden="true" className="reward-flight" style={styleOf(course)}>
      {`+${flight.crate.xp} XP`}
    </span>
  );
}

function courseOf({ crate }: Flight): Course | undefined {
  const chip = document.querySelector<HTMLElement>(`main [data-reward-chip="${crate.seen}"]`);
  const target = document.querySelector<HTMLElement>("header [data-hud-avatar]");
  if (chip === null || target === null) return undefined;
  const from = chip.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  return { from, target, dx: centreOf(to.left, to.width) - centreOf(from.left, from.width), dy: centreOf(to.top, to.height) - centreOf(from.top, from.height) };
}

function centreOf(start: number, size: number) {
  return start + size / 2;
}

function styleOf({ from, dx, dy }: Course) {
  return { left: from.left, top: from.top, "--flight-x": `${dx}px`, "--flight-y": `${dy}px` } as CSSProperties;
}

function bump(target: HTMLElement) {
  target.classList.add("reward-landed");
  target.addEventListener("animationend", () => target.classList.remove("reward-landed"), { once: true });
}
