import { useEffect } from "react";
import { useLocation } from "react-router";

/** How long the page may keep changing before the section counts as in place. */
const SETTLE_MS = 600;
/** How long to wait for a section that never shows up (a stale link, an empty list). */
const GIVE_UP_MS = 10_000;
/** Anything that means the visitor took over scrolling. */
const USER_INPUT = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/**
 * Scrolls to the section the URL's `#fragment` names, e.g. `/store#my-requests` from a Slack DM.
 * The browser only does that for elements present when the page loads, but ours render once
 * their data has loaded. So this waits for the element, scrolls it into view (honouring its
 * `scroll-margin`), and keeps it there while the page fills in around it, until the DOM has been
 * quiet for a moment, the visitor scrolls themselves, or it gives up.
 */
export function useHashScroll() {
  const { hash, key } = useLocation();
  useEffect(() => {
    const id = sectionId(hash);
    if (!id) return;
    return followSection(document, id);
  }, [hash, key]);
}

/** The element id a `#fragment` names; null for none, or one that isn't valid percent-encoding. */
function sectionId(hash: string): string | null {
  try {
    return decodeURIComponent(hash.slice(1)) || null;
  } catch {
    return null;
  }
}

function followSection(doc: Document, id: string): () => void {
  const win = doc.defaultView!;
  let settled: ReturnType<typeof setTimeout> | undefined;
  // Where our last scroll left the page: any other position means someone else scrolled it.
  let placed = win.scrollY;
  const align = () => {
    const target = doc.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    placed = win.scrollY;
    clearTimeout(settled);
    settled = setTimeout(stop, SETTLE_MS);
  };
  // A scrollbar drag sends none of USER_INPUT, only scroll events.
  const scrolled = () => {
    if (Math.abs(win.scrollY - placed) > 1) stop();
  };
  const observer = new MutationObserver(align);
  const giveUp = setTimeout(stop, GIVE_UP_MS);
  function stop() {
    observer.disconnect();
    clearTimeout(settled);
    clearTimeout(giveUp);
    for (const type of USER_INPUT) doc.removeEventListener(type, stop, true);
    win.removeEventListener("scroll", scrolled);
  }
  for (const type of USER_INPUT) doc.addEventListener(type, stop, { capture: true, passive: true });
  win.addEventListener("scroll", scrolled, { passive: true });
  observer.observe(doc.body, { childList: true, subtree: true });
  align();
  return stop;
}
