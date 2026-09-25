// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { STAGES, type SpeciesId, SPECIES } from "../../convex/lib/garden";
import { PlantArt } from "./PlantArt";

/**
 * A plant on its key bed (#129): our own 32 × 32 pixel sprite (`src/world/plants.ts`), drawn at a
 * whole-number scale with hard edges, for its stage and species. Dormant plants turn autumn-coloured;
 * fruit and golden leaves (#98) show on it. No hedgehogs, nothing PostHog-drawn.
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
const fills = (svg: SVGSVGElement) => new Set([...svg.querySelectorAll("rect")].map((r) => r.getAttribute("fill")!.toLowerCase()));

test("a plant is pixels at a whole-number scale of 32 × 32, never blurred", () => {
  for (const [size, px] of [
    [96, 96],
    [100, 96],
    [48, 32],
    [40, 32],
    [8, 32],
  ]) {
    const svg = render(<PlantArt stage="grown" size={size} />);
    expect([svg.getAttribute("width"), svg.getAttribute("height")], `size ${size}`).toEqual([String(px), String(px)]);
    expect(svg.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    // Every pixel sits on the grid.
    for (const r of svg.querySelectorAll("rect")) for (const a of ["x", "y", "width", "height"]) expect(Number.isInteger(Number(r.getAttribute(a)))).toBe(true);
  }
});

test("every stage grows on the keyboard-key bed, each a new drawing", () => {
  const drawings = STAGES.map((s) => {
    const svg = render(<PlantArt stage={s.key} species="helpful_oak" />);
    expect(svg.getAttribute("data-bed"), s.key).toBe("key");
    expect(svg.getAttribute("data-stage")).toBe(s.key);
    return svg.innerHTML;
  });
  expect(new Set(drawings).size).toBe(STAGES.length);
});

test("each species has its own shape and colours once it's grown", () => {
  const canopy = (species: SpeciesId) => render(<PlantArt stage="grown" species={species} />).getAttribute("data-canopy");
  expect(canopy("patient_pine")).toBe("cone");
  expect(canopy("brave_cedar")).toBe("cone");
  expect(canopy("bright_sunflower")).toBe("flower");
  expect(canopy("curious_fern")).toBe("fronds");
  expect(canopy("golden_willow")).toBe("weeping");
  expect(canopy("helpful_oak")).toBe("round");
  const looks = (Object.keys(SPECIES) as SpeciesId[]).map((s) => render(<PlantArt stage="grown" species={s} />).innerHTML);
  expect(new Set(looks).size).toBe(looks.length);
});

test("a dormant plant turns autumn-coloured and stops blossoming", () => {
  const awake = render(<PlantArt stage="blossoming" species="generous_cherry" />);
  expect(fills(awake).has("#f7a8c8")).toBe(true); // cherry blossom
  const dormant = render(<PlantArt stage="blossoming" species="generous_cherry" dormant />);
  expect(dormant.getAttribute("data-dormant")).toBe("true");
  expect(fills(dormant).has("#f7a8c8")).toBe(false);
  expect(fills(dormant).has("#cf7d17")).toBe(true);
});

test("golden leaves from Super kudos show on the plant, up to three drawn; fruit up to four", () => {
  expect(render(<PlantArt stage="young" species="kind_maple" />).getAttribute("data-golden-leaves")).toBe("0");
  expect(render(<PlantArt stage="young" species="kind_maple" goldenLeaves={2} />).getAttribute("data-golden-leaves")).toBe("2");
  expect(render(<PlantArt stage="seed" species="kind_maple" goldenLeaves={7} />).getAttribute("data-golden-leaves")).toBe("3");
  expect(fills(render(<PlantArt stage="seed" species="kind_maple" goldenLeaves={1} />)).has("#f7c325")).toBe(true);
  expect(render(<PlantArt stage="grown" species="helpful_oak" fruit={2} />).getAttribute("data-fruit")).toBe("2");
  expect(render(<PlantArt stage="ancient" species="helpful_oak" fruit={9} />).getAttribute("data-fruit")).toBe("4");
});

test("an unknown species still draws, as the common oak", () => {
  expect(render(<PlantArt stage="grown" species="no_such_tree" />).innerHTML).toBe(render(<PlantArt stage="grown" species="helpful_oak" />).innerHTML);
});
