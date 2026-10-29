import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, postHogHost, projectToken } from "../../testing/fakePostHog";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const now = new Date("2026-10-13T10:00:00Z");

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

describe("HH17: a failed subscriber is replayed by hand", () => {
  test("a failed subscriber runs again with its stored event, and only once however often it is replayed", async () => {
    const t = testBackend();
    const failed = await failedRecordingOfAKudos(t);

    expect(await t.mutation(internal.bus.replay.replay, { job: failed })).toBe("replayed");
    await settle(t);
    expect(await t.mutation(internal.bus.replay.replay, { job: failed })).toBe("already replayed");
    await settle(t);

    expect(kudosGivenEvents(), "the kudos given events PostHog received").toHaveLength(1);
  });

  test("a job that did not fail is not replayed", async () => {
    const t = testBackend();
    const recorded = await recordingOfAKudos(t);

    expect(await t.mutation(internal.bus.replay.replay, { job: recorded })).toBe("not failed");
    await settle(t);

    expect(kudosGivenEvents(), "the kudos given events PostHog received").toHaveLength(1);
  });

  test.each([
    ["the next tally page of a hug", internal.album.tallies.tallyHug],
    ["the next sticker holder of the milestones", internal.album.milestones.recordMilestonesOfStickerHolders],
    ["the next page of a leaver's forgotten words", internal.engine.kudosText.forgetAuthoredWords],
    ["the journey recheck of one member", internal.quests.journey.recheckSomeoneNewOf],
  ])("a failed job of %s, which a subscriber schedules to finish its delivery, is replayed", async (_, fn) => {
    const t = testBackend();
    const failed = await failedJobOf(t, fn);

    expect(await t.mutation(internal.bus.replay.replay, { job: failed })).toBe("replayed");
  });

  test.each([
    ["a function that is no subscriber", internal.feedback.homes.republishAdminsIn],
    ["a subscriber that sends its message again when delivered twice", internal.welcome.welcome.welcomeOnHug],
  ])("a failed job of %s is not replayed", async (_, fn) => {
    const t = testBackend();
    const failed = await failedJobOf(t, fn);

    expect(await t.mutation(internal.bus.replay.replay, { job: failed })).toBe("not a subscriber");
  });
});

async function failedRecordingOfAKudos(t: Backend) {
  vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
    throw new Error("no randomness today");
  });
  return recordingOfAKudos(t);
}

async function recordingOfAKudos(t: Backend) {
  return jobOf(t, async (ctx) => {
    const member = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" });
    return ctx.scheduler.runAfter(0, internal.analytics.subscribers.recordKudosGiven, { event: await kudosGivenEventWithAward(ctx, member, member, { at: now.getTime() }) });
  });
}

async function failedJobOf(t: Backend, fn: FunctionReference<"mutation", "internal">) {
  return jobOf(t, (ctx) => ctx.scheduler.runAfter(0, fn, { stale: "arguments" }));
}

async function jobOf(t: Backend, schedule: (ctx: MutationCtx) => Promise<Id<"_scheduled_functions">>) {
  const job = await t.run(schedule);
  await settle(t);
  return job;
}

function kudosGivenEvents() {
  return postHog.events().filter((event) => event.event === "kudos given");
}
