// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SpreePost, type Spree } from "./SpreePost";

/** The playground's kudos spree (#94): the bot's reaction is the way in, like in Slack. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const waiting: Spree = {
  attemptId: "a1",
  author: "Freya Lindqvist",
  text: "@Priya 🌮 thank you for staying late to walk the customer through the migration",
  at: Date.parse("2026-09-23T09:00:00Z"),
  joiners: 4,
  tier: 0,
  next: 5,
  status: "open",
  joined: false,
  prompt: "Join Freya Lindqvist's kudos for Priya Raman? Uses 1 kudos today + 1 of your 5 spree joins this month · 4/5 joined",
};

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(spree: Spree, onJoin = vi.fn(async () => {})) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<SpreePost spree={spree} glyph="🌮" onJoin={onJoin} />));
  return { host, onJoin };
}

const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === name || b.getAttribute("aria-label")?.startsWith(name));

test("the bot's reaction shows how many joined; clicking it offers Join / Not now, only to you", () => {
  const { host } = render(waiting);
  const reaction = button(host, "Kudos bot reacted")!;
  expect(reaction.textContent).toContain("5"); // the bot and 4 teammates
  expect(host.textContent).toContain("Spree 4/5");
  expect(host.textContent).not.toContain("Join Freya");
  act(() => reaction.click());
  expect(host.textContent).toContain("Only visible to you");
  expect(host.textContent).toContain(waiting.prompt);
  act(() => button(host, "Not now")!.click());
  expect(host.textContent).not.toContain(waiting.prompt);
});

test("Join sends the join and closes the prompt", async () => {
  const { host, onJoin } = render(waiting);
  act(() => button(host, "Kudos bot reacted")!.click());
  await act(async () => button(host, "Join")!.click());
  expect(onJoin).toHaveBeenCalledWith("a1");
  expect(host.textContent).not.toContain(waiting.prompt);
});

test("review: without spree joins left, clicking says why instead of offering Join", () => {
  const { host } = render({ ...waiting, prompt: null, note: "You've used all 5 of your spree joins this month. They come back on the 1st." });
  act(() => button(host, "Kudos bot reacted")!.click());
  expect(host.textContent).toContain("You've used all 5 of your spree joins this month.");
  expect(button(host, "Join")).toBeUndefined();
});

test("once you joined, or the spree is over, there is nothing to join", () => {
  const { host } = render({ ...waiting, joined: true, joiners: 5, tier: 1, next: 10, prompt: null });
  expect(host.textContent).toContain("Spree of 5 · 5/10 for the next tier");
  act(() => button(host, "Kudos bot reacted")!.click());
  expect(button(host, "Join")).toBeUndefined();
});

describe("the answer to a click on the reaction comes into view (#148)", () => {
  // The channel scrolls: an offer that opens below its fold had Join hidden under the example chips.
  const scrolled = vi.fn();
  const original = Element.prototype.scrollIntoView;
  beforeEach(() => {
    scrolled.mockReset();
    Element.prototype.scrollIntoView = function (this: Element, how?: boolean | ScrollIntoViewOptions) {
      scrolled(this, how);
    };
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  test("the offer, Join and all", () => {
    const { host } = render(waiting);
    act(() => button(host, "Kudos bot reacted")!.click());
    expect(scrolled).toHaveBeenCalledTimes(1);
    const [offer, how] = scrolled.mock.calls[0];
    expect((offer as Element).contains(button(host, "Join")!)).toBe(true);
    expect(how).toMatchObject({ block: "nearest" });
  });

  test("the note saying no spree joins are left", () => {
    const { host } = render({ ...waiting, prompt: null, note: "You've used all 5 of your spree joins this month." });
    act(() => button(host, "Kudos bot reacted")!.click());
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect((scrolled.mock.calls[0][0] as Element).textContent).toContain("You've used all 5");
  });
});
