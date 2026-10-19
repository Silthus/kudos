import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

type SourceMap = { sources: string[]; sourcesContent?: (string | null)[] };

const outDir = mkdtempSync(join(tmpdir(), "website-build-"));
const assets = join(outDir, "assets");

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  const root = fileURLToPath(new URL("..", import.meta.url));
  await build({ root, mode: "production", logLevel: "silent", build: { outDir, emptyOutDir: true }, define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://production.invalid") } });
}, 120_000);

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(outDir, { recursive: true, force: true });
});

const bundlerRuntime = /^rolldown-runtime-[\w-]+\.js$/;

const bundlerRuntimeMostBytes = 2_048;

function scripts() {
  return readdirSync(assets).filter((file) => file.endsWith(".js") && !bundlerRuntime.test(file));
}

function bundlerRuntimes() {
  return readdirSync(assets).filter((file) => bundlerRuntime.test(file));
}

function mapOf(script: string): SourceMap {
  return JSON.parse(readFileSync(join(assets, `${script}.map`), "utf8"));
}

function ownSourcesOf(map: SourceMap) {
  return map.sources.filter((source) => !source.includes("node_modules"));
}

describe("MS25: the production build ships the source maps PostHog resolves stack traces from", () => {
  test("every script ends by naming the source map uploaded beside it", () => {
    expect(scripts().length).toBeGreaterThan(1);
    for (const script of scripts()) {
      expect(readFileSync(join(assets, script), "utf8").trimEnd().endsWith(`//# sourceMappingURL=${script}.map`), `${script} names its map`).toBe(true);
      expect(readdirSync(assets), `${script}.map is uploaded beside ${script}`).toContain(`${script}.map`);
    }
  });

  test("a script without a map is only the bundler's own runtime helpers, which hold no source of the website's", () => {
    for (const runtime of bundlerRuntimes()) {
      const code = readFileSync(join(assets, runtime), "utf8");
      expect(code.length, `${runtime} stays a few helpers`).toBeLessThanOrEqual(bundlerRuntimeMostBytes);
      expect(code, `${runtime} imports nothing of the website's`).not.toMatch(/from\s*["']\.\//);
    }
  });

  test("the maps hold the website's own source files with their text, so a frame resolves to a readable line", () => {
    const sources = scripts().flatMap((script) => {
      const map = mapOf(script);
      return ownSourcesOf(map).map((source) => ({ source, text: map.sourcesContent?.[map.sources.indexOf(source)] }));
    });

    const root = sources.find(({ source }) => source.endsWith("src/Root.tsx"));
    expect(root?.text).toContain("export function Root(");
  });
});

describe("MS24: posthog-js's own errors are recognised by the script they come from", () => {
  test("posthog-js shares its lazy chunk with the module that names the chunk's address", () => {
    const postHogScripts = scripts().filter((script) => mapOf(script).sources.some((source) => source.includes("node_modules/posthog-js/")));

    expect(postHogScripts).toHaveLength(1);
    expect(ownSourcesOf(mapOf(postHogScripts[0]!))).toContainEqual(expect.stringMatching(/(^|\/)src\/browserAnalytics\/postHogScript\.ts$/));
  });
});
