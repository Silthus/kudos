// @vitest-environment happy-dom
import { MotionGlobalConfig } from "motion/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { LineChart, Sparkline } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;
// happy-dom has no layout: every chart measures 600 px wide.
globalThis.ResizeObserver = class {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
};

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(ui: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(ui));
  return host;
}

const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];

test("line charts draw square markers and flat fills, never a gradient or a round dot", () => {
  const el = render(
    <>
      <LineChart
        endLabels
        days={days}
        series={[
          { key: "given", label: "Given", color: "var(--color-ember)", values: [1, 3, 2, 5, 4] },
          { key: "received", label: "Received", color: "var(--color-pond)", values: [0, 2, 2, 1, 3] },
        ]}
      />
      <Sparkline values={[1, null, 2, 4]} labels={["a", "b", "c", "d"]} reference={2} format={String} label="Kudos per week" />
    </>,
  );
  expect(el.querySelectorAll("svg").length).toBe(2);
  expect(el.querySelectorAll("linearGradient, radialGradient").length).toBe(0);
  expect(el.querySelectorAll("circle").length).toBe(0);
  expect(el.querySelectorAll("rect[data-marker]").length).toBeGreaterThanOrEqual(4); // 2 end markers + a lone point + the last point
  for (const path of el.querySelectorAll("path[stroke]")) expect(path.getAttribute("stroke-linecap") ?? "square").not.toBe("round");
});
