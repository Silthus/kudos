import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sparesForged } from "../../../convex/hoggies/catalogue";
import { prefersReducedMotion } from "../reducedMotion";
import type { AlbumHoggie, AlbumHoggies } from "./answer";
import { HoggieArt } from "./HoggieArt";
import { aRarityWordOf, forgeOfferOf, rarityTintOf, type ForgeOffer } from "./hoggieGuide";
import { rarityWordOf } from "./opening";
import type { ForgeProblem, Forged, Forging } from "./useForge";

type Phase = "fuse" | "flash" | "burst" | "shown";

const phaseEnds: Record<Exclude<Phase, "shown">, { after: number; next: Phase }> = { fuse: { after: 600, next: "flash" }, flash: { after: 200, next: "burst" }, burst: { after: 700, next: "shown" } };

const restMs = 2500;

export function ForgeOfferLine({ hoggie, answer, forging }: { hoggie: AlbumHoggie; answer: AlbumHoggies; forging: Forging }) {
  const offer = forgeOfferOf(hoggie, answer);
  if (offer === null) return null;
  if (offer.kind === "ready" || isPendingFor(hoggie, forging)) return <ForgeButton hoggie={hoggie} offer={offer} forging={forging} />;
  if (offer.kind === "full") return <p className="al-entry-forge-note">{`You hold every ${rarityWordOf(offer.into)}.`}</p>;
  return <p className="al-entry-forge-note">{`${sparesForged + 1} copies forge into ${aRarityWordOf(offer.into)} you don't have yet.`}</p>;
}

function isPendingFor({ hoggie }: AlbumHoggie, { sending, problem }: Forging) {
  return sending === hoggie || problem?.hoggie === hoggie;
}

function ForgeButton({ hoggie, offer, forging }: { hoggie: AlbumHoggie; offer: ForgeOffer; forging: Forging }) {
  const busy = forging.sending !== null;
  return (
    <div className="al-entry-forge">
      <button type="button" className="al-entry-pet-button" aria-disabled={busy || undefined} onClick={busy ? undefined : () => forging.forge(hoggie.hoggie)}>
        {forging.sending === hoggie.hoggie ? "Forging…" : `Forge ${sparesForged} into ${aRarityWordOf(offer.into)}`}
      </button>
      <p className="al-entry-forge-note">{`Keeps one ${hoggie.name}. Gives ${aRarityWordOf(offer.into)} you don't have yet.`}</p>
      <p role="status" className="al-entry-pet-problem">
        {forging.problem?.hoggie === hoggie.hoggie ? forgeProblemWordsOf(forging.problem, hoggie) : ""}
      </p>
    </div>
  );
}

function forgeProblemWordsOf({ reason }: ForgeProblem, hoggie: AlbumHoggie) {
  return reason === "refused" ? `${hoggie.name} couldn't be forged. Reload the page to see where it stands.` : "Couldn't reach HedgeHug. Try again.";
}

export function ForgeReveal({ forged, onEnd }: { forged: Forged; onEnd: () => void }) {
  const phase = usePhases(onEnd);
  const reveal = useRef<HTMLDivElement>(null);
  useEffect(() => reveal.current?.focus({ preventScroll: true }), []);
  const { drop } = forged;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["Enter", " ", "Escape"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    onEnd();
  };
  return (
    <div ref={reveal} role="status" aria-label="Forged" tabIndex={-1} className="al-forge" data-phase={phase} style={rarityTintOf(drop.rarity)} onClick={onEnd} onKeyDown={onKeyDown}>
      <div className="al-forge-stage" aria-hidden="true">
        {[0, 1, 2].map((copy) => (
          <span key={copy} className="al-forge-copy" data-copy={copy}>
            <HoggieArt hoggie={forged.from} hidden={false} />
          </span>
        ))}
        <span className="al-forge-flash" />
        <span className="al-forge-result">
          <HoggieArt hoggie={drop.hoggie} hidden={false} />
        </span>
      </div>
      <p className="al-forge-caption">{`Forged: ${drop.name} · ${rarityWordOf(drop.rarity)} · New`}</p>
    </div>
  );
}

function usePhases(onEnd: () => void) {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "shown" : "fuse"));
  const ending = useRef(onEnd);
  ending.current = onEnd;
  useEffect(() => {
    const timer = phase === "shown" ? setTimeout(() => ending.current(), restMs) : setTimeout(() => setPhase(phaseEnds[phase].next), phaseEnds[phase].after);
    return () => clearTimeout(timer);
  }, [phase]);
  return phase;
}
