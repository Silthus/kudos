// @vitest-environment node
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const gateLane = new URL("./gate-lane.sh", import.meta.url).pathname;

let box: string;

beforeEach(() => {
  box = mkdtempSync(join(tmpdir(), "gate-lane-"));
  stub("nproc", "echo 16");
  stub("pnpm", `echo "$LANE $*" >> "${ranLog()}"; while [ -e "${box}/hold-$LANE" ]; do sleep 0.05; done; [ "$1" = "$FAILING" ] && exit 3; exit 0`);
});

afterEach(() => {
  rmSync(box, { recursive: true, force: true });
});

function stub(command: string, body: string) {
  writeFileSync(join(box, command), `#!/bin/sh\n${body}\n`);
  chmodSync(join(box, command), 0o755);
}

function ranLog() {
  return join(box, "ran.log");
}

function ran(lane = "lane") {
  if (!existsSync(ranLog())) return [];
  return readFileSync(ranLog(), "utf8")
    .split("\n")
    .filter((line) => line.startsWith(`${lane} `))
    .map((line) => line.slice(lane.length + 1));
}

function runLane({ lane = "lane", failing = "" } = {}) {
  const child = spawn("bash", [gateLane], {
    env: { PATH: `${box}:${process.env.PATH}`, GATE_LANE_LOCK_DIR: join(box, "locks"), LANE: lane, FAILING: failing },
    stdio: "ignore",
  });
  return new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
}

function hold(lane: string) {
  writeFileSync(join(box, `hold-${lane}`), "");
}

function release(lane: string) {
  rmSync(join(box, `hold-${lane}`));
}

async function until(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("pnpm gate:lane, the lane's fast gate", () => {
  test("runs the guards first, then the typecheck, the tests the change touches since it left origin/main with half the box's cores, and Coherence's checks", async () => {
    expect(await runLane()).toBe(0);

    expect(ran()).toEqual(["test:guards", "typecheck", "test --changed origin/main --project !guards --maxWorkers=8", "coherence"]);
  });

  test("stops at the first check that fails and exits with its code", async () => {
    expect(await runLane({ failing: "typecheck" })).toBe(3);

    expect(ran()).toEqual(["test:guards", "typecheck"]);
  });

  test("at most two lanes gate at once on the box; a third waits until one finishes", async () => {
    hold("first");
    hold("second");
    const first = runLane({ lane: "first" });
    const second = runLane({ lane: "second" });
    await until(() => ran("first").length > 0 && ran("second").length > 0);

    const third = runLane({ lane: "third" });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(ran("third")).toEqual([]);

    release("first");
    expect(await first).toBe(0);
    expect(await third).toBe(0);
    expect(ran("third")).toHaveLength(4);
    release("second");
    expect(await second).toBe(0);
  }, 20_000);
});
