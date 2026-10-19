import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Rarity } from "../shell";
import { groupIdOf, type Shelf } from "./hoggieGuide";

type RarityStrip = { current: Rarity | null; line: number | null; jump: (rarity: Rarity) => void };

type Landing = { scrolled: number; groups: string };

export function useRarityStrip(groups: Shelf[], bar: RefObject<HTMLElement | null>): RarityStrip {
  const { line, measure } = useLineUnder(bar);
  const [inView, setInView] = useState<Rarity | null>(null);
  const [picked, setPicked] = useState<Rarity | null>(null);
  const [jumping, setJumping] = useState<Rarity | null>(null);
  const landing = useRef<Landing | null>(null);
  const rarities = groups.map(({ rarity }) => rarity);
  const shown = groups.map(({ rarity, hoggies }) => `${rarity}:${hoggies.length}`).join(" ");
  useEffect(() => {
    if (line === null) return;
    const look = () => {
      if (hasMovedFrom(landing.current, shown)) {
        landing.current = null;
        setPicked(null);
      }
      setInView(rarityInView(rarities, line));
    };
    look();
    window.addEventListener("scroll", look, { passive: true });
    window.addEventListener("resize", look);
    return () => {
      window.removeEventListener("scroll", look);
      window.removeEventListener("resize", look);
    };
  }, [shown, line]);
  useEffect(() => {
    if (jumping === null || measure() !== line) return;
    const group = document.getElementById(groupIdOf(jumping));
    if (group === null) return;
    group.scrollIntoView({ block: "start" });
    landing.current = { scrolled: window.scrollY, groups: shown };
    group.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    setJumping(null);
  }, [jumping, shown, line]);
  const jump = (rarity: Rarity) => {
    landing.current = null;
    setPicked(rarity);
    setJumping(rarity);
  };
  return { current: picked ?? inView, line, jump };
}

function hasMovedFrom(landing: Landing | null, shown: string) {
  return landing !== null && (landing.groups !== shown || Math.abs(window.scrollY - landing.scrolled) > 1);
}

function rarityInView(rarities: Rarity[], line: number): Rarity | null {
  const groups = rarities.flatMap((rarity) => {
    const group = document.getElementById(groupIdOf(rarity));
    return group === null ? [] : [{ rarity, group }];
  });
  if (isScrolledToTheEnd()) return groups.at(-1)?.rarity ?? null;
  return groups.find(({ group }) => group.getBoundingClientRect().bottom > line + 1)?.rarity ?? null;
}

function isScrolledToTheEnd() {
  const page = document.documentElement.scrollHeight;
  return page > window.innerHeight && window.scrollY + window.innerHeight >= page - 1;
}

function useLineUnder(bar: RefObject<HTMLElement | null>) {
  const [line, setLine] = useState<number | null>(null);
  const measure = useCallback(() => {
    const element = bar.current;
    if (element === null) return null;
    const measured = lineUnder(element);
    setLine(measured);
    return measured;
  }, [bar]);
  useEffect(() => {
    const element = bar.current;
    if (element === null) return;
    measure();
    window.addEventListener("resize", measure);
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resized?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      resized?.disconnect();
    };
  }, [bar, measure]);
  return { line, measure };
}

function lineUnder(bar: HTMLElement) {
  const style = getComputedStyle(bar);
  const topBar = Number.parseFloat(style.top) || 0;
  return Math.round(style.position === "sticky" ? topBar + bar.getBoundingClientRect().height : topBar);
}
