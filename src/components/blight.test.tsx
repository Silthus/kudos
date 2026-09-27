// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The gallery's blight crests (#164): one for each blight you helped beat, with your damage. */

let crests: unknown;
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "discoveries:crests": crests })[getFunctionName(fn)],
}));

const { BlightCrests } = await import("./blight");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

const viewer = { workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
function render() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <ViewerContext.Provider value={viewer}>
        <BlightCrests />
      </ViewerContext.Provider>,
    ),
  );
  return host;
}

describe("blight crests", () => {
  test("hang one crest for each blight beaten, with the day and your damage", () => {
    crests = [{ number: 2, damage: 14, wonAt: Date.parse("2026-09-01T12:00:00Z") }];
    const host = render();
    expect(host.querySelectorAll("[data-crest]")).toHaveLength(1);
    expect(host.textContent).toContain("Blight 2, beaten on Tuesday, 1 September");
    expect(host.textContent).toContain("You dealt it 14.");
  });

  test("before any, say how one is won", () => {
    crests = [];
    const host = render();
    expect(host.querySelector("[data-crest]")).toBeNull();
    expect(host.textContent).toContain("Help beat a blight at the tree to hang its crest here.");
  });
});
