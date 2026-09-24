// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

const hidden = (key: string, category: string, categoryLabel: string) => ({
  key,
  category,
  categoryLabel,
  rarity: "common",
  discovered: false,
  text: null,
  length: 60,
  timesSeen: 0,
  lastSeenAt: null,
  foundBy: 0,
});
const gallery = {
  total: 2,
  discovered: 0,
  collectors: 3,
  byRarity: [{ rarity: "common", total: 2, discovered: 0 }],
  categories: [
    { id: "giver_success", label: "Giver success", total: 1, discovered: 0 },
    { id: "quest_complete", label: "Quest complete", total: 1, discovered: 0 },
  ],
  items: [hidden("giver.1", "giver_success", "Giver success"), hidden("quest.1", "quest_complete", "Quest complete")],
};

vi.mock("convex/react", () => ({ useQuery: () => gallery }));

const { Discoveries } = await import("./Discoveries");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(questsEnabled: boolean) {
  const viewer = { workspace: { name: "Lumen Labs", emojiGlyph: "🌮", questsEnabled } } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <Discoveries />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return host.textContent ?? "";
}

test("undiscovered Quest messages say how to find them while quests are on", () => {
  const text = render(true);
  expect(text).toContain("Complete weekly quests to find these");
  expect(text).toContain("complete weekly quests, to uncover them all");
});

test("with quests switched off, the gallery doesn't send anyone after them", () => {
  const text = render(false);
  expect(text).not.toContain("Complete weekly quests to find these");
  expect(text).not.toContain("and complete weekly quests");
  expect(text).toContain("Weekly quests are off in this workspace");
  expect(text).toContain("Give and receive kudos to uncover them all.");
});
