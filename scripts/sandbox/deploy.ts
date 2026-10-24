import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Item = { kind: "function" | "route" | "table" | "index"; name: string };
export type Lane = { name: string };
export type Definitions = { functions: string[]; tables: string[] };
export type DryRun = { target: string; droppedIndexes: string[] };
export type Step = { run: string; afterFailedStep: boolean };
export type Identity = { branch: string; sha: string; dirty: boolean };
export type Owner = { branch: string; sha: string; worktree: string; thread?: string; since: string };

export type Sandbox = {
  name: string;
  served(): Promise<Definitions>;
  dryRun(): Promise<DryRun>;
  run(step: string): Promise<void>;
  servedBundle(): Promise<string>;
};

export type Checkout = {
  worktree: string;
  identity(): Identity;
  inventory(): Promise<Definitions>;
  builtBundle(): string;
};

export type Lanes = { defining(item: Item): Promise<Lane[]> };

export type Leases = {
  take(owner: Owner): { release(): void } | { holder: Owner | undefined };
  holder(): Owner | undefined;
};

export type Ports = {
  sandbox: Sandbox;
  checkout: Checkout;
  lanes: Lanes;
  leases: Leases;
  pause(): Promise<void>;
  log(line: string): void;
  now(): Date;
};

export type DeployOptions = { stateDir: string; steps: Step[]; wait: boolean; dryRun: boolean; drop: string[]; thread?: string };

type DeployRecord = Owner & { state: "deploying" | "live"; bundle?: string };

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
    const identity = committedIdentity(ports.checkout);
    const deploy: DeployRecord = { ...ownerOf(identity, options, ports), state: "deploying" };
    record(options.stateDir, deploy);
    await runSteps(options.steps, ports);
    const bundle = await servedBundleBuiltHere(ports);
    record(options.stateDir, { ...deploy, state: "live", bundle, since: ports.now().toISOString() });
    ports.log(`sandbox live: ${identity.branch}@${identity.sha} bundle ${bundle}`);
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
  const holder = ports.leases.holder();
  if (holder) {
    ports.log(`a deploy is running: ${describe(holder)} since ${holder.since}`);
    return 1;
  }
  const last = readRecord(stateDir);
  if (!last) {
    ports.log("last deploy: none recorded");
    return 1;
  }
  const thread = last.thread ? `, thread ${last.thread}` : "";
  if (last.state !== "live") {
    ports.log(`last deploy: ${describe(last)} started ${last.since}${thread} and did not finish, so the sandbox may serve part of it`);
    return 1;
  }
  ports.log(`last deploy: ${describe(last)} bundle ${last.bundle} at ${last.since}${thread}, worktree ${last.worktree}`);
  const served = await ports.sandbox.servedBundle();
  if (served !== last.bundle) {
    ports.log(`served bundle ${served} is not the last deploy's ${last.bundle}: it was deployed without sandbox-deploy or from another machine`);
    return 1;
  }
  const here = ports.checkout.identity();
  if (here.dirty || here.branch !== last.branch || here.sha !== last.sha) {
    ports.log(`this tree (${here.branch}@${here.sha}${here.dirty ? " with uncommitted changes" : ""}) is not live: ${describe(last)} is`);
    return 1;
  }
  const started = ports.leases.holder();
  if (started || JSON.stringify(readRecord(stateDir)) !== JSON.stringify(last)) {
    ports.log(`a deploy started while status ran${started ? `: ${describe(started)}` : ""}; run status again once it is done`);
    return 1;
  }
  ports.log("this tree is live");
  return 0;
}

async function leaseFor(options: DeployOptions, ports: Ports) {
  const owner = ownerOf(ports.checkout.identity(), options, ports);
  let waitingFor: string | undefined;
  for (;;) {
    const lease = ports.leases.take(owner);
    if ("release" in lease) return lease.release;
    const holder = lease.holder ? describeHolder(lease.holder) : "another deploy";
    if (!options.wait) {
      ports.log(`${holder} holds the sandbox lease; rerun with --wait to wait for it`);
      return undefined;
    }
    if (waitingFor !== holder) ports.log(`waiting for ${holder} to finish its sandbox deploy`);
    waitingFor = holder;
    await ports.pause();
  }
}

function committedIdentity(checkout: Checkout) {
  const identity = checkout.identity();
  if (identity.dirty) throw new Refusal(`refusing to deploy: ${identity.branch}@${identity.sha} has uncommitted changes; commit them so the sandbox records what it serves`);
  return identity;
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

async function runSteps([first, ...rest]: Step[], { sandbox }: Ports) {
  if (first) await sandbox.run(first.run);
  let failure: unknown;
  for (const step of rest) {
    if (failure !== undefined && !step.afterFailedStep) continue;
    try {
      await sandbox.run(step.run);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== undefined) throw failure;
}

async function servedBundleBuiltHere({ sandbox, checkout }: Ports) {
  const built = checkout.builtBundle();
  const served = await sandbox.servedBundle();
  if (served !== built) throw new Refusal(`the sandbox serves bundle ${served}, not the ${built} this tree built: another deploy may have landed; check with sandbox-deploy status`);
  return built;
}

function ownerOf({ branch, sha }: Identity, options: DeployOptions, { checkout, now }: Ports): Owner {
  return { branch, sha, worktree: checkout.worktree, thread: options.thread, since: now().toISOString() };
}

function record(stateDir: string, deploy: DeployRecord) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(lastDeployPath(stateDir), JSON.stringify(deploy, null, 2));
}

function readRecord(stateDir: string) {
  try {
    return JSON.parse(readFileSync(lastDeployPath(stateDir), "utf8")) as DeployRecord;
  } catch {
    return undefined;
  }
}

const describe = (owner: Owner) => `${owner.branch}@${owner.sha}`;
const describeHolder = (owner: Owner) => `${describe(owner)} (${[owner.thread && `thread ${owner.thread}`, `worktree ${owner.worktree}`].filter(Boolean).join(", ")})`;
const describeItem = (item: Item) => `${item.kind} ${item.name}`;
const lastDeployPath = (stateDir: string) => join(stateDir, "last-deploy.json");
