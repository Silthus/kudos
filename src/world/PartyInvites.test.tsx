// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A party invite on your screen (#163, plan #152 S7): who asks you into which ruin, the seconds left
 * to answer, Accept (which takes you to the ruin's window) and Decline. An invite past its minute is gone.
 */

let invites: unknown[] = [];
const accept = vi.fn(async (_: unknown) => null);
const decline = vi.fn(async (_: unknown) => null);
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "rpg:invites": invites })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) => ({ "rpg:accept": accept, "rpg:decline": decline })[getFunctionName(fn)],
}));

const { PartyInvites } = await import("./PartyInvites");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
let path = "";
function Where() {
  path = useLocation().pathname;
  return null;
}
beforeEach(() => {
  // A still clock: the seconds left read the same however slowly the test runs.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  accept.mockClear();
  decline.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  host.remove();
});

function render() {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <PartyInvites />
      </MemoryRouter>,
    ),
  );
}

const invite = (patch: Record<string, unknown> = {}) => ({ runId: "e1", ruinId: "ruin:2:0", ruinName: "The Amber Vault", tier: 2, from: "Ana", size: 1, expiresAt: Date.now() + 45_500, ...patch });
const button = (name: RegExp) => [...host.querySelectorAll("button")].find((b) => name.test(b.textContent ?? ""))!;

describe("a party invite", () => {
  test("says who asks, into which ruin, and how long you have", () => {
    invites = [invite()];
    render();
    const card = host.querySelector("[data-toast='party']")!;
    expect(card.textContent).toContain("Ana invites you to The Amber Vault");
    expect(card.textContent).toMatch(/far ruins/);
    expect(card.textContent).toMatch(/45 seconds to answer/);
  });

  test("Accept joins and takes you to the ruin's window; Decline says no", async () => {
    invites = [invite()];
    render();
    await act(async () => button(/Accept/).click());
    expect(accept).toHaveBeenCalledWith({ runId: "e1" });
    expect(path).toBe("/ruins/2-0");
    await act(async () => button(/Decline/).click());
    expect(decline).toHaveBeenCalledWith({ runId: "e1" });
  });

  test("an invite past its minute isn't shown", () => {
    invites = [invite({ expiresAt: Date.now() - 1 })];
    render();
    expect(host.querySelector("[data-toast='party']")).toBeNull();
  });
});
