// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/**
 * While Silthus/kudos is public, nothing PostHog-drawn is committed (#101, #55 §G17): the game's
 * hoggies, Keyboard garden and Max load from PostHog's servers via `src/lib/art.ts`. This guard
 * fails if such an image would be committed (tracked, or untracked and not ignored), or if the
 * `@posthog/brand` package became a dependency (its art would ship in our bundle).
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?)$/i;
/** Names PostHog's art goes by: hoggies and hedgehogs, Max, the Keyboard garden, the brand package, its Cloudinary. */
const POSTHOG_ART = /hog|posthog|(^|[/_.\s-])max([/_.\s-]|$)|keyboard[-_\s]?garden|cloudinary|dmukukwp6/i;

/**
 * SHA-256 of the PostHog originals `src/lib/art.ts` points at (hoggies from `@posthog/brand@0.12.3`,
 * the Keyboard garden and Max from Cloudinary), so a copy is caught even under another name.
 */
const POSTHOG_ORIGINALS = new Set([
  "80bd8b6bfddc6b9ea390159954ea15d8fc3cda6cbbc58ce89a607c9ac32173d1", // gardener-1.png
  "774cfe5c3678d9f654ad10598fe4f420d79cf695afd2c66ba3d60da5e9e0c994", // gardener-2.png
  "adc8490e4bdf2ee4f3fff4d5f73d2699cd6505712f49f59929e4448c5c1931ea", // reading.png
  "0906ae754c2d983cee53a09ae7be444078c2b6cf65db842a66ef00b4f5fb9ec8", // party.png
  "da96a22e9014c6f3db68d06634e2d4ef8c8244d587b791d19c83ac7f21be24fe", // level-up.png
  "2d5c5d1408c5f0c7375b91d21865c83d5bddc0d3cbbca8263f9fd8ef59958a13", // heart.png
  "edeff3655793d86990e9da7265b61bd0839a063a6b45ad246d6a7f4543d81f14", // keyboard_garden_dark_opt_15e213413c.png
  "a35fc7d97bb9d0f1374f6c6c5cc1fc7d3b5cbd10f8d9e2fbc8c9a561c97b67fa", // keyboard_garden_light_opt_compressed_5094746caf.png
  "24370e847d02a816fe3235d514b584ff328de220398a4f786871b148106f353d", // ai_max_e80de99727.png
]);

/** Every file git would commit: tracked, plus untracked files that aren't ignored. */
function committable(): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\0").filter(Boolean);
}

function posthogArtIn(files: string[]): string[] {
  return files.filter((f) => (IMAGE.test(f) && POSTHOG_ART.test(f)) || f.includes("@posthog/brand") || /(^|\/)posthog-brand\//.test(f));
}

test("the guard recognises PostHog art by name, and leaves the app's own images alone", () => {
  expect(
    posthogArtIn([
      "public/hoggies/party.png",
      "src/assets/gardener-hog.svg",
      "public/max.png",
      "public/keyboard_garden_dark.jpg",
      "vendor/@posthog/brand/dist/generated/hoggies/png/heart.png",
      "docs/screenshots/me.png",
      "docs/screenshots/maximize.png",
      "src/lib/art.ts",
    ]),
  ).toEqual(["public/hoggies/party.png", "src/assets/gardener-hog.svg", "public/max.png", "public/keyboard_garden_dark.jpg", "vendor/@posthog/brand/dist/generated/hoggies/png/heart.png"]);
});

test("no PostHog-drawn image is committed: the art loads from PostHog's servers", () => {
  expect(posthogArtIn(committable())).toEqual([]);
});

test("no committed image is a copy of the PostHog originals, whatever it's called", () => {
  const copies = committable()
    .filter((f) => IMAGE.test(f))
    .filter((f) => {
      try {
        return POSTHOG_ORIGINALS.has(createHash("sha256").update(readFileSync(path.join(ROOT, f))).digest("hex"));
      } catch {
        return false; // deleted but not yet staged
      }
    });
  expect(copies).toEqual([]);
});

test("@posthog/brand is not a dependency: its art would ship in the bundle", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };
  expect(Object.keys(deps)).not.toContain("@posthog/brand");
});
