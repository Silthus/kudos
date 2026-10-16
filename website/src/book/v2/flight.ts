export function flyBetween(ghost: HTMLElement, from: DOMRect, to: DOMRect, ms: number, startTilt = -8): Promise<unknown> {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;
  const animation = ghost.animate(
    [
      { transform: `translate(0, 0) scale(1) rotate(${startTilt}deg)`, offset: 0 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${(1 + scale) / 2}) rotate(6deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, offset: 1 },
    ],
    { duration: ms, easing: "cubic-bezier(0.3, 0.7, 0.25, 1)", fill: "forwards" },
  );
  return animation.finished.catch(() => undefined);
}

export function rectOf(selector: string): DOMRect | null {
  return document.querySelector(selector)?.getBoundingClientRect() ?? null;
}

export function centreRect(size: number): DOMRect {
  return new DOMRect(window.innerWidth / 2 - size / 2, window.innerHeight / 2 - size / 2, size, size);
}

export function markFor(selector: string, attribute: string, ms: number) {
  const target = document.querySelector<HTMLElement>(selector);
  if (target === null) return;
  target.setAttribute(attribute, "");
  setTimeout(() => target.removeAttribute(attribute), ms);
}

export function scrollIntoViewIfNeeded(selector: string) {
  const target = document.querySelector(selector);
  if (target === null) return false;
  const { top, bottom } = target.getBoundingClientRect();
  if (top < 120 || bottom > window.innerHeight - 40) target.scrollIntoView({ block: "center", behavior: "instant" });
  return true;
}
