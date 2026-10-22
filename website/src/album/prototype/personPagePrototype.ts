// PROTOTYPE (throwaway, branch prototype/person-page): layouts of the person page, switched by ?variant=, with ?member=rich|quiet.
import { useSyncExternalStore } from "react";

export const variants = { now: "Today's page", a: "Player card", b: "Next goals", c: "Trophy shelf", d: "Mix: card and feed", e: "Mix: card beside feed" } as const;

export type Variant = keyof typeof variants;

export const variantKeys = Object.keys(variants) as Variant[];

export const mixVariants = ["d", "e"] as const;

export type MixLayout = (typeof mixVariants)[number];

export function isMix(variant: Variant): variant is MixLayout {
  return (mixVariants as readonly Variant[]).includes(variant);
}

export const members = { rich: "Rich member", quiet: "Quiet new member" } as const;

export type PrototypeMember = keyof typeof members;

export const visitedPerson = "wren-alder";

export const pages = { own: { label: "Your page", hash: "#me" }, visit: { label: "Wren's page", hash: `#people/${visitedPerson}` } } as const;

export type PrototypePage = keyof typeof pages;

export const isPrototypeShell = import.meta.env.VITE_SHELL_FIXTURE === "person-page";

const atLoad = new URLSearchParams(window.location.search);

let variant: Variant = variantKeys.find((key) => key === atLoad.get("variant")) ?? "d";

export const prototypeMember: PrototypeMember = atLoad.get("member") === "quiet" ? "quiet" : "rich";

const listeners = new Set<() => void>();

export function useVariant() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => variant,
  );
}

export function setVariant(next: Variant) {
  variant = next;
  writeParams();
  listeners.forEach((notify) => notify());
}

export function setMember(next: PrototypeMember) {
  const address = new URL(window.location.href);
  address.searchParams.set("variant", variant);
  address.searchParams.set("member", next);
  window.location.replace(address.toString());
}

export function usePrototypePage(): PrototypePage {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("hashchange", notify);
      window.addEventListener("popstate", notify);
      return () => {
        window.removeEventListener("hashchange", notify);
        window.removeEventListener("popstate", notify);
      };
    },
    () => (window.location.hash === pages.visit.hash ? "visit" : "own"),
  );
}

export function setPrototypePage(next: PrototypePage) {
  window.location.hash = pages[next].hash;
}

export function writeParams() {
  const address = new URL(window.location.href);
  address.searchParams.set("variant", variant);
  address.searchParams.set("member", prototypeMember);
  const href = address.pathname + address.search + address.hash;
  if (href !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, "", href);
}
