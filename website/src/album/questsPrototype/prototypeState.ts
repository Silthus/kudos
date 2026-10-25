// PROTOTYPE (Silthus/personal#172): the variant and phase live in the URL (?variant=A&phase=weekly). Never merge.
import { useSyncExternalStore } from "react";
import type { QuestPhase } from "./questsFixture";

export const prototypeOn = import.meta.env.VITE_PROTOTYPE === "1";

export const variantKeys = ["A", "B", "C"] as const;

export type VariantKey = (typeof variantKeys)[number];

export const prototypeParams = ["variant", "phase"];

type PrototypeState = { variant: VariantKey; phase: QuestPhase };

const listeners = new Set<() => void>();

let state = readState();

function readState(): PrototypeState {
  const params = new URLSearchParams(window.location.search);
  const variant = variantKeys.find((key) => key === params.get("variant")) ?? "A";
  return { variant, phase: params.get("phase") === "onboarding" ? "onboarding" : "weekly" };
}

export function setPrototypeState(change: Partial<PrototypeState>) {
  state = { ...state, ...change };
  const address = new URL(window.location.href);
  address.searchParams.set("variant", state.variant);
  address.searchParams.set("phase", state.phase);
  window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
  listeners.forEach((listener) => listener());
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
  const current = new URLSearchParams(window.location.search);
  const address = new URL(href, window.location.origin);
  for (const param of prototypeParams) {
    const value = current.get(param);
    if (value !== null) address.searchParams.set(param, value);
  }
  return address.pathname + address.search + address.hash;
}
