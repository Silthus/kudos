import { describe, expect, test } from "vitest";
import { BANNER_TEXT, CREW_PARTS, crewPart, partsAvailable, validBannerText } from "./crewCatalogue";
import { stageIndex } from "./tree";

/** Crew quests (#152 S6): the catalogue of tree parts a company pools coins to build. */

describe("the catalogue", () => {
  test("has parts in the cost range with a stage each, and every district style has four options", () => {
    expect(CREW_PARTS.length).toBeGreaterThanOrEqual(10);
    for (const p of CREW_PARTS) {
      expect(p.cost).toBeGreaterThanOrEqual(200);
      expect(p.cost).toBeLessThanOrEqual(5000);
      expect(p.name && p.about).toBeTruthy();
      if (p.kind === "district_style") expect(p.options).toHaveLength(4);
    }
    expect(new Set(CREW_PARTS.map((p) => p.id)).size).toBe(CREW_PARTS.length);
  });

  test("parts open with the tree's stage and never before the crew district", () => {
    for (const p of CREW_PARTS) expect(stageIndex(p.stage)).toBeGreaterThanOrEqual(stageIndex("great"));
    expect(partsAvailable("young")).toEqual([]);
    expect(partsAvailable("great").length).toBeGreaterThan(0);
    expect(partsAvailable("world_tree").length).toBe(CREW_PARTS.length);
    expect(crewPart("lantern_bridge")?.stage).toBe("great");
    expect(crewPart("nope")).toBeNull();
  });

  test("banner sayings are short, plain text, and never empty", () => {
    expect(BANNER_TEXT.max).toBe(60);
    expect(validBannerText("Thanks for everything, team")).toBe(true);
    expect(validBannerText("")).toBe(false);
    expect(validBannerText("x".repeat(61))).toBe(false);
    expect(validBannerText("<script>hi</script>")).toBe(false);
    expect(validBannerText("line\nbreak")).toBe(false);
  });
});
