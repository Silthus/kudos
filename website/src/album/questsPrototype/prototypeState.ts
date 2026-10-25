// PROTOTYPE (Silthus/personal#172): the round-2 variant (?gs=merge|replace|coexist), phase and panel fold. Never merge.
import { useSyncExternalStore } from "react";
import type { QuestPhase, StartedMode } from "./questsFixture";

export const prototypeOn = import.meta.env.VITE_PROTOTYPE === "1";

export const modeKeys = ["merge", "replace", "coexist"] as const satisfies readonly StartedMode[];

const foldKey = "prototype-quests:panel";

type PrototypeState = { mode: StartedMode; phase: QuestPhase; folded: boolean };

const listeners = new Set<() => void>();

let state = readState();

function readState(): PrototypeState {
  const params = new URLSearchParams(window.location.search);
  const mode = modeKeys.find((key) => key === params.get("gs")) ?? "merge";
  return { mode, phase: params.get("phase") === "weekly" ? "weekly" : "onboarding", folded: window.localStorage.getItem(foldKey) === "folded" };
}

export function setPrototypeState(change: Partial<PrototypeState>) {
  state = { ...state, ...change };
  if (change.folded !== undefined) window.localStorage.setItem(foldKey, change.folded ? "folded" : "open");
  const address = new URL(window.location.href);
  address.searchParams.set("gs", state.mode);
  address.searchParams.set("phase", state.phase);
  window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
  listeners.forEach((listener) => listener());
}

export function forgetTheFold() {
  window.localStorage.removeItem(foldKey);
  setPrototypeState({ folded: false });
}

export function usePrototypeState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function keepingPrototypeParams(href: string) {
  if (!prototypeOn) return href;
  const address = new URL(href, window.location.origin);
  address.searchParams.set("gs", state.mode);
  address.searchParams.set("phase", state.phase);
  return address.pathname + address.search + address.hash;
}
