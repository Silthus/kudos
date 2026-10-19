import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";
import { milestoneCatalogue } from "../../convex/album/milestoneCatalogue";
import { catalogue as hoggieCatalogue } from "../../convex/hoggies/catalogue";

const entryBudgetGzipBytes = 340_000;

const buildTimeout = 120_000;

const albumShellModule = /\/src\/album\/AlbumShell\.tsx$/;

const slackEmojiBytes = 128 * 1024;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

afterEach(() => vi.unstubAllEnvs());

describe("#514 #519: the production entry bundle stays within its budget", () => {
  test("the entry chunk and every chunk it imports statically, which every visitor downloads first, stay under their gzipped budget", { timeout: buildTimeout }, async () => {
    const { chunks } = await productionBuild();
    expect(firstLoadOf(chunks).reduce((bytes, chunk) => bytes + gzipSync(chunk.code).byteLength, 0)).toBeLessThanOrEqual(entryBudgetGzipBytes);
  });
});

describe("AL57: the album loads in its own chunk", () => {
  test("the album shell is in a chunk the entry loads only on demand", { timeout: buildTimeout }, async () => {
    const { chunks } = await productionBuild();
    const holdsTheAlbum = (chunk: Rolldown.OutputChunk) => chunk.moduleIds.some((id) => albumShellModule.test(id));

    expect(firstLoadOf(chunks).filter(holdsTheAlbum)).toEqual([]);
    expect(chunks.filter((chunk) => !chunk.isEntry && holdsTheAlbum(chunk))).toHaveLength(1);
  });

  test("the album's stylesheet is never one the entry loads, so the visitors' pages keep their own CSS", { timeout: buildTimeout }, async () => {
    const { chunks, stylesheets } = await productionBuild();
    const firstLoadCss = firstLoadOf(chunks).flatMap((chunk) => [...(chunk.viteMetadata?.importedCss ?? [])]);
    const albumCss = [...stylesheets].filter(([, css]) => css.includes(".al-shell")).map(([file]) => file);

    expect(albumCss).toHaveLength(1);
    expect(firstLoadCss).not.toContain(albumCss[0]);
    expect(firstLoadCss.some((file) => stylesheets.get(file)?.includes(".al-"))).toBe(false);
  });
});

describe("AL27: earned emoji art is built as static PNGs under fixed catalogue paths", () => {
  test("the build holds one picture for every team crest, milestone tier and level of the catalogue, beside the team and hype emblems, each at its fixed unhashed path", { timeout: buildTimeout }, async () => {
    const { emojiPictures } = await productionBuild();

    const expected = [
      ...hoggieCatalogue.crests.map(({ crest }) => `/emoji/team-${crest}.png`),
      ...milestoneCatalogue.milestones.flatMap(({ id, steps }) => steps.map(({ tier }) => `/emoji/milestone-${id}-${tier}.png`)),
      ...["5", "10", "15", "20", "25"].map((level) => `/emoji/level-${level}.png`),
      "/emoji/team.png",
      "/emoji/hype.png",
    ];
    expect([...emojiPictures.keys()].toSorted()).toEqual(expected.toSorted());
  });

  test("every picture is a 128-pixel square PNG under Slack's 128 KB emoji limit, and no two kinds share a picture", { timeout: buildTimeout }, async () => {
    const { emojiPictures } = await productionBuild();

    const unfit = [...emojiPictures].filter(([, png]) => !isPng(png) || sizeOf(png).width !== 128 || sizeOf(png).height !== 128 || png.byteLength >= slackEmojiBytes);
    const distinct = new Set([...emojiPictures.values()].map((png) => Buffer.from(png).toString("base64")));

    expect(emojiPictures.size).toBeGreaterThan(0);
    expect(unfit.map(([path, png]) => ({ path, bytes: png.byteLength, ...(isPng(png) && sizeOf(png)) }))).toEqual([]);
    expect(distinct.size).toBe(emojiPictures.size);
  });
});

function isPng(png: Uint8Array) {
  return pngSignature.every((byte, index) => png[index] === byte);
}

function sizeOf(png: Uint8Array) {
  const header = new DataView(png.buffer, png.byteOffset + 16, 8);
  return { width: header.getUint32(0), height: header.getUint32(4) };
}

type ProductionBuild = { chunks: Rolldown.OutputChunk[]; stylesheets: Map<string, string>; emojiPictures: Map<string, Uint8Array> };

let built: Promise<ProductionBuild> | undefined;

function productionBuild(): Promise<ProductionBuild> {
  built ??= buildForProduction();
  return built;
}

async function buildForProduction(): Promise<ProductionBuild> {
  vi.stubEnv("NODE_ENV", "production");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const output = await build({ root, mode: "production", logLevel: "silent", build: { write: false }, define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://production.invalid") } });
  const bundles = Array.isArray(output) ? output : [output];
  const files = bundles.flatMap((bundle) => ("output" in bundle ? bundle.output : []));
  return {
    chunks: files.filter((file): file is Rolldown.OutputChunk => file.type === "chunk"),
    stylesheets: new Map(files.filter((file): file is Rolldown.OutputAsset => file.type === "asset" && file.fileName.endsWith(".css")).map((file) => [file.fileName, String(file.source)])),
    emojiPictures: new Map(files.filter((file): file is Rolldown.OutputAsset => file.type === "asset" && file.fileName.startsWith("emoji/")).map((file) => [`/${file.fileName}`, bytesOf(file.source)])),
  };
}

function firstLoadOf(chunks: Rolldown.OutputChunk[]): Rolldown.OutputChunk[] {
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const loaded = new Set<Rolldown.OutputChunk>();
  const load = (chunk: Rolldown.OutputChunk | undefined) => {
    if (chunk === undefined || loaded.has(chunk)) return;
    loaded.add(chunk);
    for (const file of chunk.imports) load(byFile.get(file));
  };
  for (const chunk of chunks) if (chunk.isEntry) load(chunk);
  return [...loaded];
}

function bytesOf(source: string | Uint8Array) {
  return typeof source === "string" ? new TextEncoder().encode(source) : source;
}
