// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
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

const deployments = [
  { name: "sandbox", file: "deploy-sandbox.yml", branch: "spec/core-loop", secret: "CONVEX_DEPLOY_KEY_SANDBOX" },
  { name: "production", file: "deploy-production.yml", branch: "main", secret: "CONVEX_DEPLOY_KEY_PRODUCTION" },
];

describe.each(deployments)("deploying the $name deployment", ({ name, file, branch, secret }) => {
  const workflow = parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")) as Workflow;
  const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
  const deployStep = steps.find((step) => step.run?.includes("convex deploy"));
  const uploadStep = steps.find((step) => step.run?.includes("static-hosting upload"));
  const prepareStep = steps.find((step) => step.run?.includes("website/flag:prepareWebsiteFlag"));
  const keyedSteps = [deployStep, uploadStep, prepareStep];

  test(`only a push to ${branch} deploys, never a pull request`, () => {
    expect(workflow.on).toEqual({ push: { branches: [branch] } });
  });

  test("WS27: the deploy key comes from its GitHub secret and reaches only the deploy, the website upload and prepareWebsiteFlag", () => {
    for (const step of keyedSteps) expect(step?.env).toEqual({ CONVEX_DEPLOY_KEY: `\${{ secrets.${secret} }}` });
    const elsewhere = [workflow.env, ...Object.values(workflow.jobs).map((job) => job.env), ...steps.filter((step) => !keyedSteps.includes(step))];
    expect(JSON.stringify(elsewhere)).not.toContain("secrets.");
  });

  test("WS27: after convex deploy, the website is built against this deployment and uploaded to its static hosting", () => {
    expect(steps.indexOf(uploadStep!)).toBeGreaterThan(steps.indexOf(deployStep!));
    expect(uploadStep?.run).toBe('pnpm exec static-hosting upload --build --build-command "pnpm website:build" --dist website/dist');
  });

  test("WS2 WS27: every deploy runs prepareWebsiteFlag on this deployment once the website is uploaded", () => {
    expect(steps.indexOf(prepareStep!)).toBeGreaterThan(steps.indexOf(uploadStep!));
    expect(prepareStep?.run).toBe("pnpm exec convex run website/flag:prepareWebsiteFlag");
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
    expect(workflow.concurrency).toEqual({ group: `deploy-${name}`, "cancel-in-progress": false });
  });

  test("a run the branch has already moved past deploys nothing, so a rerun never rolls the deployment back", () => {
    const tipCheck = steps[steps.indexOf(deployStep!) - 1];
    expect(tipCheck?.run).toContain('git ls-remote origin "$GITHUB_REF"');
    for (const step of keyedSteps) expect(step?.if).toBe(`steps.${tipCheck?.id}.outputs.current == 'true'`);
  });
});
