export const emojiFlightTiming = { springMs: 500, pauseMs: 375, flightMs: 700, bumpMs: 320 };

export const springEasing = "cubic-bezier(0.2, 0.9, 0.3, 1.4)";

export const flightEasing = "cubic-bezier(0.45, 0, 0.25, 1)";

export const springFrames: Keyframe[] = [
  { transform: "translate(0, 56px) scale(0.2)", opacity: 0 },
  { transform: "translate(0, -10px) scale(1.2)", opacity: 1, offset: 0.6 },
  { transform: "none", opacity: 1 },
];

export function theEmojiButton() {
  return document.querySelector<HTMLElement>(".al-emojis");
}

export function flightFrames(from: DOMRect, to: DOMRect): Keyframe[] {
  const scale = from.width === 0 ? 0.2 : Math.max(0.12, to.height / from.width);
  const x = to.left + to.width / 2 - (from.left + from.width / 2);
  const y = to.top + to.height / 2 - (from.top + from.height / 2);
  return [{ transform: "none" }, { transform: `translate(${x * 0.35}px, ${y * 0.35 - 60}px) scale(${(1 + scale) / 2}) rotate(-8deg)`, offset: 0.4 }, { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 0.4 }];
}

export function bumpTheEmojiButton(button: HTMLElement | null) {
  button?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: emojiFlightTiming.bumpMs, easing: "ease-out" });
}

export async function flyIntoTheEmojiButton(element: HTMLElement, button: HTMLElement | null, signal?: AbortSignal) {
  if (button === null || typeof element.animate !== "function") return pause(emojiFlightTiming.flightMs, signal);
  const flight = element.animate(flightFrames(element.getBoundingClientRect(), button.getBoundingClientRect()), { duration: emojiFlightTiming.flightMs, easing: flightEasing, fill: "forwards" });
  signal?.addEventListener("abort", () => flight.cancel(), { once: true });
  await flight.finished.catch(() => undefined);
  if (signal?.aborted !== true) bumpTheEmojiButton(button);
}

export async function flyACopyIntoTheEmojiButton(picture: HTMLElement, signal: AbortSignal) {
  const copy = copyOver(picture);
  signal.addEventListener("abort", () => copy.remove(), { once: true });
  await flyIntoTheEmojiButton(copy, theEmojiButton(), signal);
  copy.remove();
}

function copyOver(picture: HTMLElement) {
  const { left, top, width, height } = picture.getBoundingClientRect();
  const copy = picture.cloneNode(true) as HTMLElement;
  copy.classList.add("al-emoji-copy");
  Object.assign(copy.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  document.body.append(copy);
  return copy;
}

function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (window.clearTimeout(timer), resolve()), { once: true });
  });
}
