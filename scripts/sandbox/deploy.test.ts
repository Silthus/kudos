// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { deploySandbox, sandboxStatus, type Checkout, type DryRun, type Item, type Lanes, type Ports, type Sandbox } from "./deploy";
import { takeLease } from "./lease";

const steps = ["pnpm exec convex deploy -y", "pnpm exec static-hosting upload", "pnpm exec convex run website/flag:prepareWebsiteFlag"];

let stateDir: string;
beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "sandbox-deploy-"));
});
afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

type SandboxSetup = { functions?: string[]; tables?: string[]; dryRun?: Partial<DryRun>; served?: string; onStep?: (step: string) => Promise<void> };

function fakeSandbox({ functions = ["a.js:f"], tables = ["t"], dryRun = {}, served, onStep }: SandboxSetup = {}) {
  const ran: string[] = [];
  let bundle = "OLD";
  const sandbox: Sandbox = {
    name: "different-dog-467",
    served: async () => ({ functions, tables }),
    dryRun: async () => {
      ran.push("dry run");
      return { target: "https://different-dog-467.convex.cloud", droppedIndexes: [], ...dryRun };
    },
    run: async (step) => {
      ran.push(step);
      await onStep?.(step);
      if (step.includes("upload")) bundle = served ?? "NEW";
    },
    servedBundle: async () => bundle,
  };
  return { sandbox, ran, setBundle: (next: string) => (bundle = next) };
}

const checkout = (overrides: Partial<Checkout> = {}): Checkout => ({
  branch: "lane/a",
  sha: "abc1234",
  worktree: "/work/a",
  inventory: async () => ({ functions: ["a.js:f"], tables: ["t"] }),
  builtBundle: () => "NEW",
  ...overrides,
});

const lanesDefining = (definers: Record<string, string[]>): Lanes => ({
  defining: async (item: Item) => (definers[item.name] ?? []).map((name) => ({ name })),
});

function portsWith(sandbox: Sandbox, overrides: Partial<Ports> = {}) {
  const lines: string[] = [];
  const ports: Ports = {
    sandbox,
    checkout: checkout(),
    lanes: lanesDefining({}),
    isAlive: () => true,
    pause: async () => {},
    log: (line) => lines.push(line),
    now: () => new Date("2026-10-24T10:00:00Z"),
    ...overrides,
  };
  return { ports, lines, output: () => lines.join("\n") };
}

const options = (overrides: Partial<Parameters<typeof deploySandbox>[0]> = {}) => ({
  stateDir,
  steps,
  wait: false,
  dryRun: false,
  drop: [],
  thread: "thread-a",
  pid: 100,
  ...overrides,
});

describe("deploying a tree to the shared sandbox", () => {
  test("dry-runs, runs the workflow's steps in order, checks the served bundle, and says what is live", async () => {
    const { sandbox, ran } = fakeSandbox();
    const { ports, output } = portsWith(sandbox);

    expect(await deploySandbox(options(), ports)).toBe(0);

    expect(ran).toEqual(["dry run", ...steps]);
    expect(output()).toContain("sandbox live: lane/a@abc1234 bundle NEW");
  });

  test("status prints the last deploy, so a lane can check its tree is live right before capturing", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);

    const status = portsWith(sandbox);
    expect(await sandboxStatus(stateDir, status.ports)).toBe(0);

    expect(status.output()).toContain("last deploy: lane/a@abc1234 bundle NEW at 2026-10-24T10:00:00.000Z, thread thread-a");
    expect(status.output()).toContain("this tree is live");
  });

  test("status refuses a tree that isn't the one live", async () => {
    const { sandbox } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);

    const status = portsWith(sandbox, { checkout: checkout({ branch: "lane/b", sha: "def5678" }) });
    expect(await sandboxStatus(stateDir, status.ports)).toBe(1);

    expect(status.output()).toContain("this tree (lane/b@def5678) is not live: lane/a@abc1234 is");
  });

  test("status says when the sandbox serves a bundle the last deploy didn't upload", async () => {
    const { sandbox, setBundle } = fakeSandbox();
    await deploySandbox(options(), portsWith(sandbox).ports);
    setBundle("OTHER");

    const status = portsWith(sandbox);
    expect(await sandboxStatus(stateDir, status.ports)).toBe(1);

    expect(status.output()).toContain("served bundle OTHER is not the last deploy's NEW: someone deployed without sandbox-deploy");
  });

  test("fails and records nothing when the sandbox serves another bundle than the one built", async () => {
    const { sandbox } = fakeSandbox({ served: "SOMEONE-ELSES" });
    const { ports, output } = portsWith(sandbox);

    expect(await deploySandbox(options(), ports)).toBe(1);

    expect(output()).toContain("the sandbox serves bundle SOMEONE-ELSES, not the NEW this tree built");
    const status = portsWith(sandbox);
    await sandboxStatus(stateDir, status.ports);
    expect(status.output()).toContain("last deploy: none recorded");
  });

  test("stops after the checks and the Convex dry run with --dry-run", async () => {
    const { sandbox, ran } = fakeSandbox();
    const { ports, output } = portsWith(sandbox);

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
});

describe("the lease", () => {
  test("refuses while another lane holds it, naming that lane's branch and thread", async () => {
    let finishFirst!: () => void;
    const first = fakeSandbox({ onStep: (step) => (step === steps[0] ? new Promise<void>((resolve) => (finishFirst = resolve)) : Promise.resolve()) });
    const firstDeploy = deploySandbox(options(), portsWith(first.sandbox).ports);
    await until(() => first.ran.length > 1);

    const second = fakeSandbox();
    const { ports, output } = portsWith(second.sandbox, { checkout: checkout({ branch: "lane/b" }) });
    expect(await deploySandbox(options({ pid: 200, thread: "thread-b" }), ports)).toBe(1);

    expect(second.ran).toEqual([]);
    expect(output()).toContain("lane/a@abc1234 holds the sandbox lease (thread thread-a, worktree /work/a)");
    finishFirst();
    expect(await firstDeploy).toBe(0);
  });

  test("with --wait, waits until the holder is done, then deploys", async () => {
    let finishFirst!: () => void;
    const first = fakeSandbox({ onStep: (step) => (step === steps[0] ? new Promise<void>((resolve) => (finishFirst = resolve)) : Promise.resolve()) });
    const firstDeploy = deploySandbox(options(), portsWith(first.sandbox).ports);
    await until(() => first.ran.length > 1);

    const second = fakeSandbox();
    const pause = async () => {
      finishFirst();
      await firstDeploy;
    };
    const { ports, output } = portsWith(second.sandbox, { checkout: checkout({ branch: "lane/b" }), pause });
    expect(await deploySandbox(options({ pid: 200, wait: true }), ports)).toBe(0);

    expect(output()).toContain("waiting for lane/a@abc1234");
    expect(second.ran).toEqual(["dry run", ...steps]);
  });

  test("takes over a lease whose holder's process is gone", async () => {
    takeLease(stateDir, { branch: "lane/gone", sha: "0000000", worktree: "/work/gone", pid: 111, since: "2026-10-24T09:00:00.000Z" }, () => true);
    const { sandbox, ran } = fakeSandbox();
    const { ports } = portsWith(sandbox, { isAlive: (pid) => pid !== 111 });

    expect(await deploySandbox(options(), ports)).toBe(0);

    expect(ran).toEqual(["dry run", ...steps]);
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

    expect(ran).toEqual(["dry run", ...steps]);
    expect(output()).toContain("leaving out what no live lane defines: function old.js:retired");
    expect(output()).toContain("leaving out function album/week.js:getAlbumWeek: --drop names it");
  });
});

async function until(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 1));
}
