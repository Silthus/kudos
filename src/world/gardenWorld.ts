import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import type { api } from "../../convex/_generated/api";
import type { StageKey } from "../../convex/lib/garden";
import { sameTile, type Tile } from "./iso";
import type { PixelMap } from "./pixels";
import { PLOTS } from "./places/garden";
import { keyBedSprite, plantSprite } from "./plants";

/**
 * Your garden on the map (#129, on the tree's terrace since #156): the art for your key beds and the
 * neighbours' ring, from `api.gardens.mine` and `api.gardens.neighbours`. The shell hands these to
 * the painter (`WorldFurniture`), and knows a plot by its tile (`world.plots`), so walking onto one
 * opens it.
 */

type Mine = FunctionReturnType<typeof api.gardens.mine>;
type Ring = FunctionReturnType<typeof api.gardens.neighbours>;

/** Which plants lean for one frame: those watered today (on arriving), or all of them (fruit picked). */
export type Sway = "watered" | "picked" | null;

/** The plot a tile is, in planting order, or -1. */
export const plotIndex = (plots: Tile[], t: Tile) => plots.findIndex((p) => sameTile(p, t));

/** How many of the plot tiles are yours: your plots, or more if you grow more plants than you have plots. */
export const plotCount = (garden: Mine | undefined) =>
  garden?.open ? Math.min(PLOTS.length, Math.max(garden.plots, garden.plants.length, ...garden.plants.map((p) => p.plot + 1))) : 0;

/** Can you plant now: a teammate to plant for, a free plot, and the Hog coins. */
export const canPlant = (garden: Extract<NonNullable<Mine>, { open: true }>) =>
  garden.candidates.length > 0 && garden.plants.length < garden.plots && garden.balance >= garden.cost;

/**
 * One sprite per plot tile, in planting order: a plant on its key bed, an empty key (with a small
 * "plant" sign when there's a teammate to plant for), or null where the lawn is still lawn.
 */
export function gardenPlots(garden: Mine | undefined, { today, sway = null }: { today: string; sway?: Sway }): (PixelMap | null)[] {
  const yours = plotCount(garden);
  return PLOTS.map((_, i) => {
    if (!garden?.open || i >= yours) return null;
    const p = garden.plants.find((g) => g.plot === i);
    if (!p) return keyBedSprite({ sign: canPlant(garden) });
    return plantSprite({
      stage: p.stage as StageKey,
      species: p.species,
      dormant: p.dormant,
      fruit: p.fruit.length,
      goldenLeaves: p.goldenLeaves,
      sway: sway === "picked" || (sway === "watered" && p.lastWatered === today),
    });
  });
}

export type RingBed = Ring[number] & { tile: Tile; sprite: PixelMap };

/** The neighbours on their beds (`world.beds`), the closest first on the beds nearest your garden's front. */
export function ringBeds(ring: Ring | undefined, beds: Tile[]): RingBed[] {
  return (ring ?? []).slice(0, beds.length).map((n, i) => ({
    ...n,
    tile: beds[i],
    sprite: plantSprite({ stage: n.top.stage as StageKey, species: n.top.species, bed: false, mini: true }),
  }));
}

/** `?plot=N` in a garden URL: that plot, if it's one of your `count` plots. */
export function plotFrom(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get("plot");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < count ? n : null;
}

/** Fired by the garden window when fruit is picked: the plants on the map sway. */
export const FRUIT_PICKED = "kudos:fruit-picked";
/** How long a plant leans before it stands straight again. */
export const SWAY_MS = 360;

/**
 * The one frame the plants lean: once for the plants watered today when your garden first shows,
 * and all of them each time you pick fruit. Never under reduced motion.
 */
export function useGardenSway(garden: Mine | undefined, today: string, still: boolean): Sway {
  const [sway, setSway] = useState<Sway>(null);
  const greeted = useRef(false);
  useEffect(() => {
    if (still || greeted.current || !garden?.open) return;
    greeted.current = true;
    if (garden.plants.some((p) => p.lastWatered === today)) setSway("watered");
  }, [garden, today, still]);
  useEffect(() => {
    if (still) return;
    const picked = () => setSway("picked");
    window.addEventListener(FRUIT_PICKED, picked);
    return () => window.removeEventListener(FRUIT_PICKED, picked);
  }, [still]);
  useEffect(() => {
    if (!sway) return;
    const timer = setTimeout(() => setSway(null), SWAY_MS);
    return () => clearTimeout(timer);
  }, [sway]);
  return sway;
}
