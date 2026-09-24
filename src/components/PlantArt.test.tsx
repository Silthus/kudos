// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { STAGES, type SpeciesId, SPECIES } from "../../convex/lib/garden";
import { PlantArt } from "./PlantArt";

/**
 * A plant in its Keyboard-garden bed (#101, #55 §G8): an isometric keyboard key with the plant for
 * its stage and species on top. Dormant plants turn autumn-coloured; golden leaves (#98) show on it.
 * Our own drawing: no hedgehogs, nothing PostHog-drawn.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(node));
  return host.querySelector("svg")!;
}

test("every stage grows on an isometric keyboard-key bed, one step bigger than the last", () => {
  const heights = STAGES.map((s) => {
    const svg = render(<PlantArt stage={s.key} species="helpful_oak" />);
    expect(svg.querySelector("[data-bed=key]"), s.key).not.toBeNull();
    expect(svg.getAttribute("data-stage")).toBe(s.key);
    return Number(svg.querySelector("[data-growth]")!.getAttribute("data-height"));
  });
  for (let i = 1; i < heights.length; i++) expect(heights[i], STAGES[i].key).toBeGreaterThan(heights[i - 1]);
});

test("each species has its own shape once it's grown: pines and cedars are cones, the sunflower a flower, the fern fronds, the willow weeps", () => {
  const canopy = (species: SpeciesId) => render(<PlantArt stage="grown" species={species} />).querySelector("[data-canopy]")!.getAttribute("data-canopy");
  expect(canopy("patient_pine")).toBe("cone");
  expect(canopy("brave_cedar")).toBe("cone");
  expect(canopy("bright_sunflower")).toBe("flower");
  expect(canopy("curious_fern")).toBe("fronds");
  expect(canopy("golden_willow")).toBe("weeping");
  expect(canopy("helpful_oak")).toBe("round");
  // Every species is drawn, and no two share both shape and colour.
  const looks = (Object.keys(SPECIES) as SpeciesId[]).map((s) => {
    const svg = render(<PlantArt stage="grown" species={s} />);
    return `${svg.querySelector("[data-canopy]")!.getAttribute("data-canopy")}:${svg.querySelector("[data-leaf]")!.getAttribute("fill")}`;
  });
  expect(new Set(looks).size).toBe(looks.length);
});

test("a dormant plant turns autumn-coloured and stops blossoming", () => {
  const awake = render(<PlantArt stage="blossoming" species="generous_cherry" />);
  expect(awake.querySelectorAll("[data-blossom]").length).toBeGreaterThan(0);
  const leafAwake = awake.querySelector("[data-leaf]")!.getAttribute("fill");
  const dormant = render(<PlantArt stage="blossoming" species="generous_cherry" dormant />);
  expect(dormant.getAttribute("data-dormant")).toBe("true");
  expect(dormant.querySelectorAll("[data-blossom]").length).toBe(0);
  expect(dormant.querySelector("[data-leaf]")!.getAttribute("fill")).not.toBe(leafAwake);
  expect(dormant.querySelector("[data-leaf]")!.getAttribute("fill")).toBe("#cf7d17");
});

test("golden leaves from Super kudos show on the plant, up to three drawn", () => {
  expect(render(<PlantArt stage="young" species="kind_maple" />).querySelectorAll("[data-golden-leaf]").length).toBe(0);
  expect(render(<PlantArt stage="young" species="kind_maple" goldenLeaves={2} />).querySelectorAll("[data-golden-leaf]").length).toBe(2);
  expect(render(<PlantArt stage="seed" species="kind_maple" goldenLeaves={7} />).querySelectorAll("[data-golden-leaf]").length).toBe(3);
});

test("fruit hangs on grown plants, up to four drawn", () => {
  expect(render(<PlantArt stage="grown" species="helpful_oak" fruit={2} />).querySelectorAll("[data-fruit]").length).toBe(2);
  expect(render(<PlantArt stage="ancient" species="helpful_oak" fruit={9} />).querySelectorAll("[data-fruit]").length).toBe(4);
});

test("an unknown species still draws, as the common oak", () => {
  expect(render(<PlantArt stage="grown" species="no_such_tree" />).querySelector("[data-canopy]")!.getAttribute("data-canopy")).toBe("round");
});
