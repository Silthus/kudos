import { describe, expect, test } from "vitest";
import { PALETTE } from "../pixels";
import { moodTree, treeSprite } from "./sprite";

/** The tree under a blight (#164): purple patches on its canopy while one is here, dim lanterns after a defeat. */

const count = (rows: string[], ch: string) => rows.join("").split(ch).length - 1;

describe("the tree's mood", () => {
  const tree = treeSprite("ancient", 7);

  test("an untroubled tree is the tree", () => {
    expect(moodTree(tree, { blighted: false, dim: false }, 7)).toBe(tree);
  });

  test("a blight spots a few patches of the canopy in blight purple, the same ones for everyone, leaves the rest", () => {
    const spotted = moodTree(tree, { blighted: true, dim: false }, 7);
    expect(count(tree.rows, "x")).toBe(0);
    const blight = count(spotted.rows, "x") + count(spotted.rows, "X");
    expect(blight).toBeGreaterThan(40);
    // A few patches, never the whole canopy.
    expect(blight).toBeLessThan((count(tree.rows, "g") + count(tree.rows, "G") + count(tree.rows, "u")) / 4);
    expect(spotted.rows.every((r, i) => r.length === tree.rows[i].length)).toBe(true);
    expect(moodTree(tree, { blighted: true, dim: false }, 7)).toEqual(spotted);
    expect(spotted.palette?.x ?? PALETTE.x).toBe("#7a3e8a");
  });

  test("after a defeat its lanterns burn low: the same pixels in a darker light", () => {
    const dim = moodTree(tree, { blighted: false, dim: true }, 7);
    expect(dim.rows).toEqual(tree.rows);
    expect(dim.palette?.l).toBeDefined();
    expect(dim.palette?.l).not.toBe(PALETTE.l);
  });
});
