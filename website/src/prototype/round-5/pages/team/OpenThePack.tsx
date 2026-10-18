// PROTOTYPE (#625, round 6): the team page's pack button, opening the packs the way the top bar does. Never merge to main.
import type { MouseEvent } from "react";
import { openPacks, packsHrefHere } from "../../shell/history";

function openInPlace(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openPacks();
}

export function OpenThePack() {
  return (
    <a href={packsHrefHere()} className="r6t-cta" onClick={openInPlace}>
      Open the pack
    </a>
  );
}
