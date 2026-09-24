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

// `widensSideways` asks what holds on a phone, so here only unprefixed classes rescue a line…
const has = (el: Element, re: RegExp) => always(el).some((c) => re.test(c));
// …while any variant makes a grid or flex container (the safe direction again: `hidden md:flex`).
const hasAt = (el: Element, re: RegExp) => [...el.classList].some((c) => re.test(c.replace(/^.*:/, "")));
const SCROLLS = /^overflow(-[xy])?-(auto|scroll)$/;
const PREFORMATTED = (el: Element) =>
  el.classList.contains("whitespace-pre") || (el.tagName === "PRE" && !has(el, /^whitespace-(pre-wrap|pre-line|normal|break-spaces)$/));
const SIZED_TO_CONTENT = /^(inline-block|inline-flex|inline-grid|inline-table|w-max|w-fit|w-min|table)$/;
const LOOSE_ALIGNMENT = /^(items|self|justify-items|justify-self|place-items|place-self)-(center|start|end|baseline|flex-start|flex-end)$/;

// Does this element grow to fit its widest line instead of the space it's given?
const growsToContent = (el: Element) => {
  if (el.tagName === "TD" || el.tagName === "TH" || has(el, SIZED_TO_CONTENT)) return true;
  const parent = el.parentElement;
  if (!parent) return false;
  const shrinks = has(el, /^min-w-0$/) || has(el, CLIPS);
  // Centred or start-aligned items are fit-content: `min-w-0` doesn't help, only a full width does.
  const loose = hasAt(parent, LOOSE_ALIGNMENT) || hasAt(el, LOOSE_ALIGNMENT);
  if (hasAt(parent, /^(inline-)?grid$/)) {
    if (loose) return !has(el, /^w-full$/);
    // Tailwind's grid-cols-N is repeat(N, minmax(0, 1fr)): those tracks never grow to fit.
    const cols = [...parent.classList].filter((c) => /^grid-cols-/.test(c.replace(/^.*:/, "")));
    const equal = cols.some((c) => /^grid-cols-\d+$/.test(c)) && cols.every((c) => /(^|:)grid-cols-\d+$/.test(c));
    return !equal && !shrinks;
  }
  if (hasAt(parent, /^(inline-)?flex$/)) {
    const column = has(parent, /^flex-col(-reverse)?$/) && !hasAt(parent, /^flex-row(-reverse)?$/);
    return column ? loose && !has(el, /^w-full$/) : !shrinks;
  }
  return false;
};

/**
 * Elements that make a phone page scroll sideways: long unbreakable lines that no scroller holds,
 * or whose scroller sits in something that grows to fit the line anyway (a grid or flex item
 * without `min-w-0`, a centred item, a table cell, `w-max`…). Clipping an ancestor doesn't count:
 * the line is cut off out of reach. Not covered: `whitespace-nowrap` text, `style` attributes.
 * The setup page's env commands ran ~130 px past a 375 px screen in a plain `<pre>`.
 */
export function widensSideways(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => {
    if (!PREFORMATTED(el)) return false;
    let p: Element | null = el;
    while (p && p !== root && !has(p, p === el ? CLIPS : SCROLLS)) p = p.parentElement;
    if (!p || p === root) return true; // nothing holds the line
    for (; p && p !== root; p = p.parentElement) if (growsToContent(p)) return true;
    return false;
  });
}

export const describeElement = (el: Element) => `<${el.tagName.toLowerCase()} class="${el.className}">${el.textContent?.slice(0, 30) ?? ""}`;
