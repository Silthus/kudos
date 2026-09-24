/**
 * Light / dark / system theme. The preference lives in `localStorage["kudos.theme"]` (absent = system)
 * and is applied as `<html data-theme="light|dark">`. The inline script in `index.html` does the first
 * apply before paint, so there's no flash of the wrong theme; keep it in step with `resolveTheme`
 * (tests/theme-prepaint.test.ts runs it against this module).
 */
import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "kudos.theme";
export const THEME_PREFS: ThemePref[] = ["light", "dark", "system"];

/** A stored value, or anything unknown, read as a preference. Nothing stored means "follow the system". */
export function parseThemePref(raw: string | null): ThemePref {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** The theme to paint: an explicit choice wins, "system" follows the OS. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

// ---- Browser side ----------------------------------------------------------------------------

const listeners = new Set<() => void>();
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
/** The choice for this page view when storage is blocked (privacy modes). */
let unsavedPref: ThemePref | null = null;

function readPref(): ThemePref {
  if (unsavedPref) return unsavedPref;
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Paints the current preference and points the browser chrome (theme-color) at the scene colour. */
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(readPref(), darkQuery().matches);
  // The browser chrome follows the painted scene colour, however the theme was chosen.
  const bg = getComputedStyle(root).getPropertyValue("--k-bg").trim();
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
  listeners.forEach((l) => l());
}

/** Call once at startup: syncs the browser chrome and follows OS changes and other tabs from then on. */
export function startTheme() {
  applyTheme();
  darkQuery().addEventListener("change", applyTheme);
  window.addEventListener("storage", (e) => e.key === THEME_STORAGE_KEY && applyTheme());
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
    unsavedPref = null;
  } catch {
    unsavedPref = pref; // not persisted, but still applied for this page view
  }
  applyTheme();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** The stored preference, the theme actually painted, and a setter that persists and applies. */
export function useTheme(): { pref: ThemePref; theme: Theme; setPref: (pref: ThemePref) => void } {
  const pref = useSyncExternalStore(subscribe, readPref);
  const theme = useSyncExternalStore(subscribe, currentTheme);
  return { pref, theme, setPref: setThemePref };
}
