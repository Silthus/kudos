import { describe, expect, test } from "vitest";
import { BANNER_TEXT, bannerText, CREW, CREW_PARTS, crewPart, DISTRICT_STYLES, partsAvailable, validOption } from "./crewCatalogue";
import { DISTRICTS, stageIndex } from "./tree";

/** Crew quests (#152 S6): the catalogue of tree parts a company pools coins to build. */

describe("the catalogue", () => {
  test("has parts in the cost range with a stage each, distinct ids, and four styles for every district with a place", () => {
    expect(CREW_PARTS.length).toBeGreaterThanOrEqual(15);
    for (const p of CREW_PARTS) {
      expect(p.cost).toBeGreaterThanOrEqual(CREW.minCost);
      expect(p.cost).toBeLessThanOrEqual(CREW.maxCost);
      expect(p.name && p.about).toBeTruthy();
      if (p.kind === "district_style") expect(p.options).toEqual(DISTRICT_STYLES);
    }
    expect(new Set(CREW_PARTS.map((p) => p.id)).size).toBe(CREW_PARTS.length);
    const styled = CREW_PARTS.filter((p) => p.kind === "district_style").map((p) => p.district);
    for (const d of DISTRICTS) if (d.places.length > 0 || d.id === "homes") expect(styled).toContain(d.id);
  });

  test("the constants the crew system needs are here, not in a lane's head", () => {
    expect(CREW).toEqual({ maxOpen: 2, proposeLevel: 8, buildDays: 3, minCost: 200, maxCost: 5000 });
  });

  test("parts open with the tree's stage and never before the crew district; built-once parts drop out once taken", () => {
    for (const p of CREW_PARTS) expect(stageIndex(p.stage), p.id).toBeGreaterThanOrEqual(stageIndex("great"));
    expect(partsAvailable("young")).toEqual([]);
    expect(partsAvailable("great").length).toBeGreaterThan(0);
    expect(partsAvailable("world_tree").length).toBe(CREW_PARTS.length);
    expect(crewPart("structure_lantern_bridge")?.stage).toBe("great");
    expect(crewPart("style_gatehouse")?.stage).toBe("great");
    expect(crewPart("nope")).toBeNull();
    const ids = partsAvailable("world_tree", { built: ["structure_bell", "style_terrace", "statue"], open: ["style_homes"] }).map((p) => p.id);
    expect(ids).not.toContain("structure_bell");
    expect(ids).not.toContain("statue");
    expect(ids).toContain("style_terrace");
    expect(ids).not.toContain("style_homes");
  });

  test("options are checked against the part", () => {
    expect(validOption(crewPart("style_terrace")!, "mossy")).toBe(true);
    expect(validOption(crewPart("style_terrace")!, "neon")).toBe(false);
    expect(validOption(crewPart("style_terrace")!, undefined)).toBe(false);
    expect(validOption(crewPart("banner")!, undefined)).toBe(true);
    expect(validOption(crewPart("banner")!, "x")).toBe(false);
  });

  test("banner sayings are short plain text, trimmed, or nothing", () => {
    expect(BANNER_TEXT.max).toBe(60);
    expect(bannerText("  Thanks for everything, team ")).toBe("Thanks for everything, team");
    expect(bannerText("")).toBeNull();
    expect(bannerText("x".repeat(61))).toBeNull();
    expect(bannerText("<script>hi</script>")).toBeNull();
    expect(bannerText("line\nbreak")).toBeNull();
    expect(bannerText("tab\there")).toBeNull();
    expect(bannerText("odd break")).toBeNull();
  });
});
