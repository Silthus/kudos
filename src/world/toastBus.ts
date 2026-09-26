import type { Toast } from "./life";

/**
 * Toasts from anywhere in the world into its one queue (#134 `Life`), so they come one at a time:
 * the simulator's clock (#144) says what a move of the days brought this way.
 */
type Listener = (toasts: Toast[]) => void;
const listeners = new Set<Listener>();

/**
 * Adds `toasts` to the queue. A move of the simulator's clock supersedes the last one's toasts
 * still waiting or showing: they're all of kind `clock`, and only the newest day is news.
 */
export function pushToasts(toasts: Toast[]) {
  if (toasts.length) for (const l of listeners) l(toasts);
}

/** Listens for toasts; returns the way to stop. */
export function onToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Something the world shows as a toast just came up (a kudos' level, a discovery, the tree's news): the windmill's sails turn once (#161). */
type ShownListener = () => void;
const shownListeners = new Set<ShownListener>();

export function toastShown() {
  for (const l of shownListeners) l();
}

export function onToastShown(listener: ShownListener): () => void {
  shownListeners.add(listener);
  return () => shownListeners.delete(listener);
}
