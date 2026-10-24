import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { leaseHolder, readJson, takeLease, type Owner } from "./lease";

export type Item = { kind: "function" | "route" | "table" | "index"; name: string };
export type Lane = { name: string };
export type Definitions = { functions: string[]; tables: string[] };
export type DryRun = { target: string; droppedIndexes: string[] };

export type Sandbox = {
  name: string;
  served(): Promise<Definitions>;
  dryRun(): Promise<DryRun>;
  run(step: string): Promise<void>;
  servedBundle(): Promise<string>;
};

export type Checkout = {
  branch: string;
  sha: string;
  worktree: string;
  inventory(): Promise<Definitions>;
  builtBundle(): string;
};

export type Lanes = { defining(item: Item): Promise<Lane[]> };

export type Ports = {
  sandbox: Sandbox;
  checkout: Checkout;
  lanes: Lanes;
  isAlive(pid: number): boolean;
  pause(): Promise<void>;
  log(line: string): void;
  now(): Date;
};

export type DeployOptions = { stateDir: string; steps: string[]; wait: boolean; dryRun: boolean; drop: string[]; thread?: string; pid: number };

type DeployRecord = { branch: string; sha: string; bundle: string; at: string; worktree: string; thread?: string };

class Refusal extends Error {}

export async function deploySandbox(options: DeployOptions, ports: Ports): Promise<number> {
  const release = await leaseFor(options, ports);
  if (!release) return 1;
  try {
    await refuseLaneDrops(missingFromTree(await ports.sandbox.served(), await ports.checkout.inventory()), options, ports);
    await refuseLaneDrops(await indexDropsOfDryRun(ports), options, ports);
    if (options.dryRun) {
      ports.log("dry run passed, nothing deployed");
      return 0;
    }
    for (const step of options.steps) await ports.sandbox.run(step);
    const bundle = await servedBundleBuiltHere(ports);
    record(options, ports, bundle);
    ports.log(`sandbox live: ${ports.checkout.branch}@${ports.checkout.sha} bundle ${bundle}`);
    return 0;
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    ports.log(error.message);
    return 1;
  } finally {
    release();
  }
}

export async function sandboxStatus(stateDir: string, ports: Ports): Promise<number> {
  const holder = leaseHolder(stateDir);
  ports.log(holder && ports.isAlive(holder.pid) ? `lease: held by ${describeOwner(holder)} since ${holder.since}` : "lease: free");
  const last = readJson<DeployRecord>(lastDeployPath(stateDir));
  if (!last) {
    ports.log("last deploy: none recorded");
    return 1;
  }
  ports.log(`last deploy: ${last.branch}@${last.sha} bundle ${last.bundle} at ${last.at}${last.thread ? `, thread ${last.thread}` : ""}, worktree ${last.worktree}`);
  const served = await ports.sandbox.servedBundle();
  if (served !== last.bundle) {
    ports.log(`served bundle ${served} is not the last deploy's ${last.bundle}: someone deployed without sandbox-deploy`);
    return 1;
  }
  const { branch, sha } = ports.checkout;
  if (branch !== last.branch || sha !== last.sha) {
    ports.log(`this tree (${branch}@${sha}) is not live: ${last.branch}@${last.sha} is`);
    return 1;
  }
  ports.log("this tree is live");
  return 0;
}

async function leaseFor(options: DeployOptions, ports: Ports) {
  const { branch, sha, worktree } = ports.checkout;
  const owner: Owner = { branch, sha, worktree, thread: options.thread, pid: options.pid, since: ports.now().toISOString() };
  let waitingFor: string | undefined;
  for (;;) {
    const lease = takeLease(options.stateDir, owner, ports.isAlive);
    if (lease.taken) return lease.release;
    const holder = describeOwner(lease.holder);
    if (!options.wait) {
      const where = [lease.holder.thread && `thread ${lease.holder.thread}`, `worktree ${lease.holder.worktree}`].filter(Boolean).join(", ");
      ports.log(`${holder} holds the sandbox lease (${where}); rerun with --wait to wait for it`);
      return undefined;
    }
    if (waitingFor !== holder) ports.log(`waiting for ${holder} to finish its sandbox deploy`);
    waitingFor = holder;
    await ports.pause();
  }
}

function missingFromTree(served: Definitions, tree: Definitions): Item[] {
  const missing = (names: string[], defined: string[]) => names.filter((name) => !defined.includes(name));
  return [
    ...missing(served.functions, tree.functions).map((name): Item => ({ kind: /^[A-Z]+ \//.test(name) ? "route" : "function", name })),
    ...missing(served.tables, tree.tables).map((name): Item => ({ kind: "table", name })),
  ];
}

async function indexDropsOfDryRun({ sandbox }: Ports): Promise<Item[]> {
  const dryRun = await sandbox.dryRun();
  if (!dryRun.target.includes(`//${sandbox.name}.`)) throw new Refusal(`the dry run targets ${dryRun.target}, not ${sandbox.name}; refusing to deploy`);
  return dryRun.droppedIndexes.map((name) => ({ kind: "index", name }));
}

async function refuseLaneDrops(items: Item[], options: DeployOptions, ports: Ports) {
  const refused: string[] = [];
  const unclaimed: string[] = [];
  for (const item of items) {
    if (options.drop.includes(item.name)) {
      ports.log(`leaving out ${describeItem(item)}: --drop names it`);
      continue;
    }
    const lanes = await ports.lanes.defining(item);
    if (lanes.length === 0) unclaimed.push(describeItem(item));
    else refused.push(`  ${describeItem(item)}, defined on ${lanes.map((lane) => lane.name).join(", ")}`);
  }
  if (unclaimed.length > 0) ports.log(`leaving out what no live lane defines: ${unclaimed.join(", ")}`);
  if (refused.length > 0) {
    throw new Refusal(
      [
        "refusing to deploy: the sandbox serves what this tree would drop and live lanes define:",
        ...refused,
        "merge those lanes into a throwaway tree and deploy that, or pass --drop <name> for each one you mean to drop",
      ].join("\n"),
    );
  }
}

async function servedBundleBuiltHere({ sandbox, checkout }: Ports) {
  const built = checkout.builtBundle();
  const served = await sandbox.servedBundle();
  if (served !== built) throw new Refusal(`the sandbox serves bundle ${served}, not the ${built} this tree built: another deploy may have landed; check with sandbox-deploy status`);
  return built;
}

function record(options: DeployOptions, { checkout, now }: Ports, bundle: string) {
  const deploy: DeployRecord = { branch: checkout.branch, sha: checkout.sha, bundle, at: now().toISOString(), worktree: checkout.worktree, thread: options.thread };
  mkdirSync(options.stateDir, { recursive: true });
  writeFileSync(lastDeployPath(options.stateDir), JSON.stringify(deploy, null, 2));
}

const describeOwner = (owner: Owner) => `${owner.branch}@${owner.sha}`;
const describeItem = (item: Item) => `${item.kind} ${item.name}`;
const lastDeployPath = (stateDir: string) => join(stateDir, "last-deploy.json");
