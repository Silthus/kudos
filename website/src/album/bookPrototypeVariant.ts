// PROTOTYPE (throwaway, branch prototype/book-explains-itself, never merged). Silthus/personal#220.
import { useSyncExternalStore } from "react";

export const isPrototypeBuild = import.meta.env.VITE_PROTOTYPE === "1";

export type BookVariant = "A" | "B" | "C";

export const bookVariants: { key: BookVariant; label: string }[] = [
  { key: "A", label: "(Strip + swirl-up card) · low use: Milestones link · known pain: locked stickers" },
  { key: "B", label: "(Up-next list + inline checklist) · low use: Milestones link, Show more · known pain: locked stickers" },
  { key: "C", label: "(Road + flip cards) · low use: Milestones link, Show more · known pain: locked stickers" },
];

const listeners = new Set<() => void>();

let current: BookVariant = variantFromAddress();

function variantFromAddress(): BookVariant {
  const asked = new URLSearchParams(window.location.search).get("variant");
  return bookVariants.find(({ key }) => key === asked)?.key ?? "A";
}

export function chooseBookVariant(next: BookVariant) {
  current = next;
  const address = new URL(window.location.href);
  address.searchParams.set("variant", next);
  window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBookVariant(): BookVariant | null {
  const variant = useSyncExternalStore(subscribe, () => current);
  return isPrototypeBuild ? variant : null;
}
