// PROTOTYPE (#625, round 5): the hoggie shown up close lives in the URL as #hoggies/<slug>, so it links, and the back button closes it. Never merge to main.
import { useCallback } from "react";
import type { Hoggie } from "../../../round-3/album";
import { useHash } from "../../address";

const openedHere = "r5hHoggieOpened";

function chosenIn(hash: string) {
  const [section, ...rest] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  return section === "hoggies" && rest.length > 0 ? rest.join("/") : null;
}

function addressWith(hash: string) {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function announceTheHash() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openedOnThisPage() {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && openedHere in state;
}

function nothingChosen() {
  return chosenIn(window.location.hash) === null;
}

export function useChosenHoggie(hoggies: Hoggie[]) {
  const chosenSlug = chosenIn(useHash());
  const chosen = hoggies.find(({ hoggie }) => hoggie === chosenSlug) ?? null;
  const choose = useCallback((hoggie: Hoggie) => {
    const address = addressWith(`#hoggies/${encodeURIComponent(hoggie.hoggie)}`);
    if (nothingChosen()) window.history.pushState({ [openedHere]: true }, "", address);
    else window.history.replaceState(window.history.state, "", address);
    announceTheHash();
  }, []);
  const close = useCallback(() => {
    if (nothingChosen()) return;
    if (openedOnThisPage()) return window.history.back();
    window.history.replaceState(null, "", addressWith("#hoggies"));
    announceTheHash();
  }, []);
  return { chosen, choose, close };
}
