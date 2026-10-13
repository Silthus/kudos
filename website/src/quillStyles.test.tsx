import { describe, expect, test } from "vitest";
import indexHtml from "../index.html?raw";
import shippedScrollShadows from "../public/quill-scroll-area-shadows.css?raw";

function pageHead() {
  return new DOMParser().parseFromString(indexHtml, "text/html").head;
}

describe("WS25: Quill's scroll shadows load as the site's own stylesheet, never an inline style", () => {
  test("the page links them under Quill's id before Quill loads, so Quill injects no style element", async () => {
    document.head.replaceChildren(...pageHead().childNodes);

    const { SCROLL_SHADOWS_STYLE_ID } = await import("@posthog/quill");

    const linked = document.getElementById(SCROLL_SHADOWS_STYLE_ID);
    expect(linked).toBeInstanceOf(HTMLLinkElement);
    expect(linked).toHaveAttribute("rel", "stylesheet");
    expect(linked).toHaveAttribute("href", "/quill-scroll-area-shadows.css");
    expect(document.querySelectorAll("style")).toHaveLength(0);
  });

  test("the shipped stylesheet is Quill's scroll shadows, unchanged", async () => {
    const { scrollShadowsCss } = await import("@posthog/quill");

    expect(shippedScrollShadows).toBe(scrollShadowsCss);
  });
});
