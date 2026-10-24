// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { gitLanes } from "./lanes";

const now = new Date();
let dir: string;
let work: string;

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp } }).trim();
let stamp = now.toISOString();

function commit(cwd: string, files: Record<string, string>, message: string) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), body);
  }
  git(cwd, "add", "-A");
  git(cwd, "commit", "-qm", message);
}

function branchFromMain(name: string, files: Record<string, string>, push = true) {
  git(work, "switch", "-qc", name, "main");
  commit(work, files, name);
  if (push) git(work, "push", "-q", "origin", name);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sandbox-lanes-"));
  git(dir, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(dir, "clone", "-q", join(dir, "origin.git"), "work");
  work = join(dir, "work");
  git(work, "config", "user.email", "lane@example.com");
  git(work, "config", "user.name", "Lane");
  commit(work, { "convex/schema.ts": "export default defineSchema({ kudos: defineTable({}) });\n", "convex/a.ts": "export const f = query({});\n" }, "main");
  git(work, "push", "-q", "origin", "main");

  branchFromMain("album/2", {
    "convex/album/week.ts": "export const getAlbumWeek = query({});\n",
    "convex/schema.ts": 'export default defineSchema({ kudos: defineTable({}), pairTallies: defineTable({}).index("by_pair", ["pair"]) });\n',
  });
  branchFromMain("merged/lane", { "convex/album/week.ts": "export const getAlbumWeek = query({});\n" });
  git(work, "switch", "-q", "main");
  git(work, "merge", "-q", "--ff-only", "merged/lane");
  git(work, "push", "-q", "origin", "main");
  git(work, "reset", "-q", "--hard", "HEAD~1");

  stamp = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  branchFromMain("abandoned", { "convex/album/week.ts": "export const getAlbumWeek = query({});\n" });
  stamp = now.toISOString();

  git(work, "switch", "-q", "--detach", "main");
  git(work, "worktree", "add", "-q", "--detach", join(dir, "proof-tree"), "main");
  commit(join(dir, "proof-tree"), { "convex/album/person.ts": "export const getAlbumPerson = query({});\n" }, "proof tree");
  git(work, "fetch", "-q", "origin");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the live lanes that define what the sandbox serves", () => {
  test("names unmerged branches on origin that define a function, main when the tree is behind it, and skips merged and stale branches", async () => {
    const lanes = gitLanes(work, now);

    expect(await lanes.defining({ kind: "function", name: "album/week.js:getAlbumWeek" })).toEqual([{ name: "origin/album/2" }, { name: "origin/main" }]);
  });

  test("names a local worktree's unpushed head by its path", async () => {
    const lanes = gitLanes(work, now);

    expect(await lanes.defining({ kind: "function", name: "album/person.js:getAlbumPerson" })).toEqual([{ name: `detached worktree ${join(dir, "proof-tree")}` }]);
  });

  test("finds tables and indexes in a lane's schema", async () => {
    const lanes = gitLanes(work, now);

    expect(await lanes.defining({ kind: "table", name: "pairTallies" })).toEqual([{ name: "origin/album/2" }]);
    expect(await lanes.defining({ kind: "index", name: "pairTallies.by_pair" })).toEqual([{ name: "origin/album/2" }]);
  });

  test("finds nothing for what no live lane defines", async () => {
    const lanes = gitLanes(work, now);

    expect(await lanes.defining({ kind: "table", name: "stars" })).toEqual([]);
  });
});
