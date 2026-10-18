// PROTOTYPE (#625, round 6): the sticky collection bar: its height, whether it is stuck under the top bar, and which rarity group sits under it. Never merge to main.
import { useEffect, useState, type RefObject } from "react";
import { groupId, type Rarity } from "./shelf";

export const topBarHeight = 60;

export function useHeightOf(target: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = target.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => setHeight(Math.round(element.getBoundingClientRect().height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);
  return height;
}

export function useStuck(sentinel: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const element = sentinel.current;
    if (element === null) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < topBarHeight), { rootMargin: `-${topBarHeight}px 0px 0px 0px` });
    observer.observe(element);
    return () => observer.disconnect();
  }, [sentinel]);
  return stuck;
}

function rarityOf(element: Element, rarities: readonly Rarity[]) {
  return rarities.find((rarity) => element.id === groupId(rarity)) ?? null;
}

export function useRarityUnderBar(rarities: readonly Rarity[], line: number) {
  const [below, setBelow] = useState<ReadonlySet<Rarity>>(() => new Set());
  const shown = rarities.join(" ");
  useEffect(() => {
    const groups = rarities.map((rarity) => document.getElementById(groupId(rarity))).filter((group) => group !== null);
    const observer = new IntersectionObserver(
      (entries) =>
        setBelow((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            const rarity = rarityOf(entry.target, rarities);
            if (rarity === null) continue;
            if (entry.isIntersecting) next.add(rarity);
            else next.delete(rarity);
          }
          return next;
        }),
      { rootMargin: `-${line}px 0px 0px 0px` },
    );
    for (const group of groups) observer.observe(group);
    return () => observer.disconnect();
  }, [shown, line]);
  return rarities.find((rarity) => below.has(rarity)) ?? null;
}
