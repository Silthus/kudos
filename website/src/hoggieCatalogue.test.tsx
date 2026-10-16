import { assets } from "@posthog/brand/hoggies/metadata";
import { describe, expect, test } from "vitest";
import { catalogue } from "../../convex/hoggies/catalogue";

const packageNames = new Map(assets.map(({ slug, name }) => [slug, name]));

describe("CL1 CL2 CL5: catalogue version 1 is every hoggie in the pinned @posthog/brand", () => {
  test("every catalogue hoggie has art in the package, under the package's name for it", () => {
    expect(catalogue.hoggies.map(({ hoggie, name }) => [hoggie, name])).toEqual(catalogue.hoggies.map(({ hoggie }) => [hoggie, packageNames.get(hoggie)]));
  });

  test("every hoggie in the package is in the catalogue, numbered variants as one", () => {
    expect(new Set(catalogue.hoggies.map(({ hoggie }) => hoggie))).toEqual(new Set(packageNames.keys()));
  });
});
