import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, answersWith, postHogHost, projectToken, routedFetch } from "../../testing/fakePostHog";
import { makeFunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import crons from "../crons";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settle, settleInTimeOrder, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, userGroupEvent } from "../../testing/slackMessages";

const now = new Date("2026-10-14T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const annsSlackProfile = { email: "ann@example.com", real_name: "Ann Example", display_name: "annie", title: "Gardener" };

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  slack = new FakeSlack().withMember("U_BOB");
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("F7 F8: PostHog's person carries the member's profile", () => {
  test("a member's first event identifies their person with their profile, and only person events carry it", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", is_admin: true, profile: annsSlackProfile });

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_ANN" });
    await settle(t);

    const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
    expect(personEvents()).toEqual([
      {
        event: "$identify",
        distinct_id: distinctIdOf("kudos given"),
        properties: {
          ...shared,
          $set: {
            email: "ann@example.com",
            name: "Ann Example",
            display_name: "annie",
            title: "Gardener",
            slack_user_id: "U_ANN",
            slack_team_id: "T1",
            is_admin: true,
            environment: "sandbox",
          },
        },
      },
      {
        event: "$identify",
        distinct_id: distinctIdOf("kudos received"),
        properties: { ...shared, $set: { slack_user_id: "U_BOB", slack_team_id: "T1", is_admin: false, environment: "sandbox" } },
      },
    ]);
  });
});

describe("F8: the person follows the directory", () => {
  test("a changed profile sends one $set with what it has and unsets what it lost, and a repeated user_change sends nothing", async () => {
    const t = testBackend();
    await annGaveKudos(t);

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { email: "ann.example@example.com", real_name: "Ann Example" } }, { eventTs: later(1) });
    await memberChanged(t, "user_change", { id: "U_ANN", profile: { email: "ann.example@example.com", real_name: "Ann Example" } }, { eventTs: later(2) });
    await settle(t);

    expect(personEventsOn(await annsDistinctId(t)).slice(1)).toEqual([
      {
        event: "$set",
        $set: { email: "ann.example@example.com", name: "Ann Example", slack_user_id: "U_ANN", slack_team_id: "T1", is_admin: false, environment: "sandbox" },
        $unset: ["display_name", "title", "teams"],
      },
    ]);
  });

  test("a change back to an earlier profile is a change", async () => {
    const t = testBackend();
    await annGaveKudos(t);

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Baker" } }, { eventTs: later(1) });
    await settle(t);
    await memberChanged(t, "user_change", { id: "U_ANN", profile: annsSlackProfile }, { eventTs: later(2) });
    await settle(t);

    expect(personEventsOn(await annsDistinctId(t)).map(({ event, $set }) => [event, $set.title])).toEqual([
      ["$identify", "Gardener"],
      ["$set", "Baker"],
      ["$set", "Gardener"],
    ]);
  });

  test("F5 F10: a member who leaves has every identifying key unset, keeping only environment", async () => {
    const t = testBackend();
    await annGaveKudos(t);

    await memberChanged(t, "user_change", { id: "U_ANN", deleted: true, profile: annsSlackProfile }, { eventTs: later(1) });
    await settle(t);

    expect(personEventsOn(await annsDistinctId(t)).slice(1)).toEqual([
      { event: "$set", $set: { environment: "sandbox" }, $unset: ["email", "name", "display_name", "title", "slack_user_id", "slack_team_id", "is_admin", "teams"] },
    ]);
  });
});

describe("F8: a newer person event replaces an older one still waiting", () => {
  test("while PostHog fails, a newer profile replaces the waiting one, so PostHog never ends on the older", async () => {
    const t = testBackend();
    await annGaveKudos(t);
    postHog.answering(answersWith(503));

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Baker" } }, { eventTs: later(1) });
    await settleUntil(t, new Date(Date.now() + 30_000));
    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Chef" } }, { eventTs: later(2) });
    await settleInTimeOrder(t);

    expect(titlesSentTo(await annsDistinctId(t))).toEqual(["Gardener", "Baker", "Chef"]);
    expect(await outboxRows(t)).toEqual([]);
  });

  test("a person event that fails while a newer one was recorded is dropped, not retried", async () => {
    const t = testBackend();
    await annGaveKudos(t);

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Baker" } }, { eventTs: later(1) });
    const inFlight = await claimAsTheDrain(t);
    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Chef" } }, { eventTs: later(2) });
    await t.mutation(internal.analytics.drain.settle, { token: inFlight!.token, rows: inFlight!.rows.map((row) => row._id), answer: "failed" });
    await settleInTimeOrder(t);

    expect(titlesSentTo(await annsDistinctId(t))).toEqual(["Gardener", "Chef"]);
    expect(await outboxRows(t)).toEqual([]);
  });
});

describe("F9: catching up", () => {
  test("with capture off nothing is recorded; once it is on, the catch-up sends exactly what is missing, an unset for a member who left meanwhile too", async () => {
    const t = testBackend();
    await annGaveKudos(t);
    await memberChanged(t, "team_join", { id: "U_CAROL", profile: { email: "carol@example.com" } }, { eventTs: later(0) });
    await post(t, [section(mention("U_CAROL"), emoji("taco"))], { user: "U_BOB", ts: "1760436000.000200" });
    await settle(t);
    const before = postHog.personEvents().length;
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");

    await memberChanged(t, "user_change", { id: "U_ANN", deleted: true }, { eventTs: later(1) });
    await memberChanged(t, "user_change", { id: "U_CAROL", profile: { email: "carol.example@example.com" } }, { eventTs: later(1) });
    await settle(t);
    const whileOff = { sent: postHog.personEvents().length - before, recorded: await outboxRows(t) };
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
    await t.mutation(dailyCatchUp(), {});
    await t.mutation(dailyCatchUp(), {});
    await settle(t);

    expect(whileOff).toEqual({ sent: 0, recorded: [] });
    expect(postHog.personEvents().slice(before).map(({ event, properties: { $set } }) => [event, $set])).toEqual([
      ["$set", { environment: "sandbox" }],
      ["$set", { email: "carol.example@example.com", slack_user_id: "U_CAROL", slack_team_id: "T1", is_admin: false, environment: "sandbox" }],
    ]);
  });

  test("the pass runs every day, after the daily user group sync", () => {
    expect(crons.crons[catchUpJob]?.schedule).toEqual({ type: "daily", hourUTC: 4, minuteUTC: 45 });
  });

  test("F3: the backfill runs the pass, for a member whose profile it doesn't change too", async () => {
    const t = testBackend();
    await annGaveKudos(t);
    const delivered = postHog.personEvents().length;
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");
    await memberChanged(t, "user_change", { id: "U_ANN", profile: { ...annsSlackProfile, title: "Baker" } }, { eventTs: later(1) });
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
    slack.withMember("U_ANN", { profile: { ...annsSlackProfile, title: "Baker" } });

    await t.action(internal.slack.directory.fillMemberProfiles, {});
    await settle(t);

    expect(postHog.personEvents().slice(delivered).map(({ distinct_id, properties: { $set } }) => [distinct_id, (($set ?? {}) as { title?: string }).title])).toEqual([
      [await annsDistinctId(t), "Baker"],
    ]);
  });

  test("O19: a person event that ends exhausted is recorded again by the next pass", async () => {
    const t = testBackend();
    postHog.answering(answersWith(400));
    await annGaveKudos(t);
    const delivered = postHog.personEvents().length;

    await t.mutation(dailyCatchUp(), {});
    await settle(t);

    expect(postHog.personEvents().slice(delivered).map(({ event, distinct_id }) => [event, distinct_id])).toEqual([
      ["$set", await annsDistinctId(t)],
      ["$set", await distinctIdOfMember(t, "U_BOB")],
    ]);
  });
});

describe("F7 F8: teams are the handles of the member's user groups", () => {
  test("the user group sync sends the member's teams, and a members change, a rename and a disabled group follow", async () => {
    const t = testBackend();
    await annGaveKudos(t);
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", users: ["U_ANN"] }).withUserGroup("S_BAKE", { handle: "bakers", users: ["U_ANN", "U_BOB"] });
    await syncUserGroups(t);
    const synced = teamsSentTo(await annsDistinctId(t));

    slack.withUserGroup("S_BAKE", { handle: "bakers", users: ["U_BOB"] });
    await userGroupChanged(t, "subteam_members_changed", "S_BAKE");
    await settle(t);
    slack.withUserGroup("S_GARDEN", { handle: "growers", users: ["U_ANN"] });
    await userGroupChanged(t, "subteam_updated", "S_GARDEN");
    await settle(t);
    slack.withUserGroup("S_GARDEN", { handle: "growers", users: ["U_ANN"], disabled: true });
    await syncUserGroups(t);

    expect(synced).toEqual([["bakers", "gardeners"]]);
    expect(teamsSentTo(await annsDistinctId(t))).toEqual([["bakers", "gardeners"], ["gardeners"], ["growers"], "unset"]);
    expect(teamsSentTo(await distinctIdOfMember(t, "U_BOB"))).toEqual([["bakers"]]);
  });
});

const catchUpJob = "bring PostHog's people up to date";

function dailyCatchUp() {
  const job = crons.crons[catchUpJob];
  if (job === undefined) throw new Error(`no cron job named ${catchUpJob}`);
  return makeFunctionReference<"mutation">(job.name);
}

async function syncUserGroups(t: Backend) {
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
}

async function userGroupChanged(t: Backend, ...event: Parameters<typeof userGroupEvent>) {
  return t.fetch("/slack/events", await signedRequest(userGroupEvent(...event)));
}

function teamsSentTo(distinctId: string) {
  return personEventsOn(distinctId).flatMap(({ $set, $unset }) => {
    if ($set.teams !== undefined) return [$set.teams];
    return Array.isArray($unset) && $unset.includes("teams") ? ["unset"] : [];
  });
}

async function annGaveKudos(t: Backend) {
  await memberChanged(t, "team_join", { id: "U_ANN", profile: annsSlackProfile }, { eventTs: `${now.getTime() / 1000}` });
  await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_ANN" });
  await settle(t);
}

function later(minutes: number) {
  return `${now.getTime() / 1000 + minutes * 60}`;
}

function annsDistinctId(t: Backend) {
  return distinctIdOfMember(t, "U_ANN");
}

async function distinctIdOfMember(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const identity = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    return identity!.analyticsId;
  });
}

function titlesSentTo(distinctId: string) {
  return personEventsOn(distinctId).map(({ $set }) => $set.title);
}

async function claimAsTheDrain(t: Backend) {
  const drain = await t.run((ctx) => ctx.db.query("analyticsDrain").first());
  return t.mutation(internal.analytics.drain.claim, { generation: drain!.generation });
}

function outboxRows(t: Backend) {
  return t.run((ctx) => ctx.db.query("analyticsOutbox").collect());
}

function personEventsOn(distinctId: string) {
  return postHog
    .personEvents()
    .filter((captured) => captured.distinct_id === distinctId)
    .map(({ event, properties: { $set, $unset } }) => ({ event, $set: $set as Record<string, unknown>, ...($unset !== undefined && { $unset }) }));
}

function personEvents() {
  return postHog.personEvents().map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties }));
}

function distinctIdOf(event: string) {
  return postHog.events().find((captured) => captured.event === event)?.distinct_id;
}
