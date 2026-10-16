import { useSyncExternalStore } from "react";

export type Structure = "a" | "b" | "c";

export type CrateStyle = "pack" | "chest" | "spin";

export const structures: Record<Structure, string> = { b: "The whole Book as a spread", a: "Book with chapters", c: "Trophy shelves" };

export const crateStyles: Record<CrateStyle, string> = { pack: "Foil packs", chest: "Chest", spin: "Case spin" };

export const structureKeys = Object.keys(structures) as Structure[];

export const crateStyleKeys = Object.keys(crateStyles) as CrateStyle[];

export const isPrototypeShell = Boolean(import.meta.env.VITE_SHELL_FIXTURE);

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const search = () => window.location.search;

export function usePrototypeParams(): { structure: Structure; crate: CrateStyle } {
  const params = new URLSearchParams(useSyncExternalStore(subscribe, search, () => ""));
  const structure = structureKeys.find((key) => key === params.get("variant")) ?? "b";
  const crate = crateStyleKeys.find((key) => key === params.get("crate")) ?? "pack";
  return { structure, crate };
}

export function setPrototypeParam(name: "variant" | "crate", value: string) {
  const address = new URL(window.location.href);
  address.searchParams.set(name, value);
  window.history.replaceState(null, "", address.pathname + address.search + address.hash);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function goTo(hash: string) {
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
