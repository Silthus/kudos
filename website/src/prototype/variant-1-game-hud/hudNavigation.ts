// PROTOTYPE (#625): HUD navigation: pushes real URLs, marks windows the HUD opened so closing them goes back. Never merge to main.
import { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "../../AppLink";
import { keepingTheVariant } from "../variants";

const openedByTheHud = { v1OpenedByTheHud: true };

function wasOpenedByTheHud() {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && "v1OpenedByTheHud" in state;
}

export function replaceAddress(href: string) {
  window.history.replaceState(window.history.state, "", keepingTheVariant(href));
}

export function useHudNavigation() {
  const navigate = useNavigate();
  const go = useCallback((href: string) => navigate(href), [navigate]);
  const openWindow = useCallback(
    (href: string) => {
      navigate(href);
      window.history.replaceState(openedByTheHud, "");
    },
    [navigate],
  );
  const closeWindow = useCallback(() => {
    if (wasOpenedByTheHud()) window.history.back();
    else navigate("/");
  }, [navigate]);
  return { go, openWindow, closeWindow };
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
