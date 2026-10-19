import { useEffect, useRef, useState, type RefObject } from "react";
import type { Rarity } from "../shell";
import { groupIdOf } from "./hoggieGuide";

type RarityStrip = { current: Rarity | null; line: number | null; jump: (rarity: Rarity) => void };

export function useRarityStrip(rarities: Rarity[], bar: RefObject<HTMLElement | null>): RarityStrip {
  const line = useLineUnder(bar);
  const [inView, setInView] = useState<Rarity | null>(null);
  const [picked, setPicked] = useState<Rarity | null>(null);
  const [jumping, setJumping] = useState<Rarity | null>(null);
  const landedAt = useRef<number | null>(null);
  const shown = rarities.join(" ");
  useEffect(() => {
    if (line === null) return;
    const look = () => {
      if (hasScrolledFrom(landedAt.current)) {
        landedAt.current = null;
        setPicked(null);
      }
      setInView(rarityInView(rarities, line));
    };
    look();
    window.addEventListener("scroll", look, { passive: true });
    return () => window.removeEventListener("scroll", look);
  }, [shown, line]);
  useEffect(() => {
    if (jumping === null) return;
    const group = document.getElementById(groupIdOf(jumping));
    if (group === null) return;
    group.scrollIntoView({ block: "start" });
    landedAt.current = window.scrollY;
    group.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    setJumping(null);
  }, [jumping, shown]);
  const jump = (rarity: Rarity) => {
    landedAt.current = null;
    setPicked(rarity);
    setJumping(rarity);
  };
  return { current: picked ?? inView, line, jump };
}

function hasScrolledFrom(landedAt: number | null) {
  return landedAt !== null && Math.abs(window.scrollY - landedAt) > 1;
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
  const topBar = Number.parseFloat(style.top) || 0;
  return Math.round(style.position === "sticky" ? topBar + bar.getBoundingClientRect().height : topBar);
}
