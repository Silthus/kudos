import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken } from "../../testing/fakePostHog";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { exceptionOfJobError } from "./exceptions";

const now = new Date("2026-10-13T10:00:00Z");
const minutes = (count: number) => count * 60 * 1000;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", postHog.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("O22: the failed-job sweep", () => {
  test("records a scheduled mutation that threw once, however often it sweeps", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaceKeys", { workspace: "T1", workspaceKey: "the-workspace-key" }));
    await scheduleWelcomeOfAGoneMember(t, 0);
    await settle(t);

    await sweepAfter(t, minutes(15));
    await sweepAfter(t, minutes(15));
    await sweepAfter(t, minutes(15));

    const [exception, ...others] = exceptions();
    expect(others).toEqual([]);
    expect(exception).toMatchObject({ distinct_id: "deployment:sandbox", timestamp: now.toISOString() });
    expect(exception!.properties).toEqual({
      environment: "sandbox",
      workspace_key: "the-workspace-key",
      taxonomy_version: 1,
      function_path: "welcome/welcome:welcomeNewMembers",
      function_kind: "mutation",
      $exception_list: [{ type: "Error", value: "unexpected error", mechanism: { handled: false, synthetic: false }, stacktrace: { type: "raw", frames: [] } }],
    });
  });

  test("records a job that was still pending at one sweep and failed before the next", async () => {
    const t = testBackend();
    await scheduleWelcomeOfAGoneMember(t, minutes(20));

    await sweepAfter(t, minutes(15));
    expect(exceptions()).toEqual([]);
    vi.advanceTimersByTime(minutes(5));
    await t.finishInProgressScheduledFunctions();
    await sweepAfter(t, minutes(10));

    expect(exceptions().map((exception) => exception.properties.function_path)).toEqual(["welcome/welcome:welcomeNewMembers"]);
    expect(await t.run((ctx) => ctx.db.query("watchedJobs").collect())).toEqual([]);
  });

  test("O20: never records the analytics module's own functions", async () => {
    const t = testBackend();
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("no randomness today");
    });
    await t.run(async (ctx) => {
      const member = await ctx.db.insert("members", memberRow);
      await ctx.scheduler.runAfter(0, internal.analytics.subscribers.recordKudosGiven, { event: kudosGivenTo(member) });
    });
    await settle(t);
    vi.mocked(crypto.randomUUID).mockRestore();

    await sweepAfter(t, minutes(15));

    expect(await jobStates(t)).toContain("failed");
    expect(exceptions()).toEqual([]);
  });
});

describe("O23: what the sweep reads from Convex's error string", () => {
  test.each<[string, string | undefined, { type: string; value: string }]>([
    ["a reportable error sends its message", "Uncaught ReportableError: Slack conversations.join failed: not_authed\n    at resultOfJoining (../convex/slack/commands.ts:40:9)", { type: "ReportableError", value: "Slack conversations.join failed: not_authed" }],
    ["any other error sends unexpected error and its type", "Uncaught SyntaxError: Unexpected token 'M', \"Marmalade U0ZEPHYRINE\" is not valid JSON", { type: "SyntaxError", value: "unexpected error" }],
    ["a validation error that names a ReportableError in its input still sends nothing of it", "ArgumentValidationError: Value does not match validator.\nUncaught ReportableError: Marmalade", { type: "Error", value: "unexpected error" }],
    ["no error string sends unexpected error", undefined, { type: "Error", value: "unexpected error" }],
  ])("%s", (_, error, expected) => {
    expect(exceptionOfJobError(error)).toEqual({ ...expected, frames: [] });
  });
});

const memberRow = { workspace: "T1", user: "U_GONE", kind: "member" as const };

async function scheduleWelcomeOfAGoneMember(t: Backend, delayMs: number) {
  await t.run(async (ctx) => {
    const gone = await ctx.db.insert("members", memberRow);
    await ctx.db.delete(gone);
    await ctx.scheduler.runAfter(delayMs, internal.welcome.welcome.welcomeNewMembers, { event: kudosGivenTo(gone) });
  });
}

function kudosGivenTo(giver: KudosGivenEvent["giver"]): KudosGivenEvent {
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver,
    awards: [{ giver, recipient: giver, kudos: 1 }],
    kudosEmoji: "taco",
    annotations: {},
    allowance: { dailyOpening: 3, dailyLeft: 2 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day: "2026-10-13",
    at: now.getTime(),
  };
}

async function sweepAfter(t: Backend, delayMs: number) {
  vi.advanceTimersByTime(delayMs);
  await t.mutation(internal.analytics.sweep.sweep, {});
  await settle(t);
}

function exceptions() {
  return postHog.events().filter((event) => event.event === "$exception");
}

async function jobStates(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.map((job) => job.state.kind);
}
