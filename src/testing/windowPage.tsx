import type { ReactNode } from "react";
import { escapesFromScrollers, parchmentTextOnDusk, widensSideways, describeElement } from "./layout";

/**
 * Guards for a page that lives in a place's window (#126, #128), for happy-dom tests (class names
 * only, no layout):
 *
 * - it lays out by the window's width (`@sm:`, `@lg:` container variants), never the viewport's
 *   (`sm:`, `lg:`): a 640 px window on a 1280 px screen is not a desktop page;
 * - nothing escapes a scroller or widens it sideways (the phone guards), and parchment text never
 *   lands on a dark board;
 * - it has no page sign of its own (the window's title bar names the place);
 * - its copy has no middle-dot joins, arrows or emoji (#126 "Words are signposts"). Elements marked
 *   `data-user-text` (Slack messages, admin-written names) are left out: that's people's own words.
 */
const VIEWPORT_VARIANT = /(^|:)(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl|min-\[[^\]]+\]|max-\[[^\]]+\]):/;

/** Elements laid out by the viewport's width instead of the window's. */
export function viewportLayout(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => [...el.classList].some((c) => VIEWPORT_VARIANT.test(c)));
}

// #126 "Words are signposts": no middle-dot joins, no arrows on links, no emoji in UI copy.
const TELLS = /[·•→←↑↓↗↘⟶›»]|\p{Extended_Pictographic}/u;

/**
 * Text nodes with a middle dot, an arrow or an emoji, one by one. `allow` lists strings that are
 * data, not copy (the workspace's kudos emoji), removed before the check.
 */
export function copyTells(root: Node, allow: string[] = []): string[] {
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const found: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let text = n.textContent ?? "";
    for (const a of allow) text = text.split(a).join("");
    if (TELLS.test(text)) found.push(n.textContent!.trim());
  }
  return found;
}

export function windowPageProblems(root: HTMLElement): string[] {
  const problems: string[] = [];
  for (const el of viewportLayout(root)) {
    const bad = [...el.classList].filter((c) => VIEWPORT_VARIANT.test(c));
    problems.push(`viewport breakpoint ${bad.join(" ")} on ${describeElement(el)}`);
  }
  for (const el of escapesFromScrollers(root)) problems.push(`escapes its scroller: ${describeElement(el)}`);
  for (const el of widensSideways(root)) problems.push(`widens sideways: ${describeElement(el)}`);
  for (const el of parchmentTextOnDusk(root)) problems.push(`parchment text on a dark face: ${describeElement(el)}`);
  if (root.querySelector(".pixel-sign, h1")) problems.push("a page sign of its own: the window's title bar names the place");
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[data-user-text]").forEach((el) => el.remove());
  const text = copy.textContent ?? "";
  for (const [what, re] of [
    ["a middle dot", /[·•]/],
    ["an arrow", /[←→↑↓↗↘]/],
    ["an emoji", /\p{Extended_Pictographic}/u],
  ] as const) {
    const m = re.exec(text);
    if (m) problems.push(`${what} in the copy: …${text.slice(Math.max(0, m.index - 30), m.index + 10)}…`);
  }
  return problems;
}

/** The window's parchment face round a page, as `Window.tsx` draws it: a pixel frame and a size container. */
export function InWindow({ children }: { children: ReactNode }) {
  return (
    <div className="pixel-frame">
      <div data-window-body className="@container relative overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
