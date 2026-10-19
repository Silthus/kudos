import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";
import { emojiArt, emojiArtPictureOf, hypeEmblemPicture, teamEmblemPicture } from "../../convex/album/emojiCatalogue";

const buildTimeout = 180_000;

const slackEmojiBytes = 128 * 1024;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

afterEach(() => vi.unstubAllEnvs());

describe("AL27: earned emoji art is built as static PNGs under fixed catalogue paths", () => {
  test("the build holds one picture for every team crest, milestone and level of the catalogue, beside the team and hype emblems, each at its fixed unhashed path", { timeout: buildTimeout }, async () => {
    const pictures = await emojiPicturesBuilt();

    const expected = [...(["team", "milestone", "level"] as const).flatMap((kind) => emojiArt[kind].map((catalogueId) => emojiArtPictureOf(kind, catalogueId))), teamEmblemPicture, hypeEmblemPicture];
    expect([...pictures.keys()].toSorted()).toEqual(expected.toSorted());
    expect(pictures.has("/emoji/team-product-analytics.png")).toBe(true);
    expect(pictures.has("/emoji/level-10.png")).toBe(true);
  });

  test("every picture is a 128-pixel square PNG under Slack's 128 KB emoji limit", { timeout: buildTimeout }, async () => {
    const pictures = await emojiPicturesBuilt();

    const unfit = [...pictures].filter(([, png]) => !isPng(png) || sizeOf(png).width !== 128 || sizeOf(png).height !== 128 || png.byteLength >= slackEmojiBytes);

    expect(unfit.map(([path, png]) => ({ path, bytes: png.byteLength, ...(isPng(png) && sizeOf(png)) }))).toEqual([]);
  });

  test("no two kinds share a picture: a team's crest, a milestone's emblem and a level's badge each draw their own art", { timeout: buildTimeout }, async () => {
    const pictures = await emojiPicturesBuilt();

    const distinct = new Set([...pictures.values()].map((png) => Buffer.from(png).toString("base64")));

    expect(distinct.size).toBe(pictures.size);
  });
});

function isPng(png: Uint8Array) {
  return pngSignature.every((byte, index) => png[index] === byte);
}

function sizeOf(png: Uint8Array) {
  const header = new DataView(png.buffer, png.byteOffset + 16, 8);
  return { width: header.getUint32(0), height: header.getUint32(4) };
}

let built: Promise<Map<string, Uint8Array>> | undefined;

function emojiPicturesBuilt(): Promise<Map<string, Uint8Array>> {
  built ??= buildForProduction();
  return built;
}

async function buildForProduction(): Promise<Map<string, Uint8Array>> {
  vi.stubEnv("NODE_ENV", "production");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const output = await build({ root, mode: "production", logLevel: "silent", build: { write: false }, define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://production.invalid") } });
  const bundles = Array.isArray(output) ? output : [output];
  const assets = bundles.flatMap((bundle) => ("output" in bundle ? bundle.output : [])).filter((file): file is Rolldown.OutputAsset => file.type === "asset" && file.fileName.startsWith("emoji/"));
  return new Map(assets.map((asset) => [`/${asset.fileName}`, typeof asset.source === "string" ? new TextEncoder().encode(asset.source) : asset.source]));
}
