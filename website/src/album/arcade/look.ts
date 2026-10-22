// PROTOTYPE: the arcade look's switch. The fixture build reads ?variant= once at load, because the album's
// router drops unknown params, and keeps it on every address the app writes after that.
import { useSyncExternalStore } from "react";

export const looks = { today: "Today", arcade: "Full arcade", accents: "Arcade accents" } as const;

export type Look = keyof typeof looks;

export const lookKeys = Object.keys(looks) as Look[];

const keptParams = ["variant", "arrive"] as const;

type KeptParam = (typeof keptParams)[number];

const askedAtLoad = new URLSearchParams(window.location.search);

const kept = new Map<KeptParam, string>(keptParams.flatMap((name) => (askedAtLoad.has(name) ? [[name, askedAtLoad.get(name)!] as const] : [])));

const listeners = new Set<() => void>();

function isALook(asked: string | undefined): asked is Look {
  return asked !== undefined && asked in looks;
}

function lookNow(): Look {
  const asked = kept.get("variant");
  return isALook(asked) ? asked : "today";
}

function withKeptParams(url: string | URL | null | undefined) {
  if (url === null || url === undefined) return url;
  const address = new URL(url, window.location.href);
  for (const name of keptParams) address.searchParams.delete(name);
  for (const name of keptParams) if (kept.has(name)) address.searchParams.set(name, kept.get(name)!);
  return address.pathname + address.search + address.hash;
}

function keepingParamsOn(write: "pushState" | "replaceState") {
  const original = window.history[write].bind(window.history);
  window.history[write] = (state, unused, url) => original(state, unused, withKeptParams(url));
}

function paintLook() {
  const look = lookNow();
  if (look === "today") delete document.documentElement.dataset.look;
  else document.documentElement.dataset.look = look;
}

export function startLookSwitch() {
  keepingParamsOn("pushState");
  keepingParamsOn("replaceState");
  paintLook();
  window.history.replaceState(window.history.state, "", window.location.href);
}

export function setLook(look: Look) {
  if (look === "today") kept.delete("variant");
  else kept.set("variant", look);
  paintLook();
  window.history.replaceState(window.history.state, "", window.location.href);
  listeners.forEach((listener) => listener());
}

export function arrives() {
  return kept.get("arrive") === "1";
}

export function playTheArrival(on: boolean) {
  if (on) kept.set("arrive", "1");
  else kept.delete("arrive");
  window.history.replaceState(window.history.state, "", window.location.href);
  window.location.reload();
}

export function useLook() {
  return useSyncExternalStore(
    (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    lookNow,
  );
}
