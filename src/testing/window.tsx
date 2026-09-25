import type { ReactNode } from "react";

/**
 * Guards for pages that live in a place's window (#126), for happy-dom tests. Like
 * `layout.ts`, they read class names and text, since happy-dom has no layout.
 */

/**
 * The window's face as `Window.tsx` draws it: a pixel frame round a size container. A page
 * rendered in it sits on parchment, as in the app.
 */
export function InWindow({ children }: { children: ReactNode }) {
  return (
    <div className="pixel-frame">
      <div data-window-body className="@container">
        {children}
      </div>
    </div>
  );
}

// Viewport breakpoints. Inside a window only its own width counts (`@sm:`, `@lg:`): the window
// is 420–720 px on a 1280 px screen, where `xl:grid-cols-4` squeezed four panels into it.
const VIEWPORT_VARIANT = /^(sm|md|lg|xl|2xl|max-(sm|md|lg|xl|2xl)):/;

/** Elements laid out by the viewport's width instead of the window's. */
export function viewportLayout(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => [...el.classList].some((c) => VIEWPORT_VARIANT.test(c)));
}

// #126 "Words are signposts": no middle-dot joins, no arrows on links, no emoji in UI copy.
const TELLS = /[·•→←↗↘⟶]|\p{Extended_Pictographic}/u;

/**
 * Text nodes with a middle dot, an arrow or an emoji. `allow` lists strings that are data, not
 * copy (the workspace's kudos emoji, a Slack message's own text), removed before the check.
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
