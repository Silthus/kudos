// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { layout, TREE_STAGE_BY_ID } from "../../convex/lib/tree";
import { PLACES } from "./places";
import { crewTreeSprite, paintStanding, standingRect } from "./paint";
import { treeSprite } from "./tree/sprite";
import { treeCosmetics, type BuiltPart } from "./tree/cosmetics";
import { bannerFontPx, WorldCanvas } from "./WorldCanvas";
import { buildWorld } from "./world";

/**
 * The tree as the crew made it, drawn (#161): the canopy in its colour, the banner across the trunk
 * with its saying, the statue's hoggie on its plinth, the structures by their districts, and the
 * windmill's sails turning once when the tree grows.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const SEED = 7;
const world = (parts: BuiltPart[]) =>
  buildWorld({ seed: SEED, layout: layout(SEED, TREE_STAGE_BY_ID.elder.growth), planted: true, standing: PLACES.map((p) => p.id), cosmetics: treeCosmetics(parts) });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function render(w: ReturnType<typeof world>, growth = 100) {
  const host = document.createElement("div");
  document.body.append(host);
  root ??= createRoot(host);
  act(() => root!.render(<WorldCanvas world={w} worldKey="k" places={[]} furniture={{ beds: [], plots: [] }} scale={3} still={false} growth={growth} onPlace={() => {}} onSite={() => {}} />));
}

describe("the tree's own parts", () => {
  test("a canopy colour recolours the leaves only; the trunk's wood keeps its colours", () => {
    const plain = world([]);
    const rose = world([{ part: "canopy_colour", option: "rose" }]);
    const base = treeSprite(plain.stage, plain.seed, plain.rings);
    const dressed = crewTreeSprite(rose);
    expect(dressed.rows).toEqual(base.rows);
    expect(dressed.palette?.g).not.toBe(base.palette?.g);
    expect(dressed.palette?.B).toBe(base.palette?.B);
    expect(crewTreeSprite(plain)).toBe(base);
  });

  test("the banner is a cloth across the trunk with its saying set over it", () => {
    const w = world([{ part: "banner", text: "Every thank-you makes it grow" }]);
    expect(crewTreeSprite(w).rows).not.toEqual(treeSprite(w.stage, w.seed, w.rings).rows);
    render(w);
    expect(document.querySelector("[data-tree-banner]")?.textContent).toBe("Every thank-you makes it grow");
  });

  test("a long saying shrinks to fit its face; a short one fills its height", () => {
    expect(bannerFontPx({ width: 100, height: 5, text: "Hi" }, 3)).toBeCloseTo(16.5);
    const long = "x".repeat(60);
    expect(bannerFontPx({ width: 170, height: 5, text: long }, 3) * 0.62 * 60).toBeLessThanOrEqual(170 * 3 + 0.001);
  });

  test("the statue stands at the tree's foot as its hoggie's art slot", () => {
    render(world([{ part: "statue", option: "explorer" }]));
    expect(document.querySelector("[data-art-slot]")?.getAttribute("data-art-slot")).toBe("hoggie-explorer");
  });

  test("every structure is painted into the world by its district", () => {
    const bare = world([]);
    const built = world([{ part: "structure_bell" }, { part: "structure_lantern_bridge" }, { part: "structure_oasis_garden" }]);
    const count = (w: ReturnType<typeof world>) => {
      const rect = standingRect(w, { beds: [], plots: [] });
      const img = { width: rect.width, height: rect.height, data: new Uint8ClampedArray(rect.width * rect.height * 4) };
      paintStanding(img, rect, w, { beds: [], plots: [] });
      let n = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++;
      return n;
    };
    expect(built.crew.props.map((p) => p.id).sort()).toEqual(["structure_bell", "structure_lantern_bridge", "structure_oasis_garden"]);
    expect(count(built)).toBeGreaterThan(count(bare));
  });
});

describe("the windmill", () => {
  test("its sails turn once when the tree grows, then stand still", () => {
    vi.useFakeTimers();
    const w = world([{ part: "structure_windmill" }]);
    render(w, 100);
    const sails = () => document.querySelector("[data-windmill-sails]")?.getAttribute("data-windmill-sails");
    expect(sails()).toBe("still");
    render(w, 101);
    expect(sails()).toBe("turning");
    for (let i = 0; i < 12; i++) act(() => vi.advanceTimersByTime(120));
    expect(sails()).toBe("still");
  });
});
