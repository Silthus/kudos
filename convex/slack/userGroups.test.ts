import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";
import { internal } from "../_generated/api";
import { FakeSlack, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { userGroupEvent } from "../../testing/slackMessages";
import { userGroupsOf } from "../workspace/userGroups";

const now = new Date("2026-10-14T10:00:00Z");

const gardeners = { group: "S_GARDEN", handle: "gardeners", name: "Gardeners" };
const bakers = { group: "S_BAKE", handle: "bakers", name: "Bakers" };

let slack: FakeSlack;
let logged: MockInstance[];

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack();
  vi.stubGlobal("fetch", slack.fetch);
  logged = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the user group sync keeps each member's user groups in the directory", () => {
  test("it keeps every enabled user group's handle and name for each of its members", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN", "U_BOB"] }).withUserGroup("S_BAKE", { handle: "bakers", name: "Bakers", users: ["U_ANN"] });

    await sync(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([bakers, gardeners]);
    expect(await groupsOf(t, "U_BOB")).toEqual([gardeners]);
    expect(await groupsOf(t, "U_CAROL")).toEqual([]);
  });

  test("a disabled user group and Slack's automatic admin and owner groups are none of a member's user groups", async () => {
    const t = testBackend();
    slack
      .withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] })
      .withUserGroup("S_OLD", { users: ["U_ANN"], disabled: true })
      .withUserGroup("S_ADMINS", { users: ["U_ANN"], autoType: "admin" })
      .withUserGroup("S_OWNERS", { users: ["U_ANN"], autoType: "owner" });

    await sync(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });

  test("running it again follows Slack: a renamed group, a member who left, a disabled group and one Slack no longer lists", async () => {
    const t = testBackend();
    slack
      .withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN", "U_BOB"] })
      .withUserGroup("S_BAKE", { handle: "bakers", name: "Bakers", users: ["U_ANN", "U_BOB"] })
      .withUserGroup("S_CHESS", { users: ["U_ANN"] });
    await sync(t);

    slack
      .withUserGroup("S_GARDEN", { handle: "growers", name: "Growers", users: ["U_ANN"] })
      .withUserGroup("S_BAKE", { handle: "bakers", name: "Bakers", users: ["U_ANN", "U_BOB"], disabled: true })
      .withoutUserGroup("S_CHESS");
    await sync(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([{ group: "S_GARDEN", handle: "growers", name: "Growers" }]);
    expect(await groupsOf(t, "U_BOB")).toEqual([]);
  });

  test("a group enabled again gets its members back", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"], disabled: true });
    await sync(t);

    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });

  test("a second run with nothing changed in Slack writes no membership again", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN", "U_BOB"] });
    await sync(t);
    const kept = await storedMembershipsOf(t, "S_GARDEN");

    await sync(t);

    expect(kept).toHaveLength(2);
    expect(await storedMembershipsOf(t, "S_GARDEN")).toEqual(kept);
  });

  test("a members list Slack rate-limits is asked again after the Retry-After", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] }).answering("usergroups.users.list", rateLimitedFor(30));

    await t.action(internal.slack.userGroups.syncUserGroups, {});
    await settleInTimeOrder(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
    expect(slack.timesOf("usergroups.users.list")).toEqual([now.getTime(), now.getTime() + 30_000]);
  });
});

describe("an answer the directory can't trust changes nothing", () => {
  test.each<[string, unknown]>([
    ["without a name", { id: "S_BAKE", team_id: "T1", handle: "bakers" }],
    ["without an id", { team_id: "T1", handle: "bakers", name: "Bakers" }],
    ["that isn't an object", "S_BAKE"],
    ["whose disabled time isn't a number", { id: "S_GARDEN", team_id: "T1", handle: "gardeners", name: "Gardeners", date_delete: "0", auto_type: null }],
    ["whose automatic type isn't text", { id: "S_GARDEN", team_id: "T1", handle: "gardeners", name: "Gardeners", date_delete: 0, auto_type: 5 }],
  ])("a listing with a user group %s fails and keeps every user group", async (_, malformed) => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    const listed = { id: "S_GARDEN", team_id: "T1", handle: "gardeners", name: "Gardeners", date_delete: 0, auto_type: null };
    slack.answering("usergroups.list", () => Response.json({ ok: true, usergroups: [malformed, listed] }));

    await expect(t.action(internal.slack.userGroups.syncUserGroups, {})).rejects.toThrow("Slack usergroups.list answered a user group it doesn't describe");

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });

  test("a listing of more user groups than the directory keeps fails and keeps every user group", async () => {
    const t = testBackend({ transactionLimits: true });
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    for (let index = 0; index < 2_000; index += 1) slack.withUserGroup(`S_${index}`, { disabled: true });

    await expect(t.action(internal.slack.userGroups.syncUserGroups, {})).rejects.toThrow("Slack usergroups.list answered more user groups than the directory keeps");

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });

  test("a refresh that would keep more user groups than the directory keeps fails and keeps none of them", async () => {
    const t = testBackend({ transactionLimits: true });
    await t.run(async (ctx) => {
      for (let index = 0; index < 2_000; index += 1) {
        await ctx.db.insert("userGroups", { workspace: "T1", group: `S_${index}`, handle: `group-${index}`, name: `Group ${index}`, enabled: false, automatic: false, asOf: 0 });
      }
    });
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });

    await expect(t.action(internal.slack.userGroups.refreshUserGroup, { workspace: "T1", group: "S_GARDEN" })).rejects.toThrow("more user groups than the directory keeps");

    expect(await t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).length)).toBe(2_000);
    expect(await groupsOf(t, "U_ANN")).toEqual([]);
  });

  test("a members list with an entry that isn't a user ID fails and keeps the members", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN", "U_BOB"] });
    await sync(t);
    slack.answering("usergroups.users.list", () => Response.json({ ok: true, users: ["U_ANN", null] }));

    await expect(t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" })).rejects.toThrow("Slack usergroups.users.list answered a member it doesn't name");

    expect(await groupsOf(t, "U_BOB")).toEqual([gardeners]);
  });

  test("a members list as long as a user group keeps replaces every member within Convex's write limit", async () => {
    const t = testBackend({ transactionLimits: true });
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: Array.from({ length: 7_500 }, (_, index) => `U_OLD_${index}`) });
    await sync(t);
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: Array.from({ length: 7_500 }, (_, index) => `U_NEW_${index}`) });

    await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" });

    expect(await groupsOf(t, "U_OLD_0")).toEqual([]);
    expect(await groupsOf(t, "U_NEW_7499")).toEqual([gardeners]);
  });

  test("a members list longer than a user group can keep fails and keeps the members", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    slack.answering("usergroups.users.list", () => Response.json({ ok: true, users: Array.from({ length: 7_501 }, (_, index) => `U_${index}`) }));

    await expect(t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" })).rejects.toThrow("Slack usergroups.users.list answered more members than a user group keeps");

    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });
});

describe("a workspace without user groups", () => {
  test("a Slack plan without user groups answers no user groups and logs no error", async () => {
    const t = testBackend();
    slack.answering("usergroups.list", slackError("plan_upgrade_required"));

    await sync(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(slack.callsTo("usergroups.list")).toHaveLength(1);
    expect(slack.callsTo("usergroups.users.list")).toEqual([]);
    expect(logged.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  test("a workspace whose plan lost user groups keeps none of the ones it had", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    const before = await groupsOf(t, "U_ANN");

    slack.answering("usergroups.list", slackError("plan_upgrade_required"));
    await sync(t);

    expect(before).toEqual([gardeners]);
    expect(await groupsOf(t, "U_ANN")).toEqual([]);
  });

  test.each(["plan_upgrade_required", "no_such_subteam"])("a members list Slack answers with %s leaves that user group without members", async (error) => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    slack.answering("usergroups.users.list", slackError(error));

    await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" });

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(logged.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  test("losing user groups with thousands of memberships stays within Convex's transaction limits", async () => {
    const t = testBackend({ transactionLimits: true });
    const everyone = Array.from({ length: 6_000 }, (_, index) => `U_${index}`);
    for (const group of ["S_ONE", "S_TWO", "S_THREE"]) slack.withUserGroup(group, { users: everyone });
    await sync(t);
    const before = await groupsOf(t, "U_0");

    slack.answering("usergroups.list", slackError("plan_upgrade_required"));
    await sync(t);

    expect(before).toHaveLength(3);
    expect(await groupsOf(t, "U_0")).toEqual([]);
    expect(await storedMembershipsOf(t, "S_ONE")).toEqual([]);
  });

  test("any other Slack error fails the sync with Slack's code", async () => {
    const t = testBackend();
    slack.answering("usergroups.list", slackError("missing_scope"));

    await expect(t.action(internal.slack.userGroups.syncUserGroups, {})).rejects.toThrow("Slack usergroups.list failed: missing_scope");
  });
});

describe("subteam events refresh that one user group from Slack", () => {
  test.each(["subteam_created", "subteam_updated", "subteam_members_changed"] as const)("%s keeps the group's handle, name and members as Slack lists them", async (type) => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] }).withUserGroup("S_BAKE", { users: ["U_ANN"] });

    const response = await userGroupChanged(t, type, "S_GARDEN");
    await settle(t);

    expect(response.status).toBe(200);
    expect(await groupsOf(t, "U_ANN")).toEqual([gardeners]);
  });

  test("subteam_members_changed takes the full members list from Slack, never the event's delta", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { users: ["U_ANN", "U_BOB"] });
    await sync(t);
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_BOB"] });

    await userGroupChanged(t, "subteam_members_changed", "S_GARDEN");
    await settle(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(await groupsOf(t, "U_BOB")).toEqual([gardeners]);
    expect(await groupsOf(t, "U_SOMEONE")).toEqual([]);
  });

  test("subteam_updated for a disabled group leaves it without members", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    const before = await groupsOf(t, "U_ANN");
    slack.withUserGroup("S_GARDEN", { users: ["U_ANN"], disabled: true });

    await userGroupChanged(t, "subteam_updated", "S_GARDEN");
    await settle(t);

    expect(before).toEqual([gardeners]);
    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(await storedMembershipsOf(t, "S_GARDEN")).toEqual([]);
  });

  test("a redelivered event refreshes the group once", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { users: ["U_ANN"] });

    await userGroupChanged(t, "subteam_members_changed", "S_GARDEN", { eventId: "EvRedelivered" });
    await userGroupChanged(t, "subteam_members_changed", "S_GARDEN", { eventId: "EvRedelivered" });
    await settle(t);

    expect(slack.callsTo("usergroups.users.list")).toHaveLength(1);
  });

  test("an event from a workspace without user groups logs no error", async () => {
    const t = testBackend();
    slack.answering("usergroups.list", slackError("plan_upgrade_required"));

    await userGroupChanged(t, "subteam_created", "S_GARDEN");
    await settle(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(slack.callsTo("usergroups.list")).toHaveLength(1);
    expect(logged.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  test("a members list Slack answered before a newer refresh changes nothing that refresh kept", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    const stale = heldAnswer("usergroups.users.list");
    const firstRefresh = t.action(internal.slack.userGroups.refreshUserGroup, { workspace: "T1", group: "S_GARDEN" });
    await stale.reached;
    vi.setSystemTime(now.getTime() + 60_000);
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_BOB"] });

    await t.action(internal.slack.userGroups.refreshUserGroup, { workspace: "T1", group: "S_GARDEN" });
    stale.release();
    await firstRefresh;

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(await groupsOf(t, "U_BOB")).toEqual([gardeners]);
  });

  test("a members list read while a slower listing disables the user group never keeps its members", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    slack.withUserGroup("S_GARDEN", { handle: "gardeners", name: "Gardeners", users: ["U_ANN"], disabled: true });
    const disabling = heldAnswer("usergroups.list");
    const slowRefresh = t.action(internal.slack.userGroups.refreshUserGroup, { workspace: "T1", group: "S_GARDEN" });
    await disabling.reached;
    vi.setSystemTime(now.getTime() + 60_000);

    await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group: "S_GARDEN" });
    disabling.release();
    await slowRefresh;
    await settle(t);

    expect(await groupsOf(t, "U_ANN")).toEqual([]);
    expect(await storedMembershipsOf(t, "S_GARDEN")).toEqual([]);
  });
});

describe("Convex's limit of 1,000 scheduled functions per call", () => {
  const manyGroups = Array.from({ length: 1_001 }, (_, index) => `S_${index}`);

  test("a sync of 1,001 user groups schedules fewer than 1,000 functions, and every members list in turn", async () => {
    const t = testBackend();
    for (const group of manyGroups) slack.withUserGroup(group, { users: ["U_ANN"] });

    await t.action(internal.slack.userGroups.syncUserGroups, {});
    const scheduled = await pendingJobs(t);
    const groupsAhead = scheduled.flatMap(({ name, args }) => (name.endsWith(":refreshMembersOfEach") ? (args[0] as { groups: unknown[] }).groups : []));

    expect(scheduled.length).toBeLessThan(1_000);
    expect(scheduled.filter(({ name }) => name.endsWith(":refreshMembers")).length + groupsAhead.length).toBe(1_001);
  });

  test("a listing that disables 1,001 user groups schedules fewer than 1,000 functions", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      for (const group of manyGroups) await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, asOf: 0 });
    });
    slack.answering("usergroups.list", slackError("plan_upgrade_required"));

    await t.action(internal.slack.userGroups.syncUserGroups, {});

    expect((await pendingJobs(t)).length).toBeLessThan(1_000);
  });
});

async function sync(t: Backend) {
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
}

async function userGroupChanged(t: Backend, ...event: Parameters<typeof userGroupEvent>) {
  return t.fetch("/slack/events", await signedRequest(userGroupEvent(...event)));
}

function groupsOf(t: Backend, user: string) {
  return t.run((ctx) => userGroupsOf(ctx, "T1", user));
}

function storedMembershipsOf(t: Backend, group: string) {
  return t.run(async (ctx) => (await ctx.db.query("userGroupMembers").collect()).filter((membership) => membership.group === group));
}

function heldAnswer(method: string) {
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  let signalReached = () => {};
  const reached = new Promise<void>((resolve) => (signalReached = resolve));
  slack.answering(method, async (answerAsSlackWould) => {
    const answer = answerAsSlackWould();
    signalReached();
    await released;
    return answer;
  });
  return { reached, release };
}

function pendingJobs(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ state }) => state.kind === "pending"));
}
