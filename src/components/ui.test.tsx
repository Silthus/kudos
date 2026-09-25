// @vitest-environment happy-dom
import { MotionGlobalConfig } from "motion/react";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { Button, Card, CardHeader, Dialog, Empty, PageHeader, Progress, RarityBadge, Segmented, Skeleton } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function render(ui: React.ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(ui));
  return host;
}

const classes = (el: Element | null) => [...(el?.classList ?? [])];
/** Radius, blur and soft shadows the pixel kit never draws. */
const SOFT = /^(rounded(?!-full$)|backdrop-|blur|shadow-(sm|md|lg|xl|2xl)$|bg-gradient)/;

test("a card is a pixel frame, square, and still the containing block of what it holds", () => {
  const card = render(
    <Card>
      <CardHeader title="Your look" subtitle="What teammates see." />
    </Card>,
  ).querySelector("section")!;
  expect(classes(card)).toContain("pixel-frame");
  expect(classes(card)).toContain("relative");
  expect(classes(card).filter((c) => SOFT.test(c))).toEqual([]);
  expect(card.querySelector("h2")!.className).toContain("font-display");
});

test("buttons are 3-D pixel buttons: lantern primary, parchment secondary, ember danger, flat ghost", () => {
  const el = render(
    <>
      <Button variant="primary">Plant for Ana</Button>
      <Button>Cancel</Button>
      <Button variant="danger">Uproot</Button>
      <Button variant="ghost">Skip</Button>
    </>,
  );
  const [primary, outline, danger, ghost] = [...el.querySelectorAll("button")].map(classes);
  expect(primary).toContain("pixel-btn");
  expect(primary).not.toContain("pixel-btn-secondary");
  expect(outline).toEqual(expect.arrayContaining(["pixel-btn", "pixel-btn-secondary"]));
  expect(danger).toEqual(expect.arrayContaining(["pixel-btn", "pixel-btn-danger"]));
  expect(ghost).not.toContain("pixel-btn");
  for (const c of [primary, outline, danger, ghost]) expect(c.filter((x) => SOFT.test(x))).toEqual([]);
});

test("the page header is a wooden sign with the title only: an eyebrow is accepted but not shown", () => {
  const el = render(<PageHeader eyebrow="Friday, September 25" title="Good evening, Alex" subtitle="You're #4 this week." />);
  expect(el.textContent).not.toContain("Friday, September 25");
  expect(el.querySelector("h1")!.textContent).toBe("Good evening, Alex");
  expect(el.textContent).toContain("You're #4 this week.");
  expect(el.querySelector("h1")!.closest(".pixel-sign")).not.toBeNull();
});

const fillOf = (el: HTMLElement) => (el.querySelector("[data-fill]") as HTMLElement).style.getPropertyValue("--fill");

test("the meter fills in blocks: any progress shows a block, and it never looks full before the max", () => {
  expect(fillOf(render(<Progress value={0} max={100} />))).toBe("0%");
  act(() => root?.unmount());
  expect(fillOf(render(<Progress value={1} max={1000} />))).toBe("clamp(4px, 0.1%, 100% - 4px)");
  act(() => root?.unmount());
  expect(fillOf(render(<Progress value={2045} max={2100} />))).toBe("clamp(4px, 97.38%, 100% - 4px)");
  act(() => root?.unmount());
  expect(fillOf(render(<Progress value={2100} max={2100} />))).toBe("100%");
  act(() => root?.unmount());
  // Odd inputs never draw a broken or overfull bar.
  expect(fillOf(render(<Progress value={NaN} max={100} />))).toBe("0%");
  act(() => root?.unmount());
  expect(fillOf(render(<Progress value={5} max={0} />))).toBe("0%");
  act(() => root?.unmount());
  expect(fillOf(render(<Progress value={150} max={100} />))).toBe("100%");
  act(() => root?.unmount());
  const meter = render(<Progress value={50} max={100} />).querySelector('[role="progressbar"]')!;
  expect(classes(meter)).toContain("pixel-meter");
  expect(meter.getAttribute("aria-valuenow")).toBe("50");
  expect(meter.getAttribute("aria-valuemax")).toBe("100");
});

function Opener({ autofocus }: { autofocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the ledger</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Ledger" subtitle="Every coin">
        {autofocus ? <input aria-label="Amount" data-autofocus /> : <p>Nothing yet.</p>}
      </Dialog>
    </>
  );
}

test("a dialog is a labelled pixel window: focus moves in on open and back to the opener on close", () => {
  const el = render(<Opener />);
  const opener = el.querySelector("button")!;
  opener.focus();
  act(() => opener.click());
  const dialog = el.querySelector("dialog")!;
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Ledger");
  expect(dialog.querySelector(".pixel-frame")).not.toBeNull();
  const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
  expect(document.activeElement).toBe(close);
  act(() => close.click());
  expect(dialog.hasAttribute("open")).toBe(false);
  expect(document.activeElement).toBe(opener);
});

test("a dialog honours an explicit start field", () => {
  const el = render(<Opener autofocus />);
  act(() => el.querySelector("button")!.click());
  expect(document.activeElement).toBe(el.querySelector('input[aria-label="Amount"]'));
});

test("a rarity badge is a pixel chip in sentence case with a square swatch of its colour", () => {
  const chip = render(<RarityBadge rarity="legendary" />).firstElementChild!;
  expect(classes(chip)).toContain("pixel-chip");
  expect(chip.textContent).toBe("Legendary");
  expect(classes(chip)).not.toContain("uppercase");
  const swatch = chip.querySelector("[data-swatch]") as HTMLElement;
  expect(swatch.style.background).toBe("var(--color-r-legendary)");
  expect(classes(swatch).filter((c) => c.startsWith("rounded"))).toEqual([]);
});

test("empty states, tabs and skeletons draw no soft shapes and never loop", () => {
  const el = render(
    <>
      <Empty title="Nobody has thanked anyone this week yet.">Be first.</Empty>
      <Segmented value="week" onChange={() => {}} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      <Skeleton className="h-10" />
    </>,
  );
  const all = [...el.querySelectorAll("*")].flatMap(classes);
  expect(all.filter((c) => SOFT.test(c) || c.startsWith("animate-"))).toEqual([]);
  expect(el.querySelector('[aria-selected="true"]')!.textContent).toBe("Week");
});
