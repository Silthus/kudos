import { IconX } from "@posthog/icons";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { AlbumHoggie, AlbumHoggies } from "./answer";
import { keepFocusIn } from "./focusTrap";
import { HoggieArt } from "./HoggieArt";
import { copiesWords, hoggieNameShownOf, numberOf, oddsWords, rarityTintOf } from "./hoggieGuide";
import { rarityWordOf } from "./opening";
import { dateOf } from "./teamPage";

type EntryProps = { hoggie: AlbumHoggie; answer: AlbumHoggies; steps: AlbumHoggie[]; onStep: (hoggie: AlbumHoggie) => void; onClose: () => void };

export function HoggieEntry({ hoggie, answer, steps, onStep, onClose }: EntryProps) {
  const title = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useFocusWhileOpen(hoggie);
  const stepBy = (by: number) => onStep(neighbourOf(hoggie, steps, by));
  const keys: Record<string, () => void> = { Escape: onClose, ArrowLeft: () => stepBy(-1), ArrowRight: () => stepBy(1) };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    const press = keys[event.key];
    if (press === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    press();
  };
  return (
    <div className="al-entry-scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialog} className="al-entry" role="dialog" aria-modal="true" aria-labelledby={title} style={rarityTintOf(hoggie.rarity)} onKeyDown={onKeyDown} data-found={hoggie.found ? "" : undefined}>
        <div className="al-entry-top">
          <span className="al-eyebrow">Field guide entry</span>
          <button ref={closeButton} type="button" className="al-entry-close" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="al-entry-detail">
          <figure className="al-entry-art">
            <HoggieArt hoggie={hoggie.hoggie} hidden={!hoggie.found} />
          </figure>
          <div className="al-entry-words">
            <p className="al-entry-number">{numberOf(hoggie, answer)}</p>
            <h2 id={title} className="al-entry-name">
              {hoggieNameShownOf(hoggie)}
            </h2>
            <span className="al-entry-pill">{rarityWordOf(hoggie.rarity)}</span>
            {hoggie.found ? <FoundFacts hoggie={hoggie} answer={answer} /> : <StillHidden hoggie={hoggie} answer={answer} />}
          </div>
        </div>
        <div className="al-entry-steps">
          <button type="button" className="al-entry-step" onClick={() => stepBy(-1)}>
            <span aria-hidden="true">←</span> Previous
          </button>
          <span>{`${steps.indexOf(hoggie) + 1} of ${steps.length}`}</span>
          <button type="button" className="al-entry-step" onClick={() => stepBy(1)}>
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FoundFacts({ hoggie, answer }: { hoggie: AlbumHoggie; answer: AlbumHoggies }) {
  return (
    <dl className="al-entry-facts">
      {hoggie.firstAt !== null && (
        <>
          <dt>First found</dt>
          <dd>{dateOf(hoggie.firstAt)}</dd>
        </>
      )}
      <dt>Copies</dt>
      <dd>{copiesWords(hoggie.count)}</dd>
      <dt>Odds</dt>
      <dd>{oddsWords(hoggie, answer)}</dd>
    </dl>
  );
}

function StillHidden({ hoggie, answer }: { hoggie: AlbumHoggie; answer: AlbumHoggies }) {
  return (
    <>
      <p className="al-entry-hint">Still out there. Every thoughtful kudos you give can earn a pack, and every pack rolls one hoggie.</p>
      <dl className="al-entry-facts">
        <dt>Odds</dt>
        <dd>{oddsWords(hoggie, answer)}</dd>
      </dl>
    </>
  );
}

function neighbourOf(hoggie: AlbumHoggie, steps: AlbumHoggie[], by: number) {
  const at = steps.indexOf(hoggie);
  return steps[(at + by + steps.length) % steps.length]!;
}

function useFocusWhileOpen(hoggie: AlbumHoggie) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const shown = useRef(hoggie.hoggie);
  shown.current = hoggie.hoggie;
  useEffect(() => {
    const opener = document.activeElement;
    closeButton.current?.focus({ preventScroll: true });
    return () => (plateOf(shown.current) ?? stillShown(opener))?.focus({ preventScroll: true });
  }, []);
  return closeButton;
}

function plateOf(hoggie: string) {
  return [...document.querySelectorAll<HTMLElement>("[data-hoggie]")].find((plate) => plate.dataset.hoggie === hoggie);
}

function stillShown(element: Element | null) {
  return element instanceof HTMLElement && element.isConnected ? element : undefined;
}
