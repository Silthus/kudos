type Point = { x: number; y: number };

const particleClasses = ".xpm-particle, .xpm-mote";

export function centreOf(element: Element): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function barEnd(): Point | null {
  const track = document.querySelector(".al-xp-track");
  if (track === null) return null;
  const box = track.getBoundingClientRect();
  return { x: box.left + box.width * 0.9, y: box.top + box.height / 2 };
}

export function dustInto(card: Element, target: Point, sweepMs: number) {
  if (!animates(card)) return;
  const box = card.getBoundingClientRect();
  for (let index = 0; index < 48; index += 1) {
    const along = Math.random();
    const at = { x: box.left + box.width * along, y: box.top + Math.random() * box.height };
    const drift = { x: (target.x - at.x) * (0.12 + Math.random() * 0.2) + (Math.random() - 0.5) * 40, y: (target.y - at.y) * (0.12 + Math.random() * 0.2) - 12 - Math.random() * 36 };
    fly(dotAt("xpm-mote", at, 2 + Math.random() * 4), [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { transform: `translate(-50%, -50%) translate(${drift.x}px, ${drift.y}px) scale(0.3)`, opacity: 0 }], 650 + Math.random() * 550, along * sweepMs);
  }
  for (let index = 0; index < 14; index += 1) {
    const along = (index + Math.random()) / 14;
    const at = { x: box.left + box.width * along, y: box.top + box.height * (0.15 + Math.random() * 0.7) };
    flyTo(dotAt(sparkClass(), at, 4 + Math.random() * 5), at, target, 700 + Math.random() * 400, along * sweepMs);
  }
}

export function streamInto(from: Element, target: Point | null, spreadMs: number) {
  if (target === null || !animates(from)) return;
  const start = centreOf(from);
  for (let index = 0; index < 44; index += 1) {
    const at = { x: start.x + (Math.random() - 0.5) * 30, y: start.y + (Math.random() - 0.5) * 30 };
    flyTo(dotAt(sparkClass(), at, 5 + Math.random() * 6), at, target, 850 + Math.random() * 450, Math.random() * spreadMs);
  }
}

export function clearParticles() {
  document.querySelectorAll(particleClasses).forEach((particle) => particle.remove());
}

function animates(element: Element) {
  return typeof element.animate === "function";
}

function sparkClass() {
  return Math.random() < 0.3 ? "xpm-particle xpm-particle-bright" : "xpm-particle";
}

function dotAt(className: string, { x, y }: Point, size: number) {
  const dot = document.createElement("span");
  dot.className = className;
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` });
  document.body.appendChild(dot);
  return dot;
}

function flyTo(dot: HTMLElement, from: Point, to: Point, duration: number, delay: number) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
  const reach = 14 + Math.random() * 30;
  const swirl = `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px)`;
  const landing = `translate(${to.x - from.x}px, ${to.y - from.y}px)`;
  fly(dot, [{ transform: "translate(-50%, -50%) scale(0.4)", opacity: 0 }, { transform: `translate(-50%, -50%) ${swirl} scale(1.25)`, opacity: 1, offset: 0.32 }, { transform: `translate(-50%, -50%) ${landing} scale(0.35)`, opacity: 0.9 }], duration, delay);
}

function fly(dot: HTMLElement, keyframes: Keyframe[], duration: number, delay: number) {
  dot.animate(keyframes, { duration, delay, easing: "cubic-bezier(0.3, 0.6, 0.5, 1)", fill: "both" }).onfinish = () => dot.remove();
}
