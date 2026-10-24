import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Checkout, Definitions, DryRun, Sandbox } from "./deploy";

const inventoryScript = fileURLToPath(new URL("./inventory.ts", import.meta.url));

type WorkflowStep = { id?: string; run?: string; env?: Record<string, string> };
type FunctionSpec = { url: string; functions: { identifier?: string; method?: string; path?: string }[] };

export function convexSandbox(name: string, repo: string): Sandbox {
  const env = sandboxEnv(name);
  const capture = (command: string) => captured(command, repo, env);
  return {
    name,
    async served(): Promise<Definitions> {
      const spec = JSON.parse(capture("pnpm exec convex function-spec")) as FunctionSpec;
      if (!spec.url.includes(`//${name}.`)) throw new Error(`convex function-spec read ${spec.url}, not ${name}`);
      return {
        functions: spec.functions.map((fn) => fn.identifier ?? `${fn.method} ${fn.path}`),
        tables: capture("pnpm exec convex data").split("\n").filter(Boolean),
      };
    },
    async dryRun() {
      return dryRunOf(capture("pnpm exec convex deploy --dry-run -y --typecheck disable 2>&1"));
    },
    async run(step) {
      const { status } = spawnSync("bash", ["-o", "pipefail", "-c", step], { cwd: repo, env, stdio: "inherit" });
      if (status !== 0) throw new Error(`step failed with exit ${status}: ${step}`);
    },
    async servedBundle() {
      const page = await fetch(`https://${name}.convex.site/?sandbox-deploy=${Date.now()}`);
      return bundleIn(await page.text(), `https://${name}.convex.site/`);
    },
  };
}

export function gitCheckout(repo: string): Checkout {
  const git = (command: string) => captured(`git ${command}`, repo, process.env);
  const dirty = git("status --porcelain -- . :!node_modules") !== "";
  return {
    branch: git("branch --show-current") || git("for-each-ref --points-at=HEAD --count=1 --format=%(refname:short) refs/remotes/origin") || "detached",
    sha: git("rev-parse --short HEAD") + (dirty ? "-dirty" : ""),
    worktree: repo,
    inventory: async () => JSON.parse(captured(`bun ${inventoryScript}`, repo, process.env)) as Definitions,
    builtBundle: () => bundleIn(readFileSync(join(repo, "website/dist/index.html"), "utf8"), "website/dist/index.html"),
  };
}

export function dryRunOf(output: string): DryRun {
  const target = /Deploying to (https:\/\/[^\s.]+\.convex\.cloud)/.exec(output)?.[1] ?? "an unknown deployment";
  const deleted: string[] = [];
  const added: string[] = [];
  let section: string[] | undefined;
  for (const line of output.split("\n")) {
    if (/Would delete table indexes:/.test(line)) section = deleted;
    else if (/Would add (staged )?table indexes:/.test(line)) section = added;
    else {
      const index = /^\s*\[[-+]\]\s+(\S+)/.exec(line)?.[1];
      if (section && index) section.push(index);
      else section = undefined;
    }
  }
  return { target, droppedIndexes: deleted.filter((index) => !added.includes(index)) };
}

export function workflowSteps(workflowYaml: string): string[] {
  const workflow = parse(workflowYaml) as { jobs: Record<string, { steps?: WorkflowStep[] }> };
  return Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.run && step.env?.CONVEX_DEPLOY_KEY)
    .map((step) => (step.id === "deploy" ? `${step.run} -y` : step.run!));
}

function sandboxEnv(name: string): NodeJS.ProcessEnv {
  const { CONVEX_DEPLOY_KEY, CONVEX_SELF_HOSTED_URL, CONVEX_SELF_HOSTED_ADMIN_KEY, ...inherited } = process.env;
  return { ...inherited, CONVEX_DEPLOYMENT: `prod:${name}`, NO_COLOR: "1", FORCE_COLOR: "0" };
}

function bundleIn(html: string, where: string) {
  const bundle = /\/assets\/index-([A-Za-z0-9_-]+)\.js/.exec(html)?.[1];
  if (!bundle) throw new Error(`no assets/index-*.js bundle in ${where}`);
  return bundle;
}

function captured(command: string, cwd: string, env: NodeJS.ProcessEnv) {
  const { status, stdout, stderr } = spawnSync("bash", ["-o", "pipefail", "-c", command], { cwd, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (status !== 0) throw new Error(`${command} failed with exit ${status}:\n${stdout}${stderr}`);
  return stdout.trim();
}
