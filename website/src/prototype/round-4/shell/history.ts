// PROTOTYPE (#625, round 4): opening the packs over the current page, closing them, and landing where the card went, with a sane back button. Never merge to main.
import { keepingTheVariant } from "../../variants";
import { packsHash } from "../address";

const openedHere = "r4-packs-opened-here";

function tellTheApp() {
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function packsHrefHere() {
  return `${window.location.pathname}${packsHash}`;
}

export function openPacks() {
  window.history.pushState({ [openedHere]: true }, "", keepingTheVariant(packsHrefHere()));
  tellTheApp();
}

export function replaceTo(href: string) {
  window.history.replaceState(null, "", keepingTheVariant(href));
  tellTheApp();
}

export function closePacks() {
  const state: unknown = window.history.state;
  if (typeof state === "object" && state !== null && openedHere in state) return window.history.back();
  replaceTo(window.location.pathname);
}
