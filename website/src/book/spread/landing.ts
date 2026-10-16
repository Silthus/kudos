import type { Rarity } from "../../crates/drops";
import { spreadHrefOf } from "./spreads";

export type HoggieTileLanding = { tile: HTMLElement; coin: HTMLElement | null };

type Waiting = { within?: number };

export async function landOnHoggieTile({ hoggie, rarity }: { hoggie: string; rarity: Rarity }, { within = 1500 }: Waiting = {}): Promise<HoggieTileLanding | null> {
  flipTheBookTo(spreadHrefOf({ kind: "hoggies", rarity }));
  const tile = await elementOnce(`[data-hoggie="${hoggie}"]`, within);
  if (tile === null) return null;
  tile.scrollIntoView({ block: "center", behavior: "instant" });
  return { tile, coin: tile.querySelector<HTMLElement>("[data-coin]") };
}

export function markLanded(tile: HTMLElement, forMs = 1600) {
  tile.setAttribute("data-landed", "");
  setTimeout(() => tile.removeAttribute("data-landed"), forMs);
}

function flipTheBookTo(href: string) {
  if (window.location.pathname + window.location.search + window.location.hash === href) return;
  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function elementOnce(selector: string, within: number) {
  const now = document.querySelector<HTMLElement>(selector);
  if (now !== null) return Promise.resolve(now);
  return new Promise<HTMLElement | null>((resolve) => {
    let settle = (found: HTMLElement | null) => resolve(found);
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found !== null) settle(found);
    });
    const timer = setTimeout(() => settle(null), within);
    settle = (found) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    };
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
