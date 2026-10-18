import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";

const entryBudgetGzipBytes = 340_000;

const buildTimeout = 120_000;

const albumShellModule = /\/src\/album\/AlbumShell\.tsx$/;

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

  test("the album's stylesheet is never one the entry loads, so today's pages keep today's CSS", { timeout: buildTimeout }, async () => {
    const { chunks, stylesheets } = await productionBuild();
    const firstLoadCss = firstLoadOf(chunks).flatMap((chunk) => [...(chunk.viteMetadata?.importedCss ?? [])]);
    const albumCss = [...stylesheets].filter(([, css]) => css.includes(".al-shell")).map(([file]) => file);

    expect(albumCss).toHaveLength(1);
    expect(firstLoadCss).not.toContain(albumCss[0]);
    expect(firstLoadCss.some((file) => stylesheets.get(file)?.includes(".al-"))).toBe(false);
  });
});

type ProductionBuild = { chunks: Rolldown.OutputChunk[]; stylesheets: Map<string, string> };

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
