import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Definitions } from "./deploy";

type Registered = { isQuery?: boolean; isMutation?: boolean; isAction?: boolean };
type Router = { getRoutes(): [path: string, method: string, handler: unknown][] };

const convexDir = join(process.cwd(), "convex");

export async function inventory(): Promise<Definitions> {
  const functions: string[] = [];
  for (const file of entryPoints(convexDir)) {
    const module = relative(convexDir, file).replace(/\.[^.]+$/, ".js");
    const exports = (await import(file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(exports)) if (isRegistered(value)) functions.push(`${module}:${name}`);
    if (module === "http.js") for (const [path, method] of (exports.default as Router).getRoutes()) functions.push(`${method} ${path}`);
  }
  const schema = (await import(join(convexDir, "schema.ts"))) as { default: { tables: Record<string, unknown> } };
  return { functions, tables: Object.keys(schema.default.tables) };
}

function* entryPoints(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!existsSync(join(path, "convex.config.ts"))) yield* entryPoints(path);
    } else if (isEntryPoint(path)) yield path;
  }
}

function isEntryPoint(path: string) {
  const relativePath = relative(convexDir, path);
  const base = relativePath.split("/").at(-1)!;
  return (
    /\.(js|mjs|cjs|ts|tsx|mts|cts|jsx)$/.test(base) &&
    !relativePath.startsWith("_generated/") &&
    !/^[.#]/.test(base) &&
    base !== "schema.ts" &&
    base.split(".").length === 2 &&
    !relativePath.includes(" ") &&
    /^\s{0,100}(import|export)/m.test(readFileSync(path, "utf8"))
  );
}

const isRegistered = (value: unknown) => {
  const registered = value as Registered | undefined;
  return Boolean(registered?.isQuery || registered?.isMutation || registered?.isAction);
};

if (import.meta.main) console.log(JSON.stringify(await inventory()));
