// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { copyTells } from "@/testing/windowPage";
import { parchmentTextOnDusk } from "@/testing/layout";
import { TOAST_MS, Toasts, type QueuedToast } from "./Toast";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const level: QueuedToast = { id: 1, kind: "level", title: "Level 10, Grove keeper, +1 skill point", body: "Spend it at the elder oak.", link: { to: "/skills", label: "Go to the elder oak" } };
const found: QueuedToast = { id: 2, kind: "discovery", title: "New message discovered", body: "A kudos message you hadn't found before is in your collection.", link: { to: "/discoveries", label: "Open the gallery" } };

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function Harness({ initial }: { initial: QueuedToast[] }) {
  const [queue, setQueue] = useState(initial);
  return <Toasts queue={queue} onDone={() => setQueue((q) => q.slice(1))} still={false} />;
}
const render = (queue: QueuedToast[]) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <Harness initial={queue} />
      </MemoryRouter>,
    ),
  );
const region = () => host.querySelector("[aria-live='polite']")!;

describe("toasts", () => {
  test("a polite live region, there before anything is said in it", () => {
    render([]);
    expect(region()).not.toBeNull();
    expect(region().textContent).toBe("");
  });

  test("one at a time, on parchment, in plain words", () => {
    render([level, found]);
    expect(region().textContent).toContain("Level 10, Grove keeper, +1 skill point");
    expect(region().textContent).not.toContain("New message discovered");
    expect(region().querySelector("a")?.getAttribute("href")).toBe("/skills");
    expect(parchmentTextOnDusk(host)).toEqual([]);
    expect(copyTells(host)).toEqual([]);
  });

  test("dismissing one shows the next", () => {
    render([level, found]);
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Dismiss']")!.click());
    expect(region().textContent).toContain("New message discovered");
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Dismiss']")!.click());
    expect(region().textContent).toBe("");
  });

  test("goes by itself after a while, but not while you're reading it", () => {
    render([level, found]);
    const toast = host.querySelector<HTMLElement>("[data-toast]")!;
    act(() => toast.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })));
    act(() => vi.advanceTimersByTime(TOAST_MS * 2));
    expect(region().textContent).toContain("Level 10");
    act(() => toast.dispatchEvent(new PointerEvent("pointerout", { bubbles: true })));
    act(() => vi.advanceTimersByTime(TOAST_MS + 50));
    expect(region().textContent).toContain("New message discovered");
  });

  test("a toast coming in behind doesn't restart the one you're looking at", () => {
    function Growing() {
      const [queue, setQueue] = useState<QueuedToast[]>([level]);
      return (
        <>
          <button data-more onClick={() => setQueue((q) => [...q, found])} />
          <Toasts queue={queue} onDone={() => setQueue((q) => q.slice(1))} still={false} />
        </>
      );
    }
    act(() =>
      root.render(
        <MemoryRouter>
          <Growing />
        </MemoryRouter>,
      ),
    );
    act(() => vi.advanceTimersByTime(TOAST_MS - 100));
    act(() => host.querySelector<HTMLButtonElement>("[data-more]")!.click());
    act(() => vi.advanceTimersByTime(200));
    expect(region().textContent).toContain("New message discovered");
  });

  test("a discovery comes as a framed card", () => {
    render([found]);
    expect(host.querySelector("[data-toast='discovery']")).not.toBeNull();
  });

  test("a level-up is a celebration: the party hoggie comes along in its frame", () => {
    render([level]);
    expect(host.querySelector("[data-toast='level'] [data-npc] [data-art-slot='hoggie-party']")).not.toBeNull();
  });
});
