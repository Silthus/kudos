// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { deploySandbox, sandboxStatus, type Checkout, type DryRun, type Identity, type Item, type Lanes, type Leases, type Owner, type Ports, type Sandbox, type Step } from "./deploy";

const steps: Step[] = [
  { run: "pnpm exec convex deploy -y", afterFailedStep: false },
  { run: "pnpm exec static-hosting upload", afterFailedStep: false },
  { run: "pnpm exec convex run website/flag:prepareWebsiteFlag", afterFailedStep: false },
  { run: "pnpm exec convex run quests/pendingCrates:backfillPendingCrates", afterFailedStep: true },
];
const commands = steps.map((step) => step.run);

let stateDir: string;
let leases: Leases;
beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "sandbox-deploy-"));
  leases = memoryLeases();
});
afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

type SandboxSetup = { functions?: string[]; tables?: string[]; dryRun?: Partial<DryRun>; served?: string; failOn?: string; holdFirstStep?: boolean };

function fakeSandbox({ functions = ["a.js:f"], tables = ["t"], dryRun = {}, served, failOn, holdFirstStep }: SandboxSetup = {}) {
  const ran: string[] = [];
  let bundle = "OLD";
  let finishFirstStep = () => {};
  const firstStepHeld = new Promise<void>((resolve) => (finishFirstStep = resolve));
  const sandbox: Sandbox = {
    name: "different-dog-467",
    served: async () => ({ functions, tables }),
    dryRun: async () => {
      ran.push("dry run");
      return { target: "https://different-dog-467.convex.cloud", droppedIndexes: [], ...dryRun };
    },
    run: async (step) => {
      ran.push(step);
      if (holdFirstStep && step === commands[0]) await firstStepHeld;
      if (failOn && step.includes(failOn)) throw new Error(`${failOn} failed`);
      if (step.includes("upload")) bundle = served ?? "NEW";
    },
    servedBundle: async () => bundle,
  };
  return { sandbox, ran, finishFirstStep, setBundle: (next: string) => (bundle = next) };
}

const checkout = (identity: Partial<Identity> = {}): Checkout => ({
  worktree: "/work/a",
  identity: () => ({ branch: "lane/a", sha: "abc1234", dirty: false, ...identity }),
  inventory: async () => ({ functions: ["a.js:f"], tables: ["t"] }),
  builtBundle: () => "NEW",
});

const lanesDefining = (definers: Record<string, string[]>): Lanes => ({
  defining: async (item: Item) => (definers[item.name] ?? []).map((name) => ({ name })),
});

function memoryLeases(): Leases {
  let holder: Owner | undefined;
  return {
    take(owner) {
      if (holder) return { holder };
      holder = owner;
      return { release: () => (holder = undefined) };
    },
    holder: () => holder,
  };
}

function portsWith(sandbox: Sandbox, overrides: Partial<Ports> = {}) {
  const lines: string[] = [];
  const ports: Ports = {
    sandbox,
    checkout: checkout(),
    lanes: lanesDefining({}),
    leases,
    pause: async () => {},
    log: (line) => lines.push(line),
    now: () => new Date("2026-10-24T10:00:00Z"),
    ...overrides,
  };
  return { ports, output: () => lines.join("\n") };
}

const options = (overrides: Partial<Parameters<typeof deploySandbox>[0]> = {}) => ({
  stateDir,
  steps,
  wait: false,
  dryRun: false,
  drop: [],
  thread: "thread-a",
  ...overrides,
});

async function statusOf(sandbox: Sandbox, overrides: Partial<Ports> = {}) {
  const { ports, output } = portsWith(sandbox, overrides);
  return { code: await sandboxStatus(stateDir, ports), output: output() };
}

async function deployHeldAtItsFirstStep(branch: string, thread: string) {
  const held = fakeSandbox({ holdFirstStep: true });
  const deploy = deploySandbox(options({ thread }), portsWith(held.sandbox, { checkout: checkout({ branch }) }).ports);
  await until(() => held.ran.length > 1);
  return {
    finish: async () => {
      held.finishFirstStep();
      return deploy;
    },
  };
}

describe("deploying a tree to the shared sandbox", () => {
  test("dry-runs, runs the workflow's steps in order, checks the served bundle, and says what is live", async () => {
    const { sandbox, ran } = fakeSandbox();
    const { ports, output } = portsWith(sandbox);

    expect(await deploySandbox(options(), ports)).toBe(0);

    expect(ran).toEqual(["dry run", ...commands]);
    expect(output()).toContain("sandbox live: lane/a@abc1234 bundle NEW");
  });

  test("refuses a tree with uncommitted changes, so the record names what the sandbox serves", async () => {
    const { sandbox, ran } = fakeSandbox();
    const { ports, output } = portsWith(sandbox, { checkout: checkout({ dirty: true }) });

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(ran).toEqual(["dry run"]);
    expect(output()).toContain("refusing to deploy: lane/a@abc1234 has uncommitted changes");
  });

  test("stops after the checks and the Convex dry run with --dry-run, uncommitted changes and all", async () => {
    const { sandbox, ran } = fakeSandbox();
    const { ports, output } = portsWith(sandbox, { checkout: checkout({ dirty: true }) });

    expect(await deploySandbox(options({ dryRun: true }), ports)).toBe(0);

    expect(ran).toEqual(["dry run"]);
    expect(output()).toContain("dry run passed, nothing deployed");
  });

  test("refuses a dry run that targets another deployment", async () => {
    const { sandbox, ran } = fakeSandbox({ dryRun: { target: "https://affable-bat-254.convex.cloud" } });
    const { ports, output } = portsWith(sandbox);

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(ran).toEqual(["dry run"]);
    expect(output()).toContain("the dry run targets https://affable-bat-254.convex.cloud, not different-dog-467");
  });

  test("after a later step fails, still runs the steps the workflow runs after a failure, then fails", async () => {
    const { sandbox, ran } = fakeSandbox({ failOn: "upload" });

    await expect(deploySandbox(options(), portsWith(sandbox).ports)).rejects.toThrow("upload failed");

    expect(ran).toEqual(["dry run", commands[0], commands[1], commands[3]]);
  });

  test("fails without recording a live deploy when the sandbox serves another bundle than the one built", async () => {
    const { sandbox } = fakeSandbox({ served: "SOMEONE-ELSES" });
    const { ports, output } = portsWith(sandbox);

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(output()).toContain("the sandbox serves bundle SOMEONE-ELSES, not the NEW this tree built");
    expect((await statusOf(sandbox)).output).toContain("last deploy: lane/a@abc1234 started 2026-10-24T10:00:00.000Z, thread thread-a and did not finish");
  });
});

describe("status", () => {
  test("prints the last deploy, so a lane can check its tree is live right before a proof", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);

    const { code, output } = await statusOf(sandbox);

    expect(code).toBe(0);
    expect(output).toContain("last deploy: lane/a@abc1234 bundle NEW at 2026-10-24T10:00:00.000Z, thread thread-a");
    expect(output).toContain("this tree is live");
  });

  test("refuses a tree that isn't the one live", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);

    const { code, output } = await statusOf(sandbox, { checkout: checkout({ branch: "lane/b", sha: "def5678" }) });

    expect(code).toBe(1);
    expect(output).toContain("this tree (lane/b@def5678) is not live: lane/a@abc1234 is");
  });

  test("refuses the live tree once it has uncommitted changes", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);

    const { code, output } = await statusOf(sandbox, { checkout: checkout({ dirty: true }) });

    expect(code).toBe(1);
    expect(output).toContain("this tree (lane/a@abc1234 with uncommitted changes) is not live");
  });

  test("says when the sandbox serves a bundle the last deploy didn't upload", async () => {
    const { sandbox, setBundle } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);
    setBundle("OTHER");

    const { code, output } = await statusOf(sandbox);

    expect(code).toBe(1);
    expect(output).toContain("served bundle OTHER is not the last deploy's NEW: it was deployed without sandbox-deploy or from another machine");
  });

  test("refuses while a deploy runs, even over a tree that was live", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);
    const running = await deployHeldAtItsFirstStep("lane/b", "thread-b");

    const { code, output } = await statusOf(sandbox);

    expect(code).toBe(1);
    expect(output).toContain("a deploy is running: lane/b@abc1234");
    await running.finish();
  });

  test("says when the last deploy didn't finish", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);
    const failing = fakeSandbox({ failOn: "upload" });
    await expect(deploySandbox(options({ thread: "thread-b" }), portsWith(failing.sandbox, { checkout: checkout({ branch: "lane/b" }) }).ports)).rejects.toThrow();

    const { code, output } = await statusOf(sandbox);

    expect(code).toBe(1);
    expect(output).toContain("last deploy: lane/b@abc1234 started 2026-10-24T10:00:00.000Z, thread thread-b and did not finish");
  });
});

describe("the lease", () => {
  test("refuses while another lane holds it, naming that lane's branch and thread", async () => {
    const first = await deployHeldAtItsFirstStep("lane/a", "thread-a");

    const second = fakeSandbox();
    const { ports, output } = portsWith(second.sandbox, { checkout: checkout({ branch: "lane/b" }) });
    expect(await deploySandbox(options({ thread: "thread-b" }), ports)).toBe(1);

    expect(second.ran).toEqual([]);
    expect(output()).toContain("lane/a@abc1234 (thread thread-a, worktree /work/a) holds the sandbox lease");
    expect(await first.finish()).toBe(0);
  });

  test("with --wait, waits until the holder is done, then deploys", async () => {
    const first = await deployHeldAtItsFirstStep("lane/a", "thread-a");

    const second = fakeSandbox();
    const pause = async () => void (await first.finish());
    const { ports, output } = portsWith(second.sandbox, { checkout: checkout({ branch: "lane/b" }), pause });
    expect(await deploySandbox(options({ wait: true }), ports)).toBe(0);

    expect(output()).toContain("waiting for lane/a@abc1234");
    expect(second.ran).toEqual(["dry run", ...commands]);
  });
});

describe("what the sandbox serves and the tree doesn't define", () => {
  test("refuses to drop a function or a table a live lane defines, names the lanes, and touches nothing", async () => {
    const { sandbox, ran } = fakeSandbox({ functions: ["a.js:f", "album/week.js:getAlbumWeek"], tables: ["t", "pairTallies"] });
    const lanes = lanesDefining({ "album/week.js:getAlbumWeek": ["album/2", "album/6"], pairTallies: ["album/2"] });
    const { ports, output } = portsWith(sandbox, { lanes });

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(ran).toEqual([]);
    expect(output()).toContain("function album/week.js:getAlbumWeek, defined on album/2, album/6");
    expect(output()).toContain("table pairTallies, defined on album/2");
  });

  test("refuses an index drop from the dry run that a live lane defines", async () => {
    const { sandbox, ran } = fakeSandbox({ dryRun: { droppedIndexes: ["teamStickers.by_member_team"] } });
    const lanes = lanesDefining({ "teamStickers.by_member_team": ["album/6"] });
    const { ports, output } = portsWith(sandbox, { lanes });

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(ran).toEqual(["dry run"]);
    expect(output()).toContain("index teamStickers.by_member_team, defined on album/6");
  });

  test("leaves out what no live lane defines, and what --drop names", async () => {
    const { sandbox, ran } = fakeSandbox({ functions: ["a.js:f", "old.js:retired", "album/week.js:getAlbumWeek"] });
    const lanes = lanesDefining({ "album/week.js:getAlbumWeek": ["album/2"] });
    const { ports, output } = portsWith(sandbox, { lanes });

    expect(await deploySandbox(options({ drop: ["album/week.js:getAlbumWeek"] }), ports)).toBe(0);

    expect(ran).toEqual(["dry run", ...commands]);
    expect(output()).toContain("leaving out what no live lane defines: function old.js:retired");
    expect(output()).toContain("leaving out function album/week.js:getAlbumWeek: --drop names it");
  });
});

async function until(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 1));
}
