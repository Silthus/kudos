import { spawnSync } from "node:child_process";
import type { Item, Lane, Lanes } from "./deploy";

const liveWindowDays = 7;
const main = "origin/main";

export function gitLanes(repo: string, now: Date): Lanes {
  let heads: Map<string, string> | undefined;
  return {
    async defining(item) {
      heads ??= liveHeads(repo, now);
      if (heads.size === 0) return [];
      const { patterns, paths } = definitionOf(item);
      const found = git(repo, ["grep", "-l", "-E", "--all-match", ...patterns.flatMap((pattern) => ["-e", pattern]), ...heads.keys(), "--", ...paths], [0, 1]);
      const shas = new Set(found.split("\n").filter(Boolean).map((line) => line.slice(0, line.indexOf(":"))));
      return [...new Set([...shas].map((sha) => heads!.get(sha)!))].sort().map((name): Lane => ({ name }));
    },
  };
}

function liveHeads(repo: string, now: Date) {
  const cutoff = now.getTime() / 1000 - liveWindowDays * 24 * 3600;
  const isLive = (sha: string, committedAt: number) => committedAt >= cutoff && !isAncestor(repo, sha, "HEAD");
  const heads = new Map<string, string>();
  for (const worktree of worktrees(repo)) {
    if (isLive(worktree.head, committedAt(repo, worktree.head)) && !isAncestor(repo, worktree.head, main)) {
      heads.set(worktree.head, worktree.branch ? `${worktree.branch} (worktree ${worktree.path})` : `detached worktree ${worktree.path}`);
    }
  }
  const unmerged = new Set(git(repo, ["for-each-ref", `--no-merged=${main}`, "--format=%(objectname)", "refs/remotes/origin"]).split("\n"));
  for (const line of git(repo, ["for-each-ref", "--format=%(objectname) %(committerdate:unix) %(symref) %(refname:short)", "refs/remotes/origin"]).split("\n")) {
    const [sha, at, symref, name] = line.split(" ");
    if (!sha || !name || symref) continue;
    if (isLive(sha, Number(at)) && (unmerged.has(sha) || name === main)) heads.set(sha, name);
  }
  return heads;
}

function definitionOf({ kind, name }: Item): { patterns: string[]; paths: string[] } {
  switch (kind) {
    case "function": {
      const [module, exported] = name.split(":") as [string, string];
      return { patterns: [`export[[:space:]]+(const|let|function|async[[:space:]]+function)[[:space:]]+${escape(exported)}${wordEnd}`], paths: [`:(glob)convex/${module.replace(/\.js$/, "")}.*`] };
    }
    case "route":
      return { patterns: [`["'\`]${escape(name.slice(name.indexOf(" ") + 1))}["'\`]`], paths: ["convex/"] };
    case "table":
      return { patterns: [tableDefinition(name)], paths: ["convex/"] };
    case "index": {
      const [table, index] = name.split(".") as [string, string];
      return { patterns: [tableDefinition(table), `\\.index\\([[:space:]]*["'\`]${escape(index)}["'\`]`], paths: ["convex/"] };
    }
  }
}

function worktrees(repo: string) {
  return git(repo, ["worktree", "list", "--porcelain"])
    .split("\n\n")
    .map((entry) => {
      const field = (key: string) => entry.split("\n").find((line) => line.startsWith(`${key} `))?.slice(key.length + 1);
      return { path: field("worktree")!, head: field("HEAD")!, branch: field("branch")?.replace(/^refs\/heads\//, "") };
    })
    .filter((worktree) => worktree.path && worktree.head);
}

const wordEnd = "([^A-Za-z0-9_$]|$)";
const wordStart = "(^|[^A-Za-z0-9_$])";
const tableDefinition = (table: string) => `${wordStart}${escape(table)}[[:space:]]*:[[:space:]]*defineTable`;
const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const committedAt = (repo: string, sha: string) => Number(git(repo, ["show", "-s", "--format=%ct", sha]));
const isAncestor = (repo: string, sha: string, of: string) => spawnSync("git", ["merge-base", "--is-ancestor", sha, of], { cwd: repo }).status === 0;

function git(repo: string, args: string[], okStatuses = [0]) {
  const { status, stdout, stderr } = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!okStatuses.includes(status ?? -1)) throw new Error(`git ${args.slice(0, 2).join(" ")} failed: ${stderr.trim()}`);
  return stdout.trim();
}
