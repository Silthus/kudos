import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace } from "../../testing/website";
import { api } from "../_generated/api";
import crons from "../crons";

const hour = 60 * 60 * 1000;
const start = new Date("2026-10-13T09:00:00Z");
const cleanup = "delete abandoned sign-in handshakes";

beforeEach(() => {
  vi.useFakeTimers({ now: start });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", "https://happy-hog-123.convex.site");
  vi.stubEnv("CONVEX_SITE_URL", "https://happy-hog-123.convex.site");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("WS3: a sign-in that never comes back from Slack leaves no Convex Auth row behind for good", () => {
  test("the daily job deletes a handshake abandoned over a day ago and keeps one still in flight", async () => {
    const t = testBackend();
    await startSignInAt(t, start);
    await startSignInAt(t, new Date(start.getTime() + 23 * hour));
    vi.setSystemTime(start.getTime() + 25 * hour);

    await t.mutation(dailyJob(cleanup), {});

    expect(await verifierAges(t)).toEqual([2 * hour]);
  });

  test("the daily job deletes every abandoned handshake, however many there are", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      for (let i = 0; i < 1201; i++) await ctx.db.insert("authVerifiers", {});
    });
    vi.setSystemTime(start.getTime() + 25 * hour);

    await t.mutation(dailyJob(cleanup), {});
    await settle(t);

    expect(await verifierAges(t)).toEqual([]);
  });

  test("the cleanup runs every day", () => {
    expect(crons.crons[cleanup]?.schedule).toMatchObject({ type: "daily" });
  });
});

async function startSignInAt(t: Backend, at: Date) {
  vi.setSystemTime(at);
  const started = await t.action(api.auth.signIn, { provider: "slack", params: { redirectTo: "/" } });
  expect(started.redirect).toBeDefined();
}

function dailyJob(name: string) {
  const job = crons.crons[name];
  if (job === undefined) throw new Error(`no cron job named ${name}`);
  return makeFunctionReference<"mutation">(job.name);
}

async function verifierAges(t: Backend) {
  const verifiers = await t.run((ctx) => ctx.db.query("authVerifiers").collect());
  return verifiers.map((verifier) => Date.now() - verifier._creationTime);
}
