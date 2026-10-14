import { useSyncExternalStore } from "react";

const wideScreen = "(min-width: 64rem)";

function subscribe(notify: () => void) {
  const query = window.matchMedia(wideScreen);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function isWideScreen() {
  return window.matchMedia(wideScreen).matches;
}

export function useWideScreen() {
  return useSyncExternalStore(subscribe, isWideScreen);
}
