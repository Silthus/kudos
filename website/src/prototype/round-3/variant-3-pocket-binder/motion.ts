// PROTOTYPE (#625, round 3): reduced motion and narrow screens for the pocket binder. Never merge to main.
import { useSyncExternalStore } from "react";

function mediaHook(query: string) {
  const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  };
  return () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

export const usePrefersReducedMotion = mediaHook("(prefers-reduced-motion: reduce)");

export const useNarrowScreen = mediaHook("(max-width: 760px)");

export function shortDate(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function firstNameOf(name: string) {
  return name.split(" ")[0] ?? name;
}

export function clipped(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}
