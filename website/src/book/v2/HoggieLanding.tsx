import { useEffect, useRef } from "react";
import type { Drop } from "../../crates/drops";
import { HoggieCoin } from "../HoggieCoin";
import { centreRect, flyBetween, markFor, rectOf, scrollIntoViewIfNeeded } from "./flight";

export function HoggieLanding({ drop, onDone }: { drop: Drop; onDone: () => void }) {
  const ghost = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tile = `[data-hoggie="${drop.hoggie}"]`;
    const timer = setTimeout(() => {
      if (ghost.current === null) return onDone();
      const landed = scrollIntoViewIfNeeded(tile);
      const coin = (landed && rectOf(`${tile} [data-coin]`)) || rectOf('[data-chapter="hoggies"]') || centreRect(64);
      void flyBetween(ghost.current, ghost.current.getBoundingClientRect(), coin, 900, -14).then(() => {
        markFor(tile, "data-landed", 1600);
        setTimeout(onDone, 300);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [drop.hoggie, onDone]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] grid place-items-center">
      <span ref={ghost} className="inline-flex drop-shadow-2xl">
        <HoggieCoin art={drop.art} rarity={drop.rarity} size={140} />
      </span>
    </div>
  );
}
