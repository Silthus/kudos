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

describe("#514: every catalogue hoggie has a picture the website can show", () => {
  test("the picture is the package's PNG for the hoggie's slug, its first variant when it has several", async () => {
    const { hoggiePictureOf } = await import("./crates/Hoggie");
    for (const { hoggie } of catalogue.hoggies) expect(hoggiePictureOf({ kind: "hoggie", slug: hoggie })).toBe(await packagePictureOf(hoggie));
  });
});

async function packagePictureOf(slug: string): Promise<string> {
  const picture = (file: string) => import(`../node_modules/@posthog/brand/dist/generated/hoggies/png/${file}.mjs`).then(({ src }: { src: string }) => src);
  return picture(slug).catch(() => picture(`${slug}-1`));
}
