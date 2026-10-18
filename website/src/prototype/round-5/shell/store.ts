// PROTOTYPE (#625, round 5): a tiny external store the shell's moving parts share outside React state. Never merge to main.
import { useSyncExternalStore } from "react";

export type Store<T> = { get: () => T; set: (next: T) => void; use: () => T };

export function storeOf<T>(initial: T): Store<T> {
  let value = initial;
  const watchers = new Set<() => void>();
  const get = () => value;
  const set = (next: T) => {
    value = next;
    for (const watcher of watchers) watcher();
  };
  const subscribe = (watcher: () => void) => {
    watchers.add(watcher);
    return () => watchers.delete(watcher);
  };
  return { get, set, use: () => useSyncExternalStore(subscribe, get) };
}
