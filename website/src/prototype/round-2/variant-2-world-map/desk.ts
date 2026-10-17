// PROTOTYPE (#625): the World map's window desk: which windows are open, their z-order and places, kept in step with real URLs. Never merge to main.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useNavigate } from "../../../AppLink";
import { keepingTheVariant } from "../../variants";

export type WindowId = "bag" | "hoggies" | "teams" | "market" | "quests" | "activity" | "leaderboard" | "settings" | "hall";

export type Placement = { x: number; y: number; docked: boolean };

type Desk = { open: WindowId[]; placements: Partial<Record<WindowId, Placement>>; addresses: Partial<Record<WindowId, string>> };

const homes: Record<WindowId, string> = {
  bag: "/book#bag",
  hoggies: "/book#hoggies",
  teams: "/book#teams",
  market: "/book#store",
  quests: "/quests",
  activity: "/activity",
  leaderboard: "/leaderboard",
  settings: "/settings",
  hall: "/book/earned",
};

let desk: Desk = { open: [], placements: {}, addresses: {} };

const listeners = new Set<() => void>();

function change(next: (current: Desk) => Desk) {
  desk = next(desk);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDesk() {
  return useSyncExternalStore(subscribe, () => desk);
}

export function frontOf(open: WindowId[]): WindowId | null {
  return open.at(-1) ?? null;
}

export function addressOf(id: WindowId) {
  return desk.addresses[id] ?? homes[id];
}

export function hashOf(id: WindowId) {
  const address = addressOf(id);
  const at = address.indexOf("#");
  return at === -1 ? "" : address.slice(at);
}

export function windowAt({ pathname, hash }: { pathname: string; hash: string }): WindowId | null {
  if (pathname === "/quests") return "quests";
  if (pathname === "/activity") return "activity";
  if (pathname === "/leaderboard") return "leaderboard";
  if (pathname === "/settings") return "settings";
  if (pathname === "/book/earned") return "hall";
  if (pathname !== "/book") return null;
  if (hash.startsWith("#store")) return "market";
  if (hash.startsWith("#bag")) return "bag";
  if (hash.startsWith("#teams")) return "teams";
  return "hoggies";
}

function currentAddress() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function withoutVariant(address: string) {
  const url = new URL(address, window.location.origin);
  url.searchParams.delete("variant");
  return `${url.pathname}${url.search}${url.hash}`;
}

function raised(open: WindowId[], id: WindowId) {
  return [...open.filter((each) => each !== id), id];
}

function remember(id: WindowId, address: string) {
  change((current) => ({ ...current, addresses: { ...current.addresses, [id]: address } }));
}

function raise(id: WindowId) {
  if (frontOf(desk.open) === id) return;
  change((current) => ({ ...current, open: raised(current.open, id) }));
}

function closeQuietly(id: WindowId) {
  change((current) => ({ ...current, open: current.open.filter((each) => each !== id) }));
}

export function place(id: WindowId, placement: Placement) {
  change((current) => ({ ...current, placements: { ...current.placements, [id]: placement } }));
}

export function placementOf(id: WindowId) {
  return desk.placements[id];
}

export function resetPlacements() {
  change((current) => ({ ...current, placements: {} }));
}

type Entry = { wmDepth: number; wmOpened: WindowId | null };

function entryNow(): Entry {
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null || !("wmDepth" in state)) return { wmDepth: 0, wmOpened: null };
  const { wmDepth, wmOpened } = state as Entry;
  return { wmDepth, wmOpened };
}

let entry: Entry = { wmDepth: 0, wmOpened: null };

export function replaceAddress(href: string) {
  window.history.replaceState(window.history.state, "", keepingTheVariant(href));
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

export function useDeskRouting() {
  useEffect(() => {
    entry = entryNow();
    if (window.history.state === null) {
      entry = { wmDepth: 0, wmOpened: windowAt(window.location) };
      window.history.replaceState(entry, "");
    }
    const follow = () => {
      const next = entryNow();
      if (next.wmDepth < entry.wmDepth && entry.wmOpened !== null && entry.wmOpened !== windowAt(window.location)) closeQuietly(entry.wmOpened);
      entry = next;
    };
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  const address = currentAddress();
  useEffect(() => {
    const id = windowAt(window.location);
    if (id === null) return;
    remember(id, withoutVariant(address));
    raise(id);
  }, [address]);
}

export function useWindows() {
  const navigate = useNavigate();

  const open = useCallback(
    (id: WindowId, address: string = addressOf(id)) => {
      remember(id, address);
      if (desk.open.includes(id)) {
        raise(id);
        replaceAddress(address);
        return;
      }
      raise(id);
      navigate(address);
      entry = { wmDepth: entry.wmDepth + 1, wmOpened: id };
      window.history.replaceState(entry, "");
    },
    [navigate],
  );

  const focus = useCallback((id: WindowId) => {
    if (frontOf(desk.open) === id) return;
    raise(id);
    replaceAddress(addressOf(id));
  }, []);

  const turnTo = useCallback((id: WindowId, address: string) => {
    remember(id, address);
    if (frontOf(desk.open) === id) replaceAddress(address);
  }, []);

  const close = useCallback((id: WindowId) => {
    if (!desk.open.includes(id)) return;
    if (entry.wmOpened === id && entry.wmDepth > 0 && windowAt(window.location) === id) {
      window.history.back();
      return;
    }
    closeQuietly(id);
    const front = frontOf(desk.open);
    replaceAddress(front === null ? "/" : addressOf(front));
  }, []);

  const toggle = useCallback((id: WindowId, address?: string) => (desk.open.includes(id) && frontOf(desk.open) === id ? close(id) : open(id, address)), [open, close]);

  const closeAll = useCallback(() => {
    change((current) => ({ ...current, open: [] }));
    replaceAddress("/");
  }, []);

  return useMemo(() => ({ open, focus, turnTo, close, toggle, closeAll }), [open, focus, turnTo, close, toggle, closeAll]);
}

export type Windows = ReturnType<typeof useWindows>;
