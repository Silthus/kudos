// @vitest-environment node
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const leaseModule = fileURLToPath(new URL("./lease.ts", import.meta.url));
const owner = { branch: "lane/a", sha: "abc1234", worktree: "/work/a", thread: "thread-a", since: "2026-10-24T10:00:00.000Z" };

let stateDir: string;
const started: ChildProcess[] = [];
beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "sandbox-lease-"));
});
afterEach(() => {
  for (const child of started) child.kill("SIGKILL");
  spawnSync("pkill", ["-KILL", "-f", `sandbox-lease-step ${stateDir}`]);
  rmSync(stateDir, { recursive: true, force: true });
});

function bun(script: string) {
  return spawnSync("bun", ["-e", `import { kernelLeases } from ${JSON.stringify(leaseModule)}; const leases = kernelLeases(${JSON.stringify(stateDir)}); ${script}`], { encoding: "utf8" });
}

const holderSeenByAnotherDeploy = () => JSON.parse(bun(`console.log(JSON.stringify(leases.take(${JSON.stringify({ ...owner, branch: "lane/b" })})))`).stdout);
const holderSeenByStatus = () => JSON.parse(bun("console.log(JSON.stringify(leases.holder() ?? null))").stdout);

async function holdWhileAStepRuns() {
  const script = `
    import { spawnSync } from "node:child_process";
    import { kernelLeases } from ${JSON.stringify(leaseModule)};
    const leases = kernelLeases(${JSON.stringify(stateDir)});
    leases.take(${JSON.stringify(owner)});
    console.log("held");
    spawnSync("bash", ["-c", "exec -a 'sandbox-lease-step ${stateDir}' sleep 30"], { stdio: ["ignore", "ignore", "ignore", leases.descriptor()] });
  `;
  const holder = spawn("bun", ["-e", script], { stdio: ["ignore", "pipe", "inherit"] });
  started.push(holder);
  await new Promise<void>((resolve) => holder.stdout!.once("data", () => resolve()));
  await new Promise((resolve) => setTimeout(resolve, 200));
  return holder;
}

describe("the sandbox lease", () => {
  test("refuses another deploy while a deploy holds it, and names the holder", async () => {
    await holdWhileAStepRuns();

    expect(holderSeenByAnotherDeploy()).toEqual({ holder: owner });
    expect(holderSeenByStatus()).toEqual(owner);
  });

  test("stays held while a step the holder started runs, even after the holder is killed", async () => {
    const holder = await holdWhileAStepRuns();
    holder.kill("SIGKILL");
    await new Promise((resolve) => holder.once("exit", resolve));

    expect(holderSeenByAnotherDeploy()).toEqual({ holder: owner });
  });

  test("frees once the holder and its steps are gone", async () => {
    const holder = await holdWhileAStepRuns();
    holder.kill("SIGKILL");
    spawnSync("pkill", ["-KILL", "-f", `sandbox-lease-step ${stateDir}`]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(holderSeenByStatus()).toBeNull();
    expect(bun(`const lease = leases.take(${JSON.stringify(owner)}); console.log("release" in lease)`).stdout.trim()).toBe("true");
  });
});
