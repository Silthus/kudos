import { useEffect, useRef, useState, type RefObject } from "react";
import type { Drop } from "../../crates/drops";
import { prefersReducedMotion } from "../../reducedMotion";
import { HoggieCoin } from "../HoggieCoin";
import { appears, flyBetween, markFor, scrollIntoViewIfNeeded, wait } from "./flight";
import type { OpenedPack } from "./packs";

export const bookFlipsForMs = 200;

export const tileSettlesForMs = 400;

export const packFliesForMs = 850;

export const tileGlowsForMs = 1500;

export const landingPauseMs = 600;

const tileLooksEveryMs = 50;

type PackLandingProps = { opened: OpenedPack[]; onDone: () => void };

export function PackLanding({ opened, onDone }: PackLandingProps) {
  const [current, setCurrent] = useState<Drop>();
  const ghost = useRef<HTMLSpanElement>(null);
  const onDoneNow = useRef(onDone);
  onDoneNow.current = onDone;
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const drop of opened.flatMap(({ drop }) => drop ?? [])) {
        if (cancelled) return;
        setCurrent(drop);
        await land(drop, ghost);
        setCurrent(undefined);
        await wait(landingPauseMs);
      }
      if (!cancelled) onDoneNow.current();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [opened]);
  if (current === undefined) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] grid place-items-center" aria-hidden="true">
      <span ref={ghost} className="inline-flex drop-shadow-2xl">
        <HoggieCoin art={current.art} rarity={current.rarity} size={128} />
      </span>
    </div>
  );
}

async function land(drop: Drop, ghost: RefObject<HTMLSpanElement | null>) {
  flipTheBookTo(drop.rarity);
  await wait(bookFlipsForMs);
  const tile = await appears(`[data-hoggie="${drop.hoggie}"]`, tileSettlesForMs, tileLooksEveryMs);
  if (tile !== null) scrollIntoViewIfNeeded(tile);
  const target = tile?.querySelector<HTMLElement>("[data-coin]") ?? tile ?? document.querySelector<HTMLElement>("[data-crate-store]");
  if (ghost.current !== null && target !== null && !prefersReducedMotion()) await flyBetween(ghost.current, target.getBoundingClientRect(), packFliesForMs);
  if (tile !== null) markFor(tile, "data-landed", tileGlowsForMs);
}

function flipTheBookTo(rarity: Drop["rarity"]) {
  const hash = `#hoggies/${rarity}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}
