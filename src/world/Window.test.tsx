// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";
import { Window } from "./Window";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Walk to the signpost</button>
      <Window
        open={open}
        title="Quest signpost"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <p className="text-ink/75">This week's quests.</p>
        <pre className="overflow-x-auto">a long line that scrolls in its own box</pre>
      </Window>
    </>
  );
}

const dialog = () => document.querySelector<HTMLDialogElement>("dialog");

test("a window is a dialog labelled with its place's name, and its content is inside it", () => {
  act(() => root.render(<Harness />));
  act(() => host.querySelector("button")!.click());
  const d = dialog()!;
  expect(d.open).toBe(true);
  expect(d.getAttribute("aria-labelledby")).toBeTruthy();
  expect(document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent).toBe("Quest signpost");
  expect(d.textContent).toContain("This week's quests.");
});

test("focus moves into the window, and back to what opened it when it closes", () => {
  act(() => root.render(<Harness />));
  const opener = host.querySelector("button")!;
  opener.focus();
  act(() => opener.click());
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
  act(() => (document.activeElement as HTMLElement).click());
  expect(dialog()?.open ?? false).toBe(false);
  expect(document.activeElement).toBe(opener);
});

test("Escape closes the window", () => {
  const onClose = vi.fn();
  act(() => root.render(<Harness onClose={onClose} />));
  act(() => host.querySelector("button")!.click());
  act(() => {
    dialog()!.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
  expect(onClose).toHaveBeenCalledOnce();
});

test("a late close event from closing and reopening at once (the next place, under reduced motion) doesn't close the window", () => {
  const onClose = vi.fn();
  act(() => root.render(<Window open title="Quest signpost" onClose={onClose}>…</Window>));
  // The browser delivers the close event of a close() after the window has already reopened.
  act(() => {
    dialog()!.dispatchEvent(new Event("close"));
  });
  expect(onClose).not.toHaveBeenCalled();
  expect(dialog()?.open).toBe(true);
});

test("with nothing to return focus to, focus goes to the fallback (the Places button)", () => {
  const places = document.createElement("button");
  document.body.append(places);
  const view = (open: boolean) => (
    <Window open={open} title="Quest signpost" onClose={() => {}} returnFocus={() => places}>
      …
    </Window>
  );
  act(() => root.render(view(true))); // a deep link: nothing opened it
  act(() => root.render(view(false)));
  expect(document.activeElement).toBe(places);
  places.remove();
});

test("its content sits on parchment and scrolls inside the window, never widening a phone", () => {
  act(() => root.render(<Harness />));
  act(() => host.querySelector("button")!.click());
  const d = dialog()!;
  expect(parchmentTextOnDusk(d)).toEqual([]);
  expect(escapesFromScrollers(d)).toEqual([]);
  expect(widensSideways(d)).toEqual([]);
  // One scroller holds the content; the frame itself never scrolls.
  const body = d.querySelector("[data-window-body]")!;
  expect(body.className).toMatch(/overflow-y-auto/);
  expect(body.textContent).toContain("This week's quests.");
});
