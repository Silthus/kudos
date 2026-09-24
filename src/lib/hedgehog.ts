// PROTOTYPE (#54): Hedgehog Mode state. Off by default; typing "hedgehog" anywhere (outside inputs) or the
// account-menu switch toggles a roaming hog. Celebrations can ask for a one-shot cameo hog even when the mode is off.
// Never spawns under prefers-reduced-motion. The renderer itself lives in a lazy chunk (HedgehogLayer).
import { useEffect, useSyncExternalStore } from "react";
import type { Rarity } from "./rarity";

const KEY = "kudos.hedgehog-mode";
export type Cameo = { id: string; rarity: Rarity; words: string[] };
type State = { roaming: boolean; cameos: Cameo[] };
let state: State = { roaming: typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "on", cameos: [] };
const listeners = new Set<() => void>();
const emit = (next: State) => ((state = next), listeners.forEach((l) => l()));

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setRoaming(on: boolean) {
  if (on) localStorage.setItem(KEY, "on");
  else localStorage.removeItem(KEY);
  emit({ ...state, roaming: on });
}
/** Ask for a hog cameo on an epic/legendary moment. A no-op under reduced motion. */
export function celebrate(rarity: Rarity, words: string[]) {
  if (reducedMotion() || (rarity !== "epic" && rarity !== "legendary")) return;
  emit({ ...state, cameos: [...state.cameos, { id: crypto.randomUUID(), rarity, words }] });
}
export function takeCameos(): Cameo[] {
  const c = state.cameos;
  if (c.length) state = { ...state, cameos: [] };
  return c;
}
export function useHedgehog() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
}
export function subscribeHedgehog(l: () => void): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** The Easter egg: type h-e-d-g-e-h-o-g anywhere that isn't a text field. */
export function useHedgehogKonami() {
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-8);
      if (buf === "hedgehog") setRoaming(!state.roaming);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
