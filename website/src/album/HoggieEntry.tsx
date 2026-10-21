import { IconX } from "@posthog/icons";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { AlbumHoggie, AlbumHoggies } from "./answer";
import { keepFocusIn } from "./focusTrap";
import { HoggieArt } from "./HoggieArt";
import { ForgeOfferLine, ForgeReveal } from "./HoggieForge";
import { copiesWords, hoggieNameShownOf, numberOf, oddsWords, rarityTintOf } from "./hoggieGuide";
import { rarityWordOf } from "./opening";
import { dateOf } from "./teamPage";
import type { Forging } from "./useForge";
import type { PetPicking, PetProblem } from "./usePetPick";

type EntryProps = { hoggie: AlbumHoggie; answer: AlbumHoggies; picking: PetPicking | null; forging: Forging | null; steps: AlbumHoggie[]; onStep: (hoggie: AlbumHoggie) => void; onClose: () => void };

export function HoggieEntry({ hoggie, answer, picking, forging, steps, onStep, onClose }: EntryProps) {
  const title = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useFocusWhileOpen(hoggie);
  const revealing = forging?.forged != null;
  const stepBy = (by: number) => onStep(neighbourOf(hoggie, steps, by));
  const keys: Record<string, () => void> = { Escape: onClose, ArrowLeft: () => stepBy(-1), ArrowRight: () => stepBy(1) };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (revealing) return event.key === "Tab" && event.preventDefault();
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    const press = keys[event.key];
    if (press === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    press();
  };
  return (
    <div className="al-entry-scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialog} className="al-entry" role="dialog" aria-modal="true" aria-labelledby={title} style={rarityTintOf(hoggie.rarity)} onKeyDown={onKeyDown} data-found={hoggie.found ? "" : undefined}>
        <div className="al-entry-top" inert={revealing}>
          <span className="al-eyebrow">Field guide entry</span>
          <button ref={closeButton} type="button" className="al-entry-close" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="al-entry-detail" inert={revealing}>
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
            {hoggie.found && picking !== null && <PetPick hoggie={hoggie} picking={picking} />}
            {forging !== null && <ForgeOfferLine hoggie={hoggie} answer={answer} forging={forging} />}
          </div>
        </div>
        {forging?.forged && <ForgeReveal forged={forging.forged} onEnd={() => endTheForge(forging, answer, onStep)} />}
        <div className="al-entry-steps" inert={revealing}>
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

function endTheForge(forging: Forging, answer: AlbumHoggies, onStep: (hoggie: AlbumHoggie) => void) {
  const forged = answer.hoggies.find(({ hoggie }) => hoggie === forging.forged?.drop.hoggie);
  forging.done();
  if (forged !== undefined) onStep(forged);
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

function PetPick({ hoggie, picking }: { hoggie: AlbumHoggie; picking: PetPicking }) {
  if (picking.pet === hoggie.hoggie) return <YourPet />;
  const busy = picking.sending !== null;
  return (
    <div className="al-entry-pet-pick">
      <button type="button" className="al-entry-pet-button" aria-disabled={busy || undefined} onClick={busy ? undefined : () => picking.pick(hoggie.hoggie)}>
        {picking.sending === hoggie.hoggie ? "Making it your pet…" : "Make my pet"}
      </button>
      <p role="status" className="al-entry-pet-problem">
        {picking.problem?.hoggie === hoggie.hoggie ? petProblemWordsOf(picking.problem, hoggie) : ""}
      </p>
    </div>
  );
}

function YourPet() {
  const said = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusWasDropped()) said.current?.focus({ preventScroll: true });
  }, []);
  return (
    <p ref={said} tabIndex={-1} className="al-entry-pet">
      Your pet
    </p>
  );
}

function focusWasDropped() {
  return document.activeElement === null || document.activeElement === document.body;
}

function petProblemWordsOf({ reason }: PetProblem, hoggie: AlbumHoggie) {
  return reason === "refused" ? `${hoggie.name} couldn't be made your pet. Reload the page to see where it stands.` : "Couldn't reach HedgeHug. Try again.";
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
  useEffect(() => {
    if (focusWasDropped()) closeButton.current?.focus({ preventScroll: true });
  });
  return closeButton;
}

function plateOf(hoggie: string) {
  return [...document.querySelectorAll<HTMLElement>("[data-hoggie]")].find((plate) => plate.dataset.hoggie === hoggie);
}

function stillShown(element: Element | null) {
  return element instanceof HTMLElement && element.isConnected ? element : undefined;
}
