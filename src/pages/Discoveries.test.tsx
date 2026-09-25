// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { InWindow, windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The gallery (#131): the message collection hung on a wall, one framed card per message. */

const hidden = (key: string, category: string, categoryLabel: string, rarity = "common", foundBy = 0) => ({
  key,
  category,
  categoryLabel,
  rarity,
  discovered: false,
  text: null,
  length: 60,
  timesSeen: 0,
  lastSeenAt: null,
  foundBy,
});
const found = (key: string, text: string, rarity: string, foundBy: number) => ({
  ...hidden(key, "giver_success", "Giver success", rarity, foundBy),
  discovered: true,
  text,
  timesSeen: 3,
  lastSeenAt: Date.now() - 2 * 86_400_000,
});

let gallery: Record<string, unknown>;
const baseGallery = () => ({
  total: 2,
  discovered: 0,
  collectors: 3,
  byRarity: [{ rarity: "common", total: 2, discovered: 0 }],
  categories: [
    { id: "giver_success", label: "Giver success", total: 1, discovered: 0 },
    { id: "quest_complete", label: "Quest complete", total: 1, discovered: 0 },
  ],
  items: [hidden("giver.1", "giver_success", "Giver success"), hidden("quest.1", "quest_complete", "Quest complete")],
});
const fullGallery = () => ({
  total: 4,
  discovered: 2,
  collectors: 9,
  byRarity: [
    { rarity: "common", total: 2, discovered: 1 },
    { rarity: "epic", total: 2, discovered: 1 },
  ],
  categories: [
    { id: "giver_success", label: "Giver success", total: 3, discovered: 2 },
    { id: "quest_complete", label: "Quest complete", total: 1, discovered: 0 },
  ],
  items: [
    found("giver.1", "Thanks for the review", "common", 12),
    found("giver.2", "A rare find", "epic", 1),
    hidden("giver.3", "giver_success", "Giver success", "epic", 4),
    hidden("quest.1", "quest_complete", "Quest complete"),
  ],
});

vi.mock("convex/react", () => ({ useQuery: () => gallery }));

const { Discoveries } = await import("./Discoveries");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let root: Root | undefined;
beforeEach(() => {
  gallery = baseGallery();
  localStorage.clear();
});
afterEach(() => act(() => root?.unmount()));

let host: HTMLElement;
function render(questsEnabled = true, { memberId = "m1", url = "/discoveries", fresh = true } = {}) {
  if (fresh) {
    act(() => root?.unmount());
    host = document.createElement("div");
    root = createRoot(host);
  }
  const viewer = { member: { _id: memberId }, workspace: { name: "Lumen Labs", emojiGlyph: "🌮", questsEnabled } } as unknown as ReadyViewer;
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[url]}>
        <ViewerContext.Provider value={viewer}>
          <InWindow>
            <Discoveries />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const frames = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>("[data-frame]")];
const click = (el: Element) => act(() => (el as HTMLElement).click());

test("undiscovered Quest messages say how to find them while quests are on", () => {
  const text = render(true).textContent!;
  expect(text).toContain("Complete weekly quests to find these");
  expect(text).toContain("complete weekly quests, to find them all");
});

test("with quests switched off, the gallery doesn't send anyone after them", () => {
  const text = render(false).textContent!;
  expect(text).not.toContain("Complete weekly quests to find these");
  expect(text).not.toContain("and complete weekly quests");
  expect(text).toContain("Weekly quests are off in this workspace");
  expect(text).toContain("Give and receive kudos to find them all.");
});

test("each found message hangs in a frame of its rarity's colour with who else found it; a hidden one is an empty frame", () => {
  gallery = fullGallery();
  const host = render();
  const byKey = (key: string) => frames(host).find((f) => f.dataset.frame === key)!;
  const review = byKey("giver.1");
  expect(review.dataset.rarity).toBe("common");
  expect(review.style.boxShadow).toContain("var(--color-r-common)");
  expect(review.textContent).toContain("Thanks for the review");
  expect(review.textContent).toContain("Found by 12 teammates");
  expect(review.textContent).toContain("Seen 3 times, last 2d ago");
  expect(byKey("giver.2").textContent).toContain("Found by 1 teammate");
  const empty = byKey("giver.3");
  expect(empty.hasAttribute("aria-label")).toBe(false); // it would hide the hint from some screen readers
  expect(empty.querySelector(".sr-only")?.textContent).toBe("Undiscovered epic message.");
  expect(empty.style.boxShadow).toContain("var(--color-r-epic)");
  expect(empty.textContent).toContain("Epic");
  expect(empty.textContent).toContain("Found by 4 teammates");
  expect(byKey("quest.1").textContent).toContain("Nobody has found this yet");
});

test("the rarity legend is a row of framed swatches with counts; picking one shows only that rarity", () => {
  gallery = fullGallery();
  const host = render();
  const legend = [...host.querySelectorAll<HTMLButtonElement>("[data-legend] button")];
  expect(legend.map((b) => b.textContent)).toEqual(["Common1 of 2", "Epic1 of 2"]);
  click(legend[1]);
  expect(legend[1].getAttribute("aria-pressed")).toBe("true");
  expect(frames(host).map((f) => f.dataset.rarity)).toEqual(["epic", "epic"]);
  click(legend[1]);
  expect(frames(host)).toHaveLength(4);
});

test("the moment tabs and the found tabs filter the wall, and one button clears the filters", () => {
  gallery = fullGallery();
  const host = render();
  const tab = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === name || t.textContent?.startsWith(`${name} `))!;
  expect([...host.querySelectorAll("[role=tablist]")].map((t) => t.getAttribute("aria-label"))).toEqual(["Moment", "Found or hidden"]);
  // Each moment says how much of it you've found.
  expect(tab("Giver success").textContent).toBe("Giver success 2 of 3");
  click(tab("Quest complete"));
  expect(frames(host).map((f) => f.dataset.frame)).toEqual(["quest.1"]);
  click(tab("All moments"));
  click(tab("Found"));
  expect(frames(host).map((f) => f.dataset.frame).sort()).toEqual(["giver.1", "giver.2"]);
  click(tab("Still hidden"));
  expect(frames(host)).toHaveLength(2);
  expect(host.textContent).toContain("2 messages");
});

test("a message found since your last visit wears a one-time New tag", () => {
  gallery = fullGallery();
  // First visit: nothing is new, the wall is just as it is.
  expect(render().querySelectorAll("[data-new]")).toHaveLength(0);
  // Something new turns up.
  gallery = fullGallery();
  (gallery.items as { key: string; discovered: boolean; text: string | null }[])[2] = { ...found("giver.3", "Fresh off the press", "epic", 5), key: "giver.3" };
  const host = render();
  expect([...host.querySelectorAll("[data-new]")].map((el) => el.closest<HTMLElement>("[data-frame]")!.dataset.frame)).toEqual(["giver.3"]);
  expect(host.querySelector("[data-new]")!.textContent).toBe("New");
  // The next visit, it's part of the collection.
  expect(render().querySelectorAll("[data-new]")).toHaveLength(0);
});

test("a message found while the gallery is open gets the tag too, and another member's visits don't count for you", () => {
  gallery = fullGallery();
  render();
  gallery = fullGallery();
  (gallery.items as unknown[])[2] = found("giver.3", "Fresh off the press", "epic", 5);
  render(true, { fresh: false });
  expect([...host.querySelectorAll("[data-new]")].map((el) => el.closest<HTMLElement>("[data-frame]")!.dataset.frame)).toEqual(["giver.3"]);
  // Someone else signs in on this browser: their first visit, so nothing is new for them.
  render(true, { fresh: false, memberId: "m2" });
  expect(host.querySelectorAll("[data-new]")).toHaveLength(0);
});

test("without a working local storage the gallery still shows, just without New tags", () => {
  gallery = fullGallery();
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  try {
    const shown = render();
    expect(frames(shown)).toHaveLength(4);
    expect(shown.querySelectorAll("[data-new]")).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }
});

test("a link to one moment (from a quest) opens the wall on it", () => {
  gallery = fullGallery();
  const shown = render(true, { url: "/discoveries?category=quest_complete" });
  expect(frames(shown).map((f) => f.dataset.frame)).toEqual(["quest.1"]);
  expect(shown.querySelector("[role=tab][aria-selected=true]")?.textContent).toBe("Quest complete 0 of 1");
});
