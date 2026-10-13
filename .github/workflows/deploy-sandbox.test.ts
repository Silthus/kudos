// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";

type Step = { id?: string; name?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = { env?: Record<string, string>; steps: Step[] };
type Workflow = {
  on: unknown;
  env?: Record<string, string>;
  permissions: unknown;
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<string, Job>;
};

const workflow = parse(readFileSync(new URL("./deploy-sandbox.yml", import.meta.url), "utf8")) as Workflow;
const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
const deployStep = steps.find((step) => step.run?.includes("convex deploy"));

test("only a push to the integration branch deploys, never a pull request", () => {
  expect(workflow.on).toEqual({ push: { branches: ["spec/core-loop"] } });
});

test("the deploy key comes from the GitHub secret and reaches only the deploy step", () => {
  expect(deployStep?.env).toEqual({ CONVEX_DEPLOY_KEY: "${{ secrets.CONVEX_DEPLOY_KEY_SANDBOX }}" });
  const elsewhere = [workflow.env, ...Object.values(workflow.jobs).map((job) => job.env), ...steps.filter((step) => step !== deployStep)];
  expect(JSON.stringify(elsewhere)).not.toContain("secrets.");
});

test("the workflow reads the repository and nothing more, and keeps no git credentials", () => {
  expect(workflow.permissions).toEqual({ contents: "read" });
  const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  expect(checkout?.with).toMatchObject({ "persist-credentials": false });
});

test("the gate passes before the deploy runs", () => {
  const gate = steps.findIndex((step) => step.run === "pnpm gate");
  expect(gate).toBeGreaterThanOrEqual(0);
  expect(steps.indexOf(deployStep!)).toBeGreaterThan(gate);
});

test("deploys run one at a time and a running deploy is never cancelled", () => {
  expect(workflow.concurrency).toEqual({ group: "deploy-sandbox", "cancel-in-progress": false });
});

test("a run the branch has already moved past deploys nothing, so a rerun never rolls the sandbox back", () => {
  const tipCheck = steps[steps.indexOf(deployStep!) - 1];
  expect(tipCheck?.run).toContain('git ls-remote origin "$GITHUB_REF"');
  expect(deployStep?.if).toBe(`steps.${tipCheck?.id}.outputs.current == 'true'`);
});
