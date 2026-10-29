import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sparesForged } from "../../../convex/album/hoggies/catalogue";
import { prefersReducedMotion } from "../reducedMotion";
import type { Rarity } from "../shell";
import type { AlbumHoggie, AlbumHoggies } from "./answer";
import { HoggieArt } from "./HoggieArt";
import { aRarityWordOf, forgeOfferOf, rarityTintOf, type ForgeOffer } from "./hoggieGuide";
import { forgedItemLabelOf, ItemBack } from "./ItemBoard";
import type { ForgeProblem, Forged, Forging } from "./useForge";

type Phase = "fuse" | "flash" | "down";

const phaseEnds: Record<Exclude<Phase, "down">, { after: number; next: Phase }> = { fuse: { after: 600, next: "flash" }, flash: { after: 200, next: "down" } };

export function ForgeOfferLine({ hoggie, answer, forging }: { hoggie: AlbumHoggie; answer: AlbumHoggies; forging: Forging }) {
  const offer = forgeOfferOf(hoggie, answer, isUnansweredFor(hoggie, forging));
  if (offer === null) return null;
  if (offer.kind === "ready" || isPendingFor(hoggie, forging)) return <ForgeButton hoggie={hoggie} offer={offer} forging={forging} />;
  return <p className="al-entry-forge-note">{`${sparesForged + 1} copies forge into ${aRarityWordOf(offer.into)}${offer.full ? "" : " you don't have yet"}.`}</p>;
}

function isPendingFor({ hoggie }: AlbumHoggie, { sending, problems }: Forging) {
  return sending === hoggie || problems[hoggie] !== undefined;
}

function isUnansweredFor({ hoggie }: AlbumHoggie, { sending, problems }: Forging) {
  return sending === hoggie || problems[hoggie] === "unreachable";
}

function ForgeButton({ hoggie, offer, forging }: { hoggie: AlbumHoggie; offer: ForgeOffer; forging: Forging }) {
  const busy = forging.sending !== null;
  const problem = forging.problems[hoggie.hoggie];
  return (
    <div className="al-entry-forge">
      <button type="button" className="al-entry-pet-button" aria-disabled={busy || undefined} onClick={busy ? undefined : () => forging.forge(hoggie.hoggie)}>
        {forging.sending === hoggie.hoggie ? "Forging…" : `Forge ${sparesForged} into ${aRarityWordOf(offer.into)}`}
      </button>
      <p className="al-entry-forge-note">{`Keeps one ${hoggie.name}. ${givesWordsOf(offer)}`}</p>
      <p role="status" className="al-entry-pet-problem">
        {problem === undefined ? "" : forgeProblemWordsOf(problem, hoggie)}
      </p>
    </div>
  );
}

function givesWordsOf({ into, full }: ForgeOffer) {
  return full ? `Gives ${aRarityWordOf(into)}. You hold every one already.` : `Gives ${aRarityWordOf(into)} you don't have yet.`;
}

function forgeProblemWordsOf(problem: ForgeProblem, hoggie: AlbumHoggie) {
  return problem === "refused" ? `${hoggie.name} couldn't be forged. Reload the page to see where it stands.` : "Couldn't reach HedgeHug. Try again.";
}

type RevealProps = { forged: Forged; into: Rarity; onTurn: (card: HTMLElement) => void; onLater: () => void };

export function ForgeReveal({ forged, into, onTurn, onLater }: RevealProps) {
  const phase = usePhases();
  const reveal = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  useEffect(() => (phase === "down" ? card.current : reveal.current)?.focus({ preventScroll: true }), [phase]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onLater();
  };
  return (
    <div ref={reveal} role="group" aria-label="Forged" tabIndex={-1} className="al-forge" data-phase={phase} style={rarityTintOf(into)} onKeyDown={onKeyDown}>
      <div className="al-forge-stage">
        {[0, 1, 2].map((copy) => (
          <span key={copy} className="al-forge-copy" data-copy={copy} aria-hidden="true">
            <HoggieArt hoggie={forged.from} hidden={false} />
          </span>
        ))}
        <span className="al-forge-flash" aria-hidden="true" />
        {phase === "down" && (
          <button ref={card} type="button" className="ib-item al-forge-card" aria-label={forgedItemLabelOf(forged.from)} onClick={(event) => onTurn(event.currentTarget)}>
            <ItemBack />
          </button>
        )}
      </div>
      <p className="al-forge-caption">{phase === "down" ? `Forged into ${aRarityWordOf(into)}. Identify it.` : ""}</p>
    </div>
  );
}

function usePhases() {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "down" : "fuse"));
  useEffect(() => {
    if (phase === "down") return;
    const timer = setTimeout(() => setPhase(phaseEnds[phase].next), phaseEnds[phase].after);
    return () => clearTimeout(timer);
  }, [phase]);
  return phase;
}
