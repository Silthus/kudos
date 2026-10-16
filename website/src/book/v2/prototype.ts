import { useSyncExternalStore } from "react";

export type Structure = "a" | "b" | "c";

export type CrateStyle = "chest" | "pack" | "spin";

export const structures: Record<Structure, string> = { a: "Book with chapters", b: "Open spread with page tabs", c: "Trophy shelves" };

export const crateStyles: Record<CrateStyle, string> = { chest: "Chest", pack: "Foil pack", spin: "Case spin" };

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
  const structure = structureKeys.find((key) => key === params.get("variant")) ?? "a";
  const crate = crateStyleKeys.find((key) => key === params.get("crate")) ?? "chest";
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
