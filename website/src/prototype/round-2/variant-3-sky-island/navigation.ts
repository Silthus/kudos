// PROTOTYPE (#625): Sky island navigation: real URLs pushed for drawers and modals, flips replaced in place, closing goes back. Never merge to main.
import { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "../../../AppLink";
import { keepingTheVariant } from "../../variants";

const openedHere = { skyOpenedHere: true };

function wasOpenedHere() {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && "skyOpenedHere" in state;
}

export function replaceAddress(href: string) {
  window.history.replaceState(window.history.state, "", keepingTheVariant(href));
}

export function useSkyNavigation() {
  const navigate = useNavigate();
  const open = useCallback(
    (href: string) => {
      navigate(href);
      window.history.replaceState(openedHere, "");
    },
    [navigate],
  );
  const close = useCallback(
    (fallback: string) => {
      if (wasOpenedHere()) window.history.back();
      else navigate(fallback);
    },
    [navigate],
  );
  return { open, close, navigate };
}

export function useAddressChanges() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    window.addEventListener("hashchange", rerender);
    return () => window.removeEventListener("hashchange", rerender);
  }, []);
  return rerender;
}

export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
