// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";

type Step = { run?: string; uses?: string; with?: Record<string, unknown> };
type Job = { steps?: Step[]; uses?: string; strategy?: { matrix: { shard: number[] } } };
type Workflow = { on: unknown; jobs: Record<string, Job> };

function workflowOf(file: string) {
  return parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")) as Workflow;
}

const workflow = workflowOf("gate.yml");
const suite = workflowOf("gate-suite.yml");
const gateCommands = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).scripts.gate as string).split(" && ");

function jobRunning(command: string, { jobs } = workflow) {
  return Object.entries(jobs).find(([, job]) => job.steps?.some((step) => step.run === command));
}

test("the suite runs every command of pnpm gate, with the tests split into shards that together run every test file", () => {
  expect(gateCommands).toEqual(["pnpm typecheck", "pnpm test", "pnpm coherence"]);
  expect(jobRunning("pnpm typecheck", suite)).toBeDefined();
  expect(jobRunning("pnpm coherence", suite)).toBeDefined();

  const [, tests] = jobRunning("pnpm test --shard=${{ matrix.shard }}/${{ strategy.job-total }}", suite) ?? [];
  const shards = tests?.strategy?.matrix.shard ?? [];
  expect(shards.length).toBeGreaterThanOrEqual(2);
  expect(shards).toEqual(shards.map((_, index) => index + 1));
});

test("a pull request waits on one gate check, which runs the suite on the pull request's own commit and is green only when every part of it passed", () => {
  const callers = Object.entries(workflow.jobs).filter(([, job]) => job.uses === "./.github/workflows/gate-suite.yml");
  const gate = workflow.jobs.gate as Job & { needs?: string; if?: string; env?: Record<string, string> };

  expect(callers).toHaveLength(1);
  const [suiteJob, { with: inputs }] = callers[0] as [string, Job & { with?: unknown }];
  expect(inputs).toBeUndefined();
  expect(gate.needs).toBe(suiteJob);
  expect(gate.if).toBe("${{ always() }}");
  expect(gate.steps).toEqual([{ run: 'test "$SUITE" = success', env: { SUITE: `\${{ needs.${suiteJob}.result }}` } }]);
});

test("the sign-in handshake runs on every pull request and every push to main, in its own job beside the gate", () => {
  const handshake = jobRunning("pnpm test:handshake");

  expect(workflow.on).toEqual({ pull_request: null, push: { branches: ["main"] } });
  expect(handshake).toBeDefined();
  expect(handshake?.[1].uses).toBeUndefined();
  expect(handshake?.[1].steps?.find((step) => step.uses?.startsWith("actions/checkout@"))?.with).toMatchObject({ "persist-credentials": false });
});
