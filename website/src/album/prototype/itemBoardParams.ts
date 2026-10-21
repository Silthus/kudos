// PROTOTYPE (personal#97): the item board's switches. Read from the URL once, then kept in sessionStorage so album navigation can't drop them. Never merge to main.
import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../../reducedMotion";

export const itemBoardFixture = "item-board";

export const speeds = [0.6, 0.7, 0.8, 1] as const;

export type Speed = (typeof speeds)[number];

export type BoardParams = { speed: Speed; still: boolean };

const storageKey = "prototype-item-board-4";

const listeners = new Set<() => void>();

let params: BoardParams = firstParams();

function firstParams(): BoardParams {
  const asked = new URLSearchParams(window.location.search);
  const stored = readStored();
  const speed = speeds.find((one) => String(one) === asked.get("speed")) ?? stored?.speed ?? 0.8;
  const still = asked.has("still") ? asked.get("still") === "1" : (stored?.still ?? false);
  return { speed, still };
}

function readStored(): BoardParams | null {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as BoardParams | null;
  } catch {
    return null;
  }
}

export function setBoardParams(change: Partial<BoardParams>) {
  params = { ...params, ...change };
  sessionStorage.setItem(storageKey, JSON.stringify(params));
  const address = new URL(window.location.href);
  address.searchParams.delete("back");
  address.searchParams.set("speed", String(params.speed));
  address.searchParams.set("still", params.still ? "1" : "0");
  window.history.replaceState(window.history.state, "", address);
  listeners.forEach((listener) => listener());
}

export function useBoardParams() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => params,
  );
}

export function staysStill(board: BoardParams) {
  return board.still || prefersReducedMotion();
}
