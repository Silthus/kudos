/**
 * Layout guards for happy-dom tests, which have no stylesheet: they read the Tailwind class names
 * (plus the app's own `grain` utility), so they only know what those classes mean.
 *
 * An absolutely positioned element (including `sr-only` text) is only clipped by a scroll container
 * that is, or contains, its containing block. Otherwise it sits outside the scroller and widens the
 * page: the phone Leaderboard scrolled sideways because its sr-only "Compare" header's containing
 * block was the Card around the table (`backdrop-blur` establishes one), not the table's scroller.
 */
// Any overflow but `visible` clips on both axes: `overflow-y-auto` computes `overflow-x: auto` too.
const CLIPS = /^overflow(-[xy])?-(auto|scroll|hidden|clip)$/;
// Out of flow at some width: the safe direction is to strip variants (`sm:sr-only` still counts).
const OUT_OF_FLOW = /^(absolute|fixed|sr-only)$/;
// Contain `fixed` descendants, and so `absolute` ones as well.
const CONTAINS_FIXED = /^(-?translate-|-?rotate-|-?scale-|-?skew-|transform|backdrop-|blur|filter|drop-shadow|will-change-transform|contain-(layout|paint|strict|content))/;
const CONTAINS_ABSOLUTE = new RegExp(`${CONTAINS_FIXED.source}|^(relative|absolute|fixed|sticky|grain)$`);

// For the containing block only unprefixed classes count: `md:relative` or `active:scale-95`
// don't hold on a phone at rest. Utilities set to none create nothing.
const always = (el: Element) => [...el.classList].filter((c) => !c.includes(":") && !c.endsWith("-none"));
const outOfFlow = (el: Element) => [...el.classList].some((c) => !c.startsWith("[") && OUT_OF_FLOW.test(c.replace(/^.*:/, "")));
const isFixed = (el: Element) => el.classList.contains("fixed");

/** Absolutely positioned elements that a clipping scroller around them fails to contain. */
export function escapesFromScrollers(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => {
    if (!outOfFlow(el)) return false;
    const containsIt = isFixed(el) ? CONTAINS_FIXED : CONTAINS_ABSOLUTE;
    let scroller: Element | null = null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      // A scroller at any breakpoint counts (the safe direction again).
      if (scroller === null && [...p.classList].some((c) => CLIPS.test(c.replace(/^.*:/, "")))) scroller = p;
      // The first containing block wins: it escapes when a scroller lies between it and the element.
      if (always(p).some((c) => containsIt.test(c))) return scroller !== null && scroller !== p;
    }
    return scroller !== null; // contained only by the viewport
  });
}

const clips = (el: Element) => [...el.classList].some((c) => CLIPS.test(c.replace(/^.*:/, "")));
const PREFORMATTED = (el: Element) => el.tagName === "PRE" || el.classList.contains("whitespace-pre");
// A row at some width (safe direction): `flex flex-col md:flex-row` counts.
const flexRow = (el: Element) => {
  const cls = [...el.classList];
  const column = cls.includes("flex-col") || cls.includes("flex-col-reverse");
  return (cls.includes("flex") || cls.includes("inline-flex")) && (!column || cls.some((c) => /:flex-row(-reverse)?$/.test(c)));
};
// Grid and flex items don't shrink below their content's width unless they're `min-w-0` or clip.
const growsToContent = (el: Element) => {
  const parent = el.parentElement;
  const isItem = !!parent && (parent.classList.contains("grid") || parent.classList.contains("inline-grid") || flexRow(parent));
  return isItem && !el.classList.contains("min-w-0") && !clips(el);
};

/**
 * Elements that make a phone page scroll sideways: long unbreakable lines that no scroller clips,
 * or whose scroller sits in a grid or flex item that grows to fit the line anyway.
 * The setup page's env commands ran ~130 px past a 375 px screen in a plain `<pre>`.
 */
export function widensSideways(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => {
    if (!PREFORMATTED(el)) return false;
    let p: Element | null = el;
    while (p && p !== root && !clips(p)) p = p.parentElement;
    if (!p || p === root) return true; // nothing clips the line
    for (; p && p !== root; p = p.parentElement) if (growsToContent(p)) return true;
    return false;
  });
}

export const describeElement = (el: Element) => `<${el.tagName.toLowerCase()} class="${el.className}">${el.textContent?.slice(0, 30) ?? ""}`;
