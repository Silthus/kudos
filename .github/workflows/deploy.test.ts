// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { runStep } from "./workflowStep";

type Step = { id?: string; name?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = { env?: Record<string, string>; if?: string; needs?: string | string[]; uses?: string; with?: Record<string, unknown>; outputs?: Record<string, string>; steps?: Step[] };
type Workflow = {
  name: string;
  on: unknown;
  env?: Record<string, string>;
  permissions: unknown;
  concurrency: { group: string; "cancel-in-progress": boolean; queue?: string };
  jobs: Record<string, Job>;
};

function workflowOf(file: string) {
  return parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")) as Workflow;
}

function deployJobOf(workflow: Workflow) {
  return Object.values(workflow.jobs).find((job) => job.steps?.some((step) => step.run?.includes("convex deploy")));
}

function needsOf(job: Job | undefined) {
  return [job?.needs ?? []].flat();
}

function checkoutOf(job: Job | undefined) {
  return job?.steps?.find((step) => step.uses?.startsWith("actions/checkout@"));
}

const gateSuite = "./.github/workflows/gate-suite.yml";

const deployments = [
  {
    name: "sandbox",
    file: "deploy-sandbox.yml",
    trigger: "only a run started by hand deploys, never a push or a pull request",
    on: { workflow_dispatch: null },
    secret: "CONVEX_DEPLOY_KEY_SANDBOX",
    backfill: `pnpm exec convex run quests/pendingCrates:backfillPendingCrates '{"restart":true}'`,
  },
  {
    name: "production",
    file: "deploy-production.yml",
    trigger: "only main's Gate finishing starts a deploy, never a push or a pull request",
    on: { workflow_run: { workflows: [workflowOf("gate.yml").name], types: ["completed"], branches: ["main"] } },
    secret: "CONVEX_DEPLOY_KEY_PRODUCTION",
    backfill: "pnpm exec convex run quests/pendingCrates:backfillPendingCrates",
  },
];

describe.each(deployments)("deploying the $name deployment", ({ name, file, trigger, on, secret, backfill }) => {
  const workflow = workflowOf(file);
  const deployJob = deployJobOf(workflow);
  const steps = deployJob?.steps ?? [];
  const deployStep = steps.find((step) => step.run?.includes("convex deploy"));
  const uploadStep = steps.find((step) => step.run?.includes("static-hosting upload"));
  const prepareStep = steps.find((step) => step.run?.includes("website/flag:prepareWebsiteFlag"));
  const faceSyncStep = steps.find((step) => step.run?.includes("companyProfiles/sync:syncCompanyProfiles"));
  const pendingCratesStep = steps.find((step) => step.run?.includes("quests/pendingCrates:backfillPendingCrates"));
  const emojiNamesStep = steps.find((step) => step.run?.includes("album/emojiNames:reserveSharedEmojiNames"));
  const keyedSteps = [deployStep, pendingCratesStep, uploadStep, prepareStep, faceSyncStep, emojiNamesStep];

  test(trigger, () => {
    expect(workflow.on).toEqual(on);
  });

  test("WS27: the deploy key comes from its GitHub secret and reaches only the deploy, the pending-crate backfill, the website upload, prepareWebsiteFlag, the face sync and the emoji name reservation", () => {
    for (const step of keyedSteps) expect(step?.env).toEqual({ CONVEX_DEPLOY_KEY: `\${{ secrets.${secret} }}` });
    const elsewhere = JSON.stringify(workflow, (_, value) => (keyedSteps.includes(value) ? undefined : value));
    expect(elsewhere).not.toContain("secrets");
  });

  test("P85: every deploy backfills the pending-crate index last, so a failing backfill never holds back the website, and runs it whenever the backend deployed", () => {
    expect(steps.at(-1)).toBe(pendingCratesStep);
    expect(pendingCratesStep?.run).toBe(backfill);
    expect(pendingCratesStep?.if).toBe(`\${{ !cancelled() && steps.${deployStep?.id}.outcome == 'success' }}`);
    expect(deployStep?.id).toBe("deploy");
  });

  test("WS27: after convex deploy, the website is built against this deployment and uploaded to its static hosting", () => {
    expect(steps.indexOf(uploadStep!)).toBeGreaterThan(steps.indexOf(deployStep!));
    expect(uploadStep?.run).toBe('pnpm exec static-hosting upload --build --build-command "pnpm website:build" --dist website/dist');
  });

  test("WS2 WS27: every deploy runs prepareWebsiteFlag on this deployment once the website is uploaded", () => {
    expect(steps.indexOf(prepareStep!)).toBeGreaterThan(steps.indexOf(uploadStep!));
    expect(prepareStep?.run).toBe("pnpm exec convex run website/flag:prepareWebsiteFlag");
  });

  test("WS22 WS27: every deploy reads the company profiles once after prepareWebsiteFlag, so faces don't wait for the 04:00 UTC run", () => {
    expect(steps.indexOf(faceSyncStep!)).toBeGreaterThan(steps.indexOf(prepareStep!));
    expect(faceSyncStep?.run).toBe("pnpm exec convex run companyProfiles/sync:syncCompanyProfiles");
    expect(faceSyncStep?.if).toBe(prepareStep?.if);
  });

  test("LP71: every deploy reserves the shared emoji names in every workspace whose registry is in use, after the face sync, so a new shared name never waits for a company sync", () => {
    expect(steps.indexOf(emojiNamesStep!)).toBeGreaterThan(steps.indexOf(faceSyncStep!));
    expect(emojiNamesStep?.run).toBe("pnpm exec convex run album/emojiNames:reserveSharedEmojiNames");
  });

  test("the workflow reads the repository and nothing more, and keeps no git credentials", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    const jobsWithSteps = Object.values(workflow.jobs).filter((job) => job.steps);
    expect(jobsWithSteps.length).toBeGreaterThan(1);
    for (const job of jobsWithSteps) expect(checkoutOf(job)?.with).toMatchObject({ "persist-credentials": false });
  });

  test("deploys run one at a time and a running deploy is never cancelled", () => {
    expect(workflow.concurrency).toMatchObject({ group: `deploy-${name}`, "cancel-in-progress": false });
  });

  test("every run reads the branch's tip as it stands when the run starts, and the deploy job deploys only that commit", () => {
    const tip = workflow.jobs.tip;
    expect(needsOf(deployJob)).toContain("tip");
    expect(checkoutOf(deployJob)?.with).toMatchObject({ ref: "${{ needs.tip.outputs.sha }}" });
    expect(checkoutOf(tip)?.with).toMatchObject({ ref: "${{ github.ref }}" });
    expect(tip?.outputs?.sha).toBe("${{ steps.tip.outputs.sha }}");
    const checkedOut = "c".repeat(40);
    const resolved = runStep(tip!.steps!.find((step) => step.id === "tip")!.run!, { git: `[ "$*" = "rev-parse HEAD" ] && echo ${checkedOut}` });
    expect(resolved).toEqual({ status: 0, output: `sha=${checkedOut}\n` });
    for (const step of keyedSteps.filter((step) => step !== pendingCratesStep)) expect(step?.if).toBeUndefined();
  });

  test("re-running only the failed jobs keeps the first attempt's commit, so it deploys only while that commit is still the branch's tip and never rolls the deployment back", () => {
    expect(workflow.jobs.tip?.outputs?.attempt).toBe("${{ github.run_attempt }}");
    const guard = steps.find((step) => step.if === "${{ needs.tip.outputs.attempt != github.run_attempt }}");
    expect(steps.indexOf(guard!)).toBeLessThan(steps.indexOf(deployStep!));
    expect(guard?.env).toEqual({ SHA: "${{ needs.tip.outputs.sha }}" });

    const gated = "a".repeat(40);
    const withRemoteTip = (git: string) => runStep(guard!.run!, { env: { GITHUB_REF: "refs/heads/main", SHA: gated }, git }).status;
    const answering = (tip: string) => `[ "$*" = "ls-remote --exit-code origin refs/heads/main" ] && printf '%s\\trefs/heads/main\\n' ${tip}`;
    expect(withRemoteTip(answering(gated))).toBe(0);
    expect(withRemoteTip(answering("b".repeat(40)))).not.toBe(0);
    expect(withRemoteTip("exit 128")).not.toBe(0);
    const nestedBranchFirst = `printf '%s\\trefs/heads/x/refs/heads/main\\n%s\\trefs/heads/main\\n' ${gated} ${"b".repeat(40)}`;
    expect(withRemoteTip(nestedBranchFirst)).not.toBe(0);
  });
});

describe("the sandbox gates its own commit", () => {
  const workflow = workflowOf("deploy-sandbox.yml");

  test("the gate suite passes on the branch's tip before the deploy job deploys it, so a burst of pushes never leaves the deployment behind", () => {
    const [suiteJob, suite] = Object.entries(workflow.jobs).find(([, job]) => job.uses === gateSuite) ?? [];
    expect(suite?.with).toEqual({ ref: "${{ needs.tip.outputs.sha }}" });
    expect(needsOf(deployJobOf(workflow))).toEqual(expect.arrayContaining(["tip", suiteJob]));
  });
});

describe("production deploys what main's Gate passed", () => {
  const workflow = workflowOf("deploy-production.yml");
  const deployJob = deployJobOf(workflow);

  test("runs no test suite of its own, so each merge runs the suite once", () => {
    expect(Object.values(workflow.jobs).filter((job) => job.uses === gateSuite)).toEqual([]);
  });

  test("a Gate that failed, was cancelled or was skipped deploys nothing", () => {
    expect(workflow.jobs.tip?.if).toBe("${{ github.event.workflow_run.conclusion == 'success' }}");
    expect(needsOf(deployJob)).toContain("tip");
  });

  test("deploys the Gate's commit only while it is still main's tip, so a newer merge's Gate deploys the newer commit and a rerun of an older Gate never rolls production back", () => {
    expect(deployJob?.if).toBe("${{ needs.tip.outputs.sha == github.event.workflow_run.head_sha }}");
  });

  test("every waiting deploy keeps its turn, so a rerun of an older Gate never pushes the tip's deploy out of the queue", () => {
    expect(workflow.concurrency.queue).toBe("max");
  });

  test("a merge whose push started no Gate is deployed by running the Gate by hand on main", () => {
    expect(workflowOf("gate.yml").on).toMatchObject({ workflow_dispatch: null });
  });
});
