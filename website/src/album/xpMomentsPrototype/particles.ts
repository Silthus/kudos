// PROTOTYPE (Silthus/personal#98), throwaway: messages that poof or crumble into XP particles that fly into a target.
import { barEnd, shell } from "./sequence";

export type Point = { x: number; y: number };

type Target = () => Point | null;

type Spray = { count: number; xp: number; target: Target; onLand: (xp: number) => void; delay?: number; towards?: Point };

export const toTheBar: Target = barEnd;

export function centreOf(element: Element): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function particle(className: string, at: Point, size: number) {
  const dot = document.createElement("span");
  dot.className = className;
  dot.style.left = `${at.x}px`;
  dot.style.top = `${at.y}px`;
  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;
  shell().appendChild(dot);
  return dot;
}

function randomIn(box: DOMRect, inset = 0.15): Point {
  return { x: box.left + box.width * (inset + Math.random() * (1 - inset * 2)), y: box.top + box.height * (inset + Math.random() * (1 - inset * 2)) };
}

function fly(dot: HTMLElement, from: Point, swirl: Point, target: Target, duration: number, delay: number, onDone: () => void) {
  const end = target() ?? from;
  const dx = end.x - from.x;
  const dy = end.y - from.y;
  const animation = dot.animate(
    [
      { transform: "translate(-50%, -50%) translate(0, 0) scale(0.4)", opacity: 0, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
      { transform: `translate(-50%, -50%) translate(${swirl.x}px, ${swirl.y}px) scale(1.25)`, opacity: 1, offset: 0.32, easing: "cubic-bezier(0.5, 0, 0.85, 0.35)" },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.9 },
    ],
    { duration, delay, fill: "both" },
  );
  animation.onfinish = () => {
    dot.remove();
    onDone();
  };
}

export function poof(card: HTMLElement, spray: Spray) {
  const box = card.getBoundingClientRect();
  const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const delay = spray.delay ?? 0;
  card.animate(
    [
      { transform: "scale(1)", filter: "blur(0)", opacity: 1 },
      { transform: "scale(1.08)", filter: "blur(2px)", opacity: 0.9, offset: 0.35 },
      { transform: "scale(0.7)", filter: "blur(8px)", opacity: 0 },
    ],
    { duration: 420, delay, easing: "ease-in", fill: "forwards" },
  );
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const from = { x: centre.x + Math.cos(angle) * box.width * 0.36, y: centre.y + Math.sin(angle) * box.height * 0.36 };
    const puff = particle("xpm-puff", from, 26 + Math.random() * 30);
    puff.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
        { transform: `translate(-50%, -50%) translate(${Math.cos(angle) * 22}px, ${Math.sin(angle) * 22}px) scale(1)`, opacity: 0.85, offset: 0.4 },
        { transform: `translate(-50%, -50%) translate(${Math.cos(angle) * 40}px, ${Math.sin(angle) * 40}px) scale(1.5)`, opacity: 0 },
      ],
      { duration: 560, delay: delay + 60, easing: "ease-out", fill: "both" },
    ).onfinish = () => puff.remove();
  }
  sprayFrom(() => randomIn(box, 0.3), spray, 140);
}

export function crumble(card: HTMLElement, spray: Spray) {
  const box = card.getBoundingClientRect();
  const delay = spray.delay ?? 0;
  const sweepMs = 650;
  card.animate([{ clipPath: "inset(0 0 0 0)", opacity: 1 }, { clipPath: "inset(0 0 0 100%)", opacity: 0.6 }], { duration: sweepMs, delay, easing: "ease-in", fill: "forwards" });
  const columns = 16;
  const rows = 6;
  const width = box.width / columns;
  const height = box.height / rows;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const at = { x: box.left + width * (column + 0.5), y: box.top + height * (row + 0.5) };
      const shard = particle("xpm-shard", at, Math.min(width, height));
      shard.style.width = `${width}px`;
      shard.style.height = `${height}px`;
      const lag = delay + (column / columns) * sweepMs;
      const drift = spray.towards ? { x: (spray.towards.x - at.x) * (0.55 + Math.random() * 0.4), y: (spray.towards.y - at.y) * (0.55 + Math.random() * 0.4) } : { x: 16 + Math.random() * 46, y: -10 - Math.random() * 44 };
      shard.animate(
        [
          { transform: "translate(-50%, -50%) rotate(0) scale(1)", opacity: 1, background: "var(--card)" },
          { transform: `translate(-50%, -50%) translate(${drift.x * 0.25}px, ${drift.y * 0.25}px) rotate(${Math.random() * 60 - 30}deg) scale(0.8)`, opacity: 1, background: "var(--xpm-spark)", offset: 0.35 },
          { transform: `translate(-50%, -50%) translate(${drift.x}px, ${drift.y}px) rotate(${Math.random() * 180 - 90}deg) scale(0.25)`, opacity: 0, background: "var(--al-accent)" },
        ],
        { duration: spray.towards ? 760 : 520, delay: lag, easing: spray.towards ? "cubic-bezier(0.45, 0, 0.8, 0.5)" : "ease-out", fill: "forwards" },
      ).onfinish = () => shard.remove();
    }
  }
  sprayFrom(() => randomIn(box, 0.05), { ...spray, delay: delay + 120 }, sweepMs);
}

export function stream(from: Point, spray: Spray, spreadMs = 500) {
  sprayFrom(() => ({ x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 30 }), spray, spreadMs);
}

function sprayFrom(start: () => Point, spray: Spray, spreadMs: number) {
  if (spray.count <= 0) return;
  const share = spray.xp / spray.count;
  for (let index = 0; index < spray.count; index += 1) {
    const from = start();
    const swirlAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const reach = 30 + Math.random() * 70;
    const swirl = { x: Math.cos(swirlAngle) * reach, y: Math.sin(swirlAngle) * reach };
    const dot = particle(Math.random() < 0.25 ? "xpm-particle xpm-particle-bright" : "xpm-particle", from, 5 + Math.random() * 6);
    const lag = (spray.delay ?? 0) + Math.random() * spreadMs;
    fly(dot, from, swirl, spray.target, 850 + Math.random() * 450, lag, () => spray.onLand(share));
  }
}

export function particlesFor(xp: number) {
  if (xp <= 0) return 0;
  return Math.min(28, 6 + Math.round(xp * 0.9));
}

export function clearParticles() {
  document.querySelectorAll(".xpm-particle, .xpm-puff, .xpm-shard, .xpm-ghost").forEach((element) => element.remove());
}
