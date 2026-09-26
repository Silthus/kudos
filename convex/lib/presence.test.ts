import { describe, expect, test } from "vitest";
import { chunkKey, chunksAround, isChunkKey, shouldSave } from "./presence";

describe("chunks", () => {
  test("32×32 tiles, negative tiles in negative chunks", () => {
    expect(chunkKey(0, 0)).toBe("0:0");
    expect(chunkKey(31, 31)).toBe("0:0");
    expect(chunkKey(32, 0)).toBe("1:0");
    expect(chunkKey(-1, -32)).toBe("-1:-1");
    expect(chunkKey(-33, 5.5)).toBe("-2:0");
    expect(chunkKey(-0, -0)).toBe("0:0");
  });

  test("around a tile: its chunk and the 8 next to it, all valid keys", () => {
    const around = chunksAround(40, -1);
    expect(around).toHaveLength(9);
    expect(around).toContain("1:-1");
    expect(around).toEqual(expect.arrayContaining(["0:-2", "2:0", "1:0"]));
    expect(around.every(isChunkKey)).toBe(true);
  });

  test("keys are 'cx:cy' integers", () => {
    expect(["0:0", "-12:7", "123456:-1"].every(isChunkKey)).toBe(true);
    expect(["", "0", "0:0:0", "a:b", "1.5:0", "-0:0", "1234567:0", " 0:0"].some(isChunkKey)).toBe(false);
  });
});

describe("saving where you are", () => {
  const base = { at: { x: 0, y: 0 }, x: 5, y: 5, walking: false, savedAt: 0, now: 10_000 };
  test("not when nothing moved", () => {
    expect(shouldSave({ ...base, x: 0, y: 0, now: 999_999 })).toBe(false);
  });
  test("the first time, and whenever it moved and 10 s passed standing", () => {
    expect(shouldSave({ ...base, at: undefined, savedAt: undefined, now: 0 })).toBe(true);
    expect(shouldSave({ ...base, savedAt: undefined })).toBe(true);
    expect(shouldSave({ ...base, now: 9_999 })).toBe(false);
    expect(shouldSave(base)).toBe(true);
  });
  test("while walking only every minute", () => {
    expect(shouldSave({ ...base, walking: true, now: 59_999 })).toBe(false);
    expect(shouldSave({ ...base, walking: true, now: 60_000 })).toBe(true);
  });
});
