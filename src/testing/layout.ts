/**
 * Layout guards for happy-dom tests, which have no stylesheet: they read the Tailwind classes.
 *
 * An absolutely positioned element (including `sr-only` text) is only clipped by a scroll container
 * that is, or contains, its containing block. Otherwise it sits outside the scroller and widens the
 * page: the phone Leaderboard scrolled sideways because its sr-only "Compare" header's containing
 * block was the Card around the table (`backdrop-blur` establishes one), not the table's scroller.
 */
const SCROLLS_X = /^overflow(-x)?-(auto|scroll)$/;
const ABSOLUTE = /^(absolute|fixed|sr-only)$/;
// Classes that make an element the containing block of its absolutely positioned descendants.
const CONTAINING_BLOCK = /^(relative|absolute|fixed|sticky|-?translate-|-?rotate-|scale-|transform|backdrop-|blur|filter|drop-shadow|will-change-transform|contain-)/;

const has = (el: Element, pattern: RegExp) => [...el.classList].some((c) => pattern.test(c.replace(/^.*:/, "")));

/** Absolutely positioned elements that a horizontal scroller around them fails to contain. */
export function escapesFromScrollers(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => {
    if (!has(el, ABSOLUTE)) return false;
    let scroller: Element | null = null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (has(p, SCROLLS_X)) scroller = scroller ?? p;
      // The first containing block wins: it escapes when a scroller lies between it and the element.
      if (has(p, CONTAINING_BLOCK)) return scroller !== null && scroller !== p;
    }
    return scroller !== null; // contained only by the viewport
  });
}

export const describeElement = (el: Element) => `<${el.tagName.toLowerCase()} class="${el.className}">${el.textContent?.slice(0, 30) ?? ""}`;
