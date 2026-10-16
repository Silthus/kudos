import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { describe, expect, test } from "vitest";

const entryBudgetGzipBytes = 2_800_000;

describe("#514: the production entry bundle stays within its budget", () => {
  test("the entry chunk every visitor downloads first stays under its gzipped budget", { timeout: 120_000 }, async () => {
    const entry = await builtEntryChunk();
    expect(gzipSync(entry.code).byteLength).toBeLessThanOrEqual(entryBudgetGzipBytes);
  });
});

async function builtEntryChunk(): Promise<Rolldown.OutputChunk> {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const output = await build({ root, logLevel: "silent", build: { write: false }, define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://production.invalid") } });
  const chunks = (Array.isArray(output) ? output : [output]).flatMap((bundle) => ("output" in bundle ? bundle.output : []));
  return chunks.find((chunk): chunk is Rolldown.OutputChunk => chunk.type === "chunk" && chunk.isEntry)!;
}
