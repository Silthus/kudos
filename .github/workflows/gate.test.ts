// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";

type Step = { run?: string; uses?: string; with?: Record<string, unknown> };
type Workflow = { on: unknown; jobs: Record<string, { steps: Step[] }> };

const workflow = parse(readFileSync(new URL("./gate.yml", import.meta.url), "utf8")) as Workflow;

function jobRunning(command: string) {
  return Object.entries(workflow.jobs).find(([, job]) => job.steps.some((step) => step.run === command));
}

test("the sign-in handshake runs on every pull request and every push to main, in its own job beside the gate", () => {
  const gate = jobRunning("pnpm gate");
  const handshake = jobRunning("pnpm test:handshake");

  expect(workflow.on).toEqual({ pull_request: null, push: { branches: ["main"] } });
  expect(handshake).toBeDefined();
  expect(handshake?.[0]).not.toBe(gate?.[0]);
  expect(handshake?.[1].steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with).toMatchObject({ "persist-credentials": false });
});
