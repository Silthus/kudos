import { useEffect, useState, type RefObject } from "react";
import type { Rarity } from "../shell";
import { groupIdOf } from "./hoggieGuide";

export function useRarityUnderBar(rarities: Rarity[], bar: RefObject<HTMLElement | null>): Rarity | null {
  const [under, setUnder] = useState<ReadonlySet<Rarity>>(() => new Set());
  const shown = rarities.join(" ");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || bar.current === null) return;
    const groups = new Map<Element, Rarity>(rarities.flatMap((rarity) => groupOf(rarity)));
    const observer = new IntersectionObserver(
      (entries) =>
        setUnder((current) => {
          const next = new Set(current);
          for (const { target, isIntersecting } of entries) {
            const rarity = groups.get(target);
            if (rarity === undefined) continue;
            if (isIntersecting) next.add(rarity);
            else next.delete(rarity);
          }
          return next;
        }),
      { rootMargin: `-${bottomOf(bar.current)}px 0px 0px 0px` },
    );
    for (const group of groups.keys()) observer.observe(group);
    return () => {
      observer.disconnect();
      setUnder(new Set());
    };
  }, [shown, bar]);
  return rarities.find((rarity) => under.has(rarity)) ?? null;
}

function bottomOf(bar: HTMLElement) {
  return Math.round((Number.parseFloat(getComputedStyle(bar).top) || 0) + bar.getBoundingClientRect().height);
}

function groupOf(rarity: Rarity): [Element, Rarity][] {
  const group = document.getElementById(groupIdOf(rarity));
  return group === null ? [] : [[group, rarity]];
}
