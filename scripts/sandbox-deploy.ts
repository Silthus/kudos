import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { convexSandbox, gitCheckout, workflowSteps } from "./sandbox/convexSandbox";
import { deploySandbox, sandboxStatus, type Ports } from "./sandbox/deploy";
import { gitLanes } from "./sandbox/lanes";

const sandboxDeployment = "different-dog-467";
const usage = `usage: pnpm sandbox-deploy [--wait] [--dry-run] [--thread <id>] [--drop <name>]...
       pnpm sandbox-deploy status`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    wait: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    thread: { type: "string" },
    drop: { type: "string", multiple: true, default: [] },
    help: { type: "boolean", default: false },
  },
});

const repo = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
const stateDir = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "kudos-sandbox");
const ports: Ports = {
  sandbox: convexSandbox(sandboxDeployment, repo),
  checkout: gitCheckout(repo),
  lanes: gitLanes(repo, new Date()),
  isAlive,
  pause: () => new Promise((resolve) => setTimeout(resolve, 10_000)),
  log: (line) => console.log(line),
  now: () => new Date(),
};

process.exitCode = await main();

async function main() {
  const [command = "deploy"] = positionals;
  if (values.help || !["deploy", "status"].includes(command)) {
    console.log(usage);
    return values.help ? 0 : 64;
  }
  try {
    if (command === "status") return await sandboxStatus(stateDir, ports);
    fetchLanes();
    const steps = workflowSteps(readFileSync(join(repo, ".github/workflows/deploy-sandbox.yml"), "utf8"));
    return await deploySandbox({ stateDir, steps, wait: values.wait, dryRun: values["dry-run"], drop: values.drop, thread: values.thread, pid: process.pid }, ports);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

function fetchLanes() {
  if (spawnSync("git", ["fetch", "--quiet", "origin"], { cwd: repo, stdio: "inherit" }).status !== 0) console.log("git fetch origin failed: naming lanes from the refs already fetched");
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
