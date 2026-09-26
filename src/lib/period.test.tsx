// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "./viewer";
import { useWorkspaceToday } from "./period";

/** Today is the workspace's day: a simulator's clock runs `clockOffsetMs` ahead of the wall clock (#143). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const DAY_MS = 86_400_000;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  vi.useRealTimers();
});

function Today() {
  return <span>{useWorkspaceToday()}</span>;
}

function todayWith(clockOffsetMs: number) {
  const viewer = { workspace: { timezone: "Europe/Berlin", clockOffsetMs } } as unknown as ReadyViewer;
  const el = document.createElement("div");
  root = createRoot(el);
  act(() =>
    root!.render(
      <ViewerContext.Provider value={viewer}>
        <Today />
      </ViewerContext.Provider>,
    ),
  );
  return el.textContent;
}

test("without an offset, today is the wall clock's day in the workspace timezone", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T22:30:00Z")); // 00:30 on the 24th in Berlin
  expect(todayWith(0)).toBe("2026-09-24");
});

test("a simulator three days ahead is on its own day", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
  expect(todayWith(3 * DAY_MS)).toBe("2026-09-26");
});
