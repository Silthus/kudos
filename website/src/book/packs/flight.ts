export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function flyBetween(ghost: HTMLElement, to: DOMRect, ms: number): Promise<unknown> {
  if (typeof ghost.animate !== "function") return Promise.resolve();
  const from = ghost.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = from.width === 0 ? 1 : to.width / from.width;
  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1) rotate(-12deg)", offset: 0 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${(1 + scale) / 2}) rotate(6deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, offset: 1 },
    ],
    { duration: ms, easing: "cubic-bezier(0.3, 0.7, 0.25, 1)", fill: "forwards" },
  );
  return animation.finished.catch(() => undefined);
}

export async function appears(selector: string, withinMs: number, everyMs: number, stillWanted: () => boolean): Promise<HTMLElement | null> {
  const deadline = Date.now() + withinMs;
  for (;;) {
    if (!stillWanted()) return null;
    const found = document.querySelector<HTMLElement>(selector);
    if (found !== null || Date.now() >= deadline) return found;
    await wait(everyMs);
  }
}

export function scrollIntoViewIfNeeded(target: HTMLElement) {
  const { top, bottom } = target.getBoundingClientRect();
  if (top < 120 || bottom > window.innerHeight - 40) target.scrollIntoView({ block: "center", behavior: "instant" });
}

export function markFor(target: HTMLElement, attribute: string, ms: number) {
  target.setAttribute(attribute, "");
  setTimeout(() => target.removeAttribute(attribute), ms);
}
