// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }) }));
vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));

const { AppShell } = await import("./AppShell");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function navLabels(questsEnabled: boolean) {
  const viewer = {
    workspaces: [],
    member: { _id: "m1", name: "Alex Rivera", isAdmin: false },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", isDemo: false, storeEnabled: false, questsEnabled },
  } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={["/me"]}>
        <ViewerContext.Provider value={viewer}>
          <AppShell />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
}

test("the Quest log is in the navigation while quests are on", () => {
  expect(navLabels(true)).toContain("/quests");
});

test("the Quest log leaves the navigation while quests are switched off", () => {
  expect(navLabels(false)).not.toContain("/quests");
});
