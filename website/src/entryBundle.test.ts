import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";

const entryBudgetGzipBytes = 2_700_000;

afterEach(() => vi.unstubAllEnvs());

describe("#514: the production entry bundle stays within its budget", () => {
  test("the entry chunk and every chunk it imports statically, which every visitor downloads first, stay under their gzipped budget", { timeout: 120_000 }, async () => {
    const chunks = firstLoadOf(await productionChunks());
    expect(chunks.reduce((bytes, chunk) => bytes + gzipSync(chunk.code).byteLength, 0)).toBeLessThanOrEqual(entryBudgetGzipBytes);
  });
});

async function productionChunks(): Promise<Rolldown.OutputChunk[]> {
  vi.stubEnv("NODE_ENV", "production");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const output = await build({ root, mode: "production", logLevel: "silent", build: { write: false }, define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://production.invalid") } });
  const bundles = Array.isArray(output) ? output : [output];
  return bundles.flatMap((bundle) => ("output" in bundle ? bundle.output : [])).filter((chunk): chunk is Rolldown.OutputChunk => chunk.type === "chunk");
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
