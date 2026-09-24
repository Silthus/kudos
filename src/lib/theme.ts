// PROTOTYPE (#54): light/dark/system theme, persisted, applied to <html data-theme> (a pre-paint script in index.html does the first apply).
import { useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "kudos.theme";
const listeners = new Set<() => void>();
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}
export function resolveTheme(pref = getThemePref()): "light" | "dark" {
  return pref === "system" ? (media().matches ? "dark" : "light") : pref;
}
function apply() {
  document.documentElement.dataset.theme = resolveTheme();
  listeners.forEach((l) => l());
}
export function setThemePref(pref: ThemePref) {
  if (pref === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, pref);
  apply();
}
export function useTheme() {
  useEffect(() => {
    const m = media();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);
  const pref = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getThemePref);
  return { pref, resolved: resolveTheme(pref), setPref: setThemePref };
}
