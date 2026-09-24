// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useHashScroll } from "./hashScroll";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Which elements were scrolled into view, in order. */
let scrolled: string[];
let root: Root;
let container: HTMLElement;
let setLoaded: (loaded: boolean) => void;
let setRows: (rows: number) => void;

/** A page like the store: "My requests" only renders once its data has loaded, then fills in. */
function Page({ loadedAtFirst }: { loadedAtFirst: boolean }) {
  useHashScroll();
  const [loaded, setL] = useState(loadedAtFirst);
  const [rows, setR] = useState(0);
  setLoaded = setL;
  setRows = setR;
  if (!loaded) return <p>Loading…</p>;
  return (
    <>
      <section id="catalog">Rewards</section>
      <section id="my-requests">
        {Array.from({ length: rows }, (_, i) => (
          <p key={i}>Request {i}</p>
        ))}
      </section>
    </>
  );
}

function open(path: string, loadedAtFirst = false) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Page loadedAtFirst={loadedAtFirst} />
      </MemoryRouter>,
    );
  });
}
/** Lets the DOM observer see what React just rendered. */
const settle = () => act(async () => {});

beforeEach(() => {
  scrolled = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolled.push(this.id);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("a link to a section of a page (#fragment)", () => {
  test("scrolls to the section once its data has loaded", async () => {
    open("/store#my-requests");
    await settle();
    expect(scrolled).toEqual([]);
    act(() => setLoaded(true));
    await settle();
    expect(scrolled).toEqual(["my-requests"]);
  });

  test("scrolls straight away when the section is already there", async () => {
    open("/store#my-requests", true);
    await settle();
    expect(scrolled).toEqual(["my-requests"]);
  });

  test("keeps the section in view while the rest of the page is still filling in", async () => {
    open("/store#my-requests", true);
    await settle();
    act(() => setRows(5));
    await settle();
    expect(scrolled).toEqual(["my-requests", "my-requests"]);
  });

  test("leaves you alone once you scroll yourself", async () => {
    open("/store#my-requests");
    await settle();
    document.dispatchEvent(new Event("wheel"));
    act(() => setLoaded(true));
    await settle();
    expect(scrolled).toEqual([]);
  });

  test.each(["keydown", "pointerdown", "touchmove"])("a %s also hands scrolling back to you", async (type) => {
    open("/store#my-requests");
    await settle();
    document.dispatchEvent(new Event(type));
    act(() => setLoaded(true));
    await settle();
    expect(scrolled).toEqual([]);
  });

  test("so does dragging the scrollbar, which scrolls without any of those", async () => {
    open("/store#my-requests", true);
    await settle();
    window.scrollTo(0, 400);
    window.dispatchEvent(new Event("scroll"));
    act(() => setRows(5));
    await settle();
    expect(scrolled).toEqual(["my-requests"]);
  });

  test("gives up on a section that never shows up", async () => {
    vi.useFakeTimers();
    open("/store#my-requests");
    await settle();
    await act(async () => vi.advanceTimersByTime(15_000));
    act(() => setLoaded(true));
    await settle();
    expect(scrolled).toEqual([]);
  });

  test("stops following the section once the page has settled", async () => {
    vi.useFakeTimers();
    open("/store#my-requests", true);
    await settle();
    await act(async () => vi.advanceTimersByTime(5_000));
    act(() => setRows(5));
    await settle();
    expect(scrolled).toEqual(["my-requests"]);
  });

  test("a mangled fragment is just ignored", async () => {
    open("/store#%E0%A4%A", true);
    await settle();
    expect(scrolled).toEqual([]);
    expect(container.textContent).toContain("Rewards");
  });

  test("a page without a fragment isn't scrolled at all", async () => {
    open("/store", true);
    await settle();
    expect(scrolled).toEqual([]);
  });
});
