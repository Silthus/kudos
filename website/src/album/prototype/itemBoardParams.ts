// PROTOTYPE (personal#97): the item board's switches. Read from the URL once, then kept in sessionStorage so album navigation can't drop them. Never merge to main.
import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../../reducedMotion";

export const itemBoardFixture = "item-board";

export const boardVariants = [
  { key: "spotlight", name: "Spotlight", says: "The item rises to the middle, turns big, then flies to its page" },
  { key: "in-place", name: "Turn in place", says: "The item turns where it lies, then flies straight to its page" },
  { key: "page-first", name: "Page first", says: "The board steps aside, the item turns over its own slot and drops in" },
] as const;

export type BoardVariant = (typeof boardVariants)[number]["key"];

export const speeds = [0.6, 1, 1.5] as const;

export type Speed = (typeof speeds)[number];

export type BoardParams = { variant: BoardVariant; speed: Speed; still: boolean };

const storageKey = "prototype-item-board";

const listeners = new Set<() => void>();

let params: BoardParams = firstParams();

function firstParams(): BoardParams {
  const asked = new URLSearchParams(window.location.search);
  const stored = readStored();
  const variant = boardVariants.find(({ key }) => key === asked.get("variant"))?.key ?? stored?.variant ?? "spotlight";
  const speed = speeds.find((one) => String(one) === asked.get("speed")) ?? stored?.speed ?? 1;
  const still = asked.has("still") ? asked.get("still") === "1" : (stored?.still ?? false);
  return { variant, speed, still };
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
  address.searchParams.set("variant", params.variant);
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
