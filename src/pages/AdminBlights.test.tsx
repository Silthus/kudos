// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The gatehouse's blights (#164): send one for a day ahead, call off one that hasn't come. */

let current: unknown;
const schedule = vi.fn(async (_args: unknown) => "b1");
const cancel = vi.fn(async (_args: unknown) => null);
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "blights:current": current })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) => ({ "blights:schedule": schedule, "blights:cancel": cancel })[getFunctionName(fn)],
}));
vi.mock("@/lib/period", () => ({ useWorkspaceToday: () => "2026-09-23" }));

const { AdminBlights } = await import("./AdminBlights");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  schedule.mockClear();
  cancel.mockClear();
});

const viewer = { workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
function render() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <ViewerContext.Provider value={viewer}>
        <AdminBlights />
      </ViewerContext.Provider>,
    ),
  );
  return host;
}
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;

describe("the gatehouse's blights", () => {
  test("sends a blight for tomorrow by default", async () => {
    current = { blight: null, lanternsDimUntil: null };
    const host = render();
    expect((host.querySelector("input[type='date']") as HTMLInputElement).value).toBe("2026-09-24");
    await act(async () => button(host, "Send a blight").click());
    expect(schedule).toHaveBeenCalledWith({ dayKey: "2026-09-24" });
  });

  test("an announced blight can be called off; one at the tree can't", async () => {
    current = { blight: { _id: "b1", status: "announced", arrivesAt: Date.parse("2026-09-24T22:00:00Z"), hp: 0, damage: 0 }, lanternsDimUntil: null };
    const host = render();
    expect(host.textContent).toContain("A blight comes on Friday, 25 September.");
    await act(async () => button(host, "Call it off").click());
    expect(cancel).toHaveBeenCalledWith({ blightId: "b1" });

    current = { blight: { _id: "b1", status: "active", arrivesAt: Date.now() - 1000, endsAt: Date.now() + 86_400_000, hp: 120, damage: 42 }, lanternsDimUntil: null };
    act(() => root!.unmount());
    const again = render();
    expect(again.textContent).toContain("A blight is at the tree: 78 of 120 left.");
    expect(button(again, "Call it off")).toBeUndefined();
  });

  test("says blights are the game's while it's off or hidden", () => {
    current = null;
    expect(render().textContent).toContain("Blights are part of the game");
  });
});
