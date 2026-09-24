// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { BoostBannerView } from "./boosts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

const TODAY_TEXT = "Ben activated a Kudos booster: Double. Today is a bonus day: until midnight, every thoughtful kudos earns double XP and Hog coins.";
const FRIDAY_TEXT = "Bonus day on Friday, 25 September: all day, every thoughtful kudos earns double XP and Hog coins.";

test("shows today's boost and the bonus days announced ahead", () => {
  const host = render(
    <BoostBannerView banner={{ current: { kind: "double", text: TODAY_TEXT }, upcoming: [{ dayKey: "2026-09-25", kind: "double", text: FRIDAY_TEXT }] }} />,
  );
  const region = host.querySelector("[role=status]");
  expect(region?.getAttribute("aria-label")).toBe("Bonus days");
  expect(host.textContent).toContain(TODAY_TEXT);
  expect(host.textContent).toContain(FRIDAY_TEXT);
});

test("names only the next bonus day when several wait, and how many more", () => {
  const upcoming = ["2026-09-25", "2026-10-02", "2026-10-09"].map((dayKey) => ({ dayKey, kind: "double" as const, text: `Bonus day on ${dayKey}.` }));
  const host = render(<BoostBannerView banner={{ current: null, upcoming }} />);
  expect(host.textContent).toContain("Bonus day on 2026-09-25.");
  expect(host.textContent).not.toContain("2026-10-02");
  expect(host.textContent).toContain("+2 more bonus days ahead");
});

test("renders nothing without a boost, while loading, or with the game off", () => {
  expect(render(<BoostBannerView banner={{ current: null, upcoming: [] }} />).innerHTML).toBe("");
  expect(render(<BoostBannerView banner={undefined} />).innerHTML).toBe("");
  expect(render(<BoostBannerView banner={null} />).innerHTML).toBe("");
});
