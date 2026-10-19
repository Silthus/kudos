import { useEffect, useState, type RefObject } from "react";
import type { Rarity } from "../shell";
import { groupIdOf } from "./hoggieGuide";

export function useRarityUnderBar(rarities: Rarity[], bar: RefObject<HTMLElement | null>): Rarity | null {
  const [under, setUnder] = useState<ReadonlySet<Rarity>>(() => new Set());
  const line = useLineUnder(bar);
  const shown = rarities.join(" ");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || line === null) return;
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
      { rootMargin: `-${line}px 0px 0px 0px` },
    );
    for (const group of groups.keys()) observer.observe(group);
    return () => {
      observer.disconnect();
      setUnder(new Set());
    };
  }, [shown, line]);
  return rarities.find((rarity) => under.has(rarity)) ?? null;
}

function groupOf(rarity: Rarity): [Element, Rarity][] {
  const group = document.getElementById(groupIdOf(rarity));
  return group === null ? [] : [[group, rarity]];
}

function useLineUnder(bar: RefObject<HTMLElement | null>) {
  const [line, setLine] = useState<number | null>(null);
  useEffect(() => {
    const element = bar.current;
    if (element === null) return;
    const measure = () => setLine(lineUnder(element));
    measure();
    window.addEventListener("resize", measure);
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resized?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      resized?.disconnect();
    };
  }, [bar]);
  return line;
}

function lineUnder(bar: HTMLElement) {
  const style = getComputedStyle(bar);
  if (style.position !== "sticky") return 0;
  return Math.round((Number.parseFloat(style.top) || 0) + bar.getBoundingClientRect().height);
}
