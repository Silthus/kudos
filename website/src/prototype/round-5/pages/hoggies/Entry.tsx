// PROTOTYPE (#625, round 5): the centred entry card for one hoggie. It sits over the page without the top layer, so the prototype bar stays clickable. Never merge to main.
import { useEffect, useRef } from "react";
import type { Album, Hoggie } from "../../../round-3/album";
import { HoggieDetail } from "./HoggieDetail";
import { rarityTint } from "./shelf";

const titleId = "r5h-entry-title";

type Props = { hoggie: Hoggie; album: Album; steps: Hoggie[]; onStep: (hoggie: Hoggie) => void; onClose: () => void };

export function Entry({ hoggie, album, steps, onStep, onClose }: Props) {
  const closeButton = useFocusWhileOpen();
  const stepBy = (by: number) => onStep(neighbourOf(hoggie, steps, by));
  useKeys({ Escape: onClose, ArrowLeft: () => stepBy(-1), ArrowRight: () => stepBy(1) });
  return (
    <div className="r5h-scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="r5h-entry" role="dialog" aria-labelledby={titleId}>
        <div className="r5h-entry-inner" style={rarityTint(hoggie.rarity)}>
          <div className="r5h-entry-top">
            <span className="r5h-eyebrow">Field guide entry</span>
            <button ref={closeButton} type="button" className="r5h-close" aria-label="Close the entry" onClick={onClose}>
              ×
            </button>
          </div>
          <HoggieDetail hoggie={hoggie} album={album} titleId={titleId} />
          <div className="r5h-entry-steps">
            <button type="button" className="r5h-step" onClick={() => stepBy(-1)}>
              ← Previous
            </button>
            <span>
              {steps.indexOf(hoggie) + 1} of {steps.length}
            </span>
            <button type="button" className="r5h-step" onClick={() => stepBy(1)}>
              Next →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function neighbourOf(hoggie: Hoggie, steps: Hoggie[], by: number) {
  const at = steps.indexOf(hoggie);
  return steps[(at + by + steps.length) % steps.length]!;
}

function useFocusWhileOpen() {
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    target.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return target;
}

function typingIn(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

function useKeys(handlers: Record<string, () => void>) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const handler = latest.current[event.key];
      if (handler === undefined || typingIn(event.target) || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
}
