import { assets } from "@posthog/brand/crests/full/metadata";
import { describe, expect, test } from "vitest";
import { catalogue } from "../../convex/hoggies/catalogue";

const packageNames = new Map(assets.map(({ slug, name }) => [slug, name]));

describe("CL22: catalogue version 2's crests are the pinned @posthog/brand's", () => {
  test("every catalogue crest has art in the package, under the package's name for its team", () => {
    expect(catalogue.crests.map(({ crest, name }) => [crest, name])).toEqual(catalogue.crests.map(({ crest }) => [crest, packageNames.get(crest)]));
  });

  test("every crest in the package is in the catalogue but its placeholder", () => {
    expect(new Set(catalogue.crests.map(({ crest }) => crest))).toEqual(new Set([...packageNames.keys()].filter((crest) => crest !== "a-default-crest")));
  });
});

describe("#468: every catalogue crest has a picture the website can show", () => {
  test("the picture is the package's full PNG for the crest's slug", async () => {
    const { crestPictureOf } = await import("./crates/TeamCrest");
    for (const { crest } of catalogue.crests) expect(crestPictureOf({ kind: "crest", slug: crest })).toMatch(new RegExp(`/${crest}\\.png$`));
  });
});
