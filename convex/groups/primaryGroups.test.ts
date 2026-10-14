import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { userGroupEvent } from "../../testing/slackMessages";
import type { Doc } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import type { PrimaryGroupChangedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { userGroupsOf } from "../workspace/userGroups";
import { availableIn, groupsShownTo, primaryGroupOf } from "./groups";
import { primaryGroupAt } from "./history";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack();
  vi.stubGlobal("fetch", slack.fetch);
  vi.mocked(publish).mockClear();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GB6: a member gets the smallest of their counting groups as primary group, and keeps it", () => {
  test("a member the directory learns while in two groups counts for the one with fewer members, whatever its name", async () => {
    const t = testBackend();
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_CAROL"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] });
    await sync(t);

    await joined(t, "U_BOB", "U_CAROL", "U_ANN");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
  });

  test("Slack adding a member to two groups at once gives them the smaller; a third, smaller group joined later doesn't move it", async () => {
    const t = testBackend();
    await joined(t, "U_ANN", "U_BOB", "U_CAROL");
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_BOB", "U_CAROL"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_BOB"] });
    await sync(t);

    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_CAROL"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] });
    await userGroupChanged(t, "subteam_members_changed", "S_GARDEN");
    await userGroupChanged(t, "subteam_members_changed", "S_ZEBRA");
    await settle(t);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");

    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] });
    await userGroupChanged(t, "subteam_members_changed", "S_OWL");
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(await historyOf(t, "U_ANN")).toEqual([{ from: null, group: "Zebras", cause: "default" }]);
  });

  test("a member who joins their first group counts for it", async () => {
    const t = testBackend();
    await joined(t, "U_ANN");
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN"] });

    await userGroupChanged(t, "subteam_created", "S_GARDEN");
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Gardeners");
  });
});

describe("GB2: the user group copy reconciles every member it lists", () => {
  test("members already in the copy when Groups ships get the group with the fewest people at the next sync, whichever group's list comes first", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      for (const user of ["U_ANN", "U_BOB", "U_CAROL"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      const copied = { workspace: "T1", enabled: true, automatic: false, asOf: 0, membersAsOf: 0 };
      await ctx.db.insert("userGroups", { ...copied, group: "S_ZEBRA", handle: "zebras", name: "Zebras" });
      await ctx.db.insert("userGroups", { ...copied, group: "S_GARDEN", handle: "gardeners", name: "Gardeners" });
      for (const user of ["U_ANN"]) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: "S_ZEBRA", user });
      for (const user of ["U_ANN", "U_BOB", "U_CAROL"]) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: "S_GARDEN", user });
    });
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_CAROL"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN"] });

    await t.action(internal.slack.userGroups.syncUserGroups, {});
    await settleInTimeOrder(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(await primaryGroupNameOf(t, "U_BOB")).toBe("Gardeners");
  });
});

describe("GB6: group sizes come from the copy's freshest member count", () => {
  test("a listing Slack answered before a newer members list doesn't overwrite that list's member count", async () => {
    const t = testBackend();
    const group = (id: string, name: string, members: number) => ({ workspace: "T1", group: id, handle: id, name, enabled: true, automatic: false, members });
    await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: [group("S_A", "Alpha", 3), group("S_B", "Beta", 2)], scope: { kind: "every-group" }, asOf: 1_000 });
    await t.mutation(internal.workspace.userGroups.keepUserGroupMembers, { workspace: "T1", group: "S_A", users: ["U_ANN"], asOf: 3_000 });
    await t.mutation(internal.workspace.userGroups.keepUserGroupMembers, { workspace: "T1", group: "S_B", users: ["U_ANN", "U_BOB"], asOf: 3_000 });

    await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: [group("S_A", "Alpha", 100), group("S_B", "Beta", 2)], scope: { kind: "every-group" }, asOf: 2_000 });
    await settle(t);
    await joined(t, "U_ANN");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Alpha");
  });
  test("a members list Slack answered before a newer listing doesn't overwrite that listing's member count", async () => {
    const t = testBackend();
    const group = (id: string, name: string, members: number) => ({ workspace: "T1", group: id, handle: id, name, enabled: true, automatic: false, members });
    await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: [group("S_A", "Alpha", 100), group("S_B", "Beta", 2)], scope: { kind: "every-group" }, asOf: 3_000 });
    await t.mutation(internal.workspace.userGroups.keepUserGroupMembers, { workspace: "T1", group: "S_B", users: ["U_ANN", "U_BOB"], asOf: 3_000 });

    await t.mutation(internal.workspace.userGroups.keepUserGroupMembers, { workspace: "T1", group: "S_A", users: ["U_ANN"], asOf: 2_000 });
    await settle(t);
    await joined(t, "U_ANN");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Beta");
  });
});


describe("GB8: a member who loses their primary group falls back to the smallest group left, quietly", () => {
  async function annInThreeGroups() {
    const t = testBackend();
    slack
      .withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] })
      .withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] })
      .withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_CAROL"] });
    await sync(t);
    await joined(t, "U_BOB", "U_CAROL", "U_ANN");
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Owls");
    vi.mocked(publish).mockClear();
    slack.calls.length = 0;
    return t;
  }

  test("leaving the primary group in Slack moves the member to the smallest group they are still in", async () => {
    const t = await annInThreeGroups();
    slack.withUserGroup("S_OWL", { name: "Owls", users: [] });

    await userGroupChanged(t, "subteam_members_changed", "S_OWL");
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect((await historyOf(t, "U_ANN")).slice(1)).toEqual([{ from: "Owls", group: "Zebras", cause: "fallback" }]);
    expect(await primaryGroupChangesOf(t, "U_ANN")).toEqual([{ from: "Owls", to: "Zebras", cause: "fallback", at: await latestChangeAt(t, "U_ANN") }]);
    expect(messagesSent()).toEqual([]);
  });

  test("the primary group being disabled in Slack moves its members to the smallest group they are still in", async () => {
    const t = await annInThreeGroups();
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"], disabled: true });

    await userGroupChanged(t, "subteam_updated", "S_OWL");
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect((await historyOf(t, "U_ANN")).slice(1)).toEqual([{ from: "Owls", group: "Zebras", cause: "fallback" }]);
    expect(await primaryGroupChangesOf(t, "U_ANN")).toEqual([{ from: "Owls", to: "Zebras", cause: "fallback", at: await latestChangeAt(t, "U_ANN") }]);
    expect(messagesSent()).toEqual([]);
  });

  test("a deactivated member counts for no group, and comes back to the smallest of their groups", async () => {
    const t = await annInThreeGroups();

    await memberChanged(t, "user_change", { id: "U_ANN", deleted: true });
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBeNull();
    expect((await historyOf(t, "U_ANN")).slice(1)).toEqual([{ from: "Owls", group: null, cause: "fallback" }]);
    expect(await primaryGroupChangesOf(t, "U_ANN")).toEqual([{ from: "Owls", to: null, cause: "fallback", at: await latestChangeAt(t, "U_ANN") }]);
    expect(messagesSent()).toEqual([]);

    await memberChanged(t, "user_change", { id: "U_ANN" });
    await settle(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Owls");
  });

  test("a member whose last group is disabled counts for no group", async () => {
    const t = testBackend();
    await joined(t, "U_ANN");
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] });
    await sync(t);

    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"], disabled: true });
    await sync(t);

    expect(await primaryGroupNameOf(t, "U_ANN")).toBeNull();
    expect(await historyOf(t, "U_ANN")).toEqual([
      { from: null, group: "Owls", cause: "default" },
      { from: "Owls", group: null, cause: "fallback" },
    ]);
  });
});

describe("GB5: a member's primary group is always one of their counting groups, or none when they have none", () => {
  test("through joins, leaves, a disabled group, a deactivation and a return, every member's primary group is one of the groups they count in", async () => {
    const t = testBackend();
    slack
      .withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN", "U_BOB"] })
      .withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_CAROL"] })
      .withUserGroup("S_ADMINS", { name: "Admins", users: ["U_BOB"], autoType: "admin" });
    await sync(t);
    await joined(t, "U_ANN", "U_BOB", "U_CAROL");
    const steps = [
      async () => {
        slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_BOB"] });
        await userGroupChanged(t, "subteam_members_changed", "S_OWL");
      },
      async () => {
        slack.withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_CAROL"], disabled: true });
        await userGroupChanged(t, "subteam_updated", "S_ZEBRA");
      },
      () => memberChanged(t, "user_change", { id: "U_BOB", deleted: true }),
      async () => {
        slack.withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_CAROL", "U_BOB"] });
        await userGroupChanged(t, "subteam_updated", "S_ZEBRA");
      },
      () => memberChanged(t, "user_change", { id: "U_BOB" }),
    ];

    const outside = [];
    for (const step of steps) {
      await step();
      await settle(t);
      outside.push(...(await primaryGroupsOutsideCountingGroups(t)));
    }

    expect(outside).toEqual([]);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(await primaryGroupNameOf(t, "U_BOB")).toBe("Owls");
  });
});

describe("GB9: primaryGroupAt answers the history entry in force at an instant", () => {
  test("before the first change it answers none, from each change's millisecond on that change's group", async () => {
    const t = testBackend();
    await joined(t, "U_ANN");
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN"] });
    await userGroupChanged(t, "subteam_members_changed", "S_OWL");
    await settle(t);
    const joinedOwls = (await latestChangeAt(t, "U_ANN"))!;
    vi.advanceTimersByTime(60_000);
    await userGroupChanged(t, "subteam_members_changed", "S_ZEBRA");
    slack.withUserGroup("S_OWL", { name: "Owls", users: [] });
    await userGroupChanged(t, "subteam_members_changed", "S_OWL");
    await settle(t);
    const leftOwls = (await latestChangeAt(t, "U_ANN"))!;

    expect(leftOwls).toBeGreaterThan(joinedOwls);
    expect(await primaryGroupNameAt(t, "U_ANN", joinedOwls - 1)).toBeNull();
    expect(await primaryGroupNameAt(t, "U_ANN", joinedOwls)).toBe("Owls");
    expect(await primaryGroupNameAt(t, "U_ANN", leftOwls - 1)).toBe("Owls");
    expect(await primaryGroupNameAt(t, "U_ANN", leftOwls)).toBe("Zebras");
    expect(await primaryGroupNameAt(t, "U_ANN", leftOwls + 86_400_000)).toBe("Zebras");
  });

  test("a change the copy records takes effect at that instant, though its page runs later", async () => {
    const t = testBackend();
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] });
    await sync(t);
    await joined(t, "U_ANN");
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Owls");
    vi.advanceTimersByTime(60_000);
    slack.withUserGroup("S_OWL", { name: "Owls", users: [] });

    await userGroupChanged(t, "subteam_members_changed", "S_OWL");
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    const recorded = Date.now();
    vi.setSystemTime(recorded + 5_000);
    await settle(t);

    expect(await primaryGroupNameAt(t, "U_ANN", recorded - 1)).toBe("Owls");
    expect(await primaryGroupNameAt(t, "U_ANN", recorded)).toBe("Zebras");
  });

  test("a change keeps its own instant when someone else's change to the same group lands before its page runs", async () => {
    const t = testBackend();
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] });
    await sync(t);
    await joined(t, "U_ANN", "U_CAROL");
    vi.advanceTimersByTime(60_000);

    slack.withUserGroup("S_OWL", { name: "Owls", users: [] });
    await copyRecordsWithoutReconciling(t, "S_OWL");
    const annLeft = Date.now();
    vi.setSystemTime(annLeft + 2_000);
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_CAROL"] });
    await copyRecordsWithoutReconciling(t, "S_OWL");
    vi.setSystemTime(annLeft + 5_000);
    await settle(t);

    expect(await primaryGroupNameAt(t, "U_ANN", annLeft)).toBe("Zebras");
  });

  test("a page for leaving another group doesn't backdate leaving the primary group, which the copy recorded later", async () => {
    const t = testBackend();
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN", "U_BOB"] });
    await sync(t);
    await joined(t, "U_ANN");
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Owls");
    vi.advanceTimersByTime(60_000);

    slack.withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_BOB"] });
    await copyRecordsWithoutReconciling(t, "S_ZEBRA");
    const leftZebras = Date.now();
    vi.setSystemTime(leftZebras + 1_000);
    slack.withUserGroup("S_OWL", { name: "Owls", users: [] });
    await copyRecordsWithoutReconciling(t, "S_OWL");
    const leftOwls = Date.now();
    await settleInTimeOrder(t);

    expect(await primaryGroupNameAt(t, "U_ANN", leftOwls - 1)).toBe("Owls");
    expect(await primaryGroupNameAt(t, "U_ANN", leftOwls)).toBeNull();
  });

  test("of two changes recorded in the same millisecond, the later one is in force at it", async () => {
    const t = testBackend();
    slack.withUserGroup("S_OWL", { name: "Owls", users: ["U_ANN"] });
    await sync(t);
    await joined(t, "U_ANN");

    await memberChanged(t, "user_change", { id: "U_ANN", deleted: true });
    await memberChanged(t, "user_change", { id: "U_ANN" });

    expect(await historyOf(t, "U_ANN")).toEqual([
      { from: null, group: "Owls", cause: "default" },
      { from: "Owls", group: null, cause: "fallback" },
      { from: null, group: "Owls", cause: "default" },
    ]);
    expect(await primaryGroupNameAt(t, "U_ANN", Date.now())).toBe("Owls");
  });
});

describe("GB1, GB3: groups are available only where an enabled custom group counts", () => {
  test("a workspace whose only user groups are disabled or Slack's automatic admin and owner groups has no groups, and nobody a primary group", async () => {
    const t = testBackend();
    await joined(t, "U_ANN");
    slack
      .withUserGroup("S_ADMINS", { name: "Admins", users: ["U_ANN"], autoType: "admin" })
      .withUserGroup("S_OWNERS", { name: "Owners", users: ["U_ANN"], autoType: "owner" })
      .withUserGroup("S_OLD", { name: "Old team", users: ["U_ANN"], disabled: true });
    await sync(t);
    flagsOnForEveryone(slack.fetch, "groups");
    await flagsLoaded(t);
    const ann = await memberOf(t, "U_ANN");

    expect(await t.run((ctx) => availableIn(ctx, "T1"))).toBe(false);
    expect(await t.run((ctx) => groupsShownTo(ctx, ann))).toBe(false);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBeNull();
  });

  test("one custom group makes groups available, shown to a member only where the groups flag applies, and primary groups are recorded while it is off", async () => {
    const t = testBackend();
    await joined(t, "U_ANN");
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN"] });
    await sync(t);
    const ann = await memberOf(t, "U_ANN");

    expect(await t.run((ctx) => availableIn(ctx, "T1"))).toBe(true);
    expect(await t.run((ctx) => groupsShownTo(ctx, ann))).toBe(false);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Gardeners");

    flagsOnForEveryone(slack.fetch, "groups");
    await flagsLoaded(t);

    expect(await t.run((ctx) => groupsShownTo(ctx, ann))).toBe(true);
  });
});

describe("GB35: reconciliation pages stay within Convex's limits", () => {
  const everyone = Array.from({ length: 1_500 }, (_, index) => `U_${String(index).padStart(4, "0")}`);
  const half = everyone.filter((_, index) => index % 2 === 0);

  test("a page of 100 members who are each in 60 groups reconciles them all within Convex's limits", { timeout: 60_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const people = Array.from({ length: 100 }, (_, index) => `U_${String(index).padStart(3, "0")}`);
    const groups = Array.from({ length: 60 }, (_, index) => `S_${String(index).padStart(2, "0")}`);
    await t.run(async (ctx) => {
      for (const user of people) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      for (const group of groups) {
        await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, asOf: 0, membersAsOf: 0 });
        for (const user of people) await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user });
      }
    });
    slack.withUserGroup("S_00", { name: "S_00", users: people });

    await userGroupChanged(t, "subteam_members_changed", "S_00");
    await settle(t);

    expect(await countingGroupCountsOf(t)).toEqual({ 60: 100 });
  });

  test("a page whose people lie far apart in a large directory reads it in bounded steps and reconciles each of them", { timeout: 60_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const directory = Array.from({ length: 2_500 }, (_, index) => `U_${String(index).padStart(4, "0")}`);
    await t.run(async (ctx) => {
      for (const user of directory) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
    });
    slack.withUserGroup("S_PAIR", { name: "Pair", users: ["U_0000", "U_1500", "U_2499"] });

    await userGroupChanged(t, "subteam_created", "S_PAIR");
    await settle(t);

    expect(await primaryGroupNamesOf(t)).toEqual({ Pair: 3 });
  });

  test("a page of 100 members who each lose 60 groups at once reconciles them all within Convex's limits", { timeout: 60_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const people = Array.from({ length: 100 }, (_, index) => `U_${String(index).padStart(3, "0")}`);
    const groups = Array.from({ length: 60 }, (_, index) => `S_${String(index).padStart(2, "0")}`);
    await t.run(async (ctx) => {
      for (const user of people) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      for (const group of groups) {
        await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, asOf: 0, membersAsOf: 0 });
        for (const user of people) await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user });
      }
    });
    slack.withUserGroup("S_00", { name: "S_00", users: people });
    await userGroupChanged(t, "subteam_members_changed", "S_00");
    await settle(t);
    expect(await countingGroupCountsOf(t)).toEqual({ 60: 100 });

    const disabled = groups.map((group) => ({ workspace: "T1", group, handle: group, name: group, enabled: false, automatic: false }));
    await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed: disabled, scope: { kind: "every-group" }, asOf: Date.now() });
    await settle(t);

    expect(await countingGroupCountsOf(t)).toEqual({ 0: 100 });
  });

  test("clearing 1,001 groups disabled at 1,001 different instants schedules fewer than 1,000 functions", { timeout: 60_000 }, async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      for (let index = 0; index < 1_001; index += 1) {
        const [group, user] = [`S_${index}`, `U_${String(index).padStart(4, "0")}`];
        await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
        await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: false, automatic: false, asOf: index, changedAt: now.getTime() + index });
        await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user });
      }
    });

    await t.mutation(internal.workspace.userGroups.clearUnkeptMemberships, {});

    expect((await pendingJobs(t)).length).toBeLessThan(1_000);
  });

  test("a page whose people are each in hundreds of groups hands the rest to a new page and reconciles each of them", { timeout: 120_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    const people = Array.from({ length: 30 }, (_, index) => `U_${String(index).padStart(2, "0")}`);
    const groups = Array.from({ length: 300 }, (_, index) => `S_${String(index).padStart(3, "0")}`);
    await t.run(async (ctx) => {
      for (const user of people) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
      for (const group of groups) await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, asOf: 0, membersAsOf: 0 });
    });
    for (let start = 0; start < groups.length; start += 50) {
      await t.run(async (ctx) => {
        for (const group of groups.slice(start, start + 50)) for (const user of people) await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user });
      });
    }
    slack.withUserGroup("S_000", { name: "S_000", users: people });

    await userGroupChanged(t, "subteam_members_changed", "S_000");
    await settle(t);

    expect(await countingGroupCountsOf(t)).toEqual({ 300: 30 });
  });

  test("a group of 1,500 members joining and being disabled reconciles every member, each mutation scheduling fewer than 1,000 functions", { timeout: 300_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    await t.run(async (ctx) => {
      for (const user of everyone) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: undefined, asOf: 0 });
    });
    slack.withUserGroup("S_HALF", { name: "Half", users: half });
    await sync(t);
    slack.withUserGroup("S_BIG", { name: "Big", users: everyone });

    await userGroupChanged(t, "subteam_members_changed", "S_BIG");
    const mostPending = await settledWithMostJobsPending(t);

    expect(mostPending).toBeGreaterThanOrEqual(15);
    expect(mostPending).toBeLessThan(1_000);
    expect(await primaryGroupNamesOf(t)).toEqual({ Half: 750, Big: 750 });

    slack.withUserGroup("S_BIG", { name: "Big", users: everyone, disabled: true });
    await userGroupChanged(t, "subteam_updated", "S_BIG");

    expect(await settledWithMostJobsPending(t)).toBeLessThan(1_000);
    expect(await primaryGroupNamesOf(t)).toEqual({ Half: 750, none: 750 });
  });
});

async function sync(t: Backend) {
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
}

async function joined(t: Backend, ...users: string[]) {
  for (const user of users) {
    await memberChanged(t, "team_join", { id: user });
    await settle(t);
  }
}

export async function userGroupChanged(t: Backend, ...event: Parameters<typeof userGroupEvent>) {
  return t.fetch("/slack/events", await signedRequest(userGroupEvent(...event)));
}

async function primaryGroupNameOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await primaryGroupOf(ctx, member))?.name ?? null);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (row === null) throw new Error(`the directory doesn't know ${user}`);
    return row._id;
  });
}

async function historyOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const entries = await ctx.db
      .query("primaryGroupHistory")
      .withIndex("by_member_at", (q) => q.eq("member", member))
      .collect();
    const nameOf = async (group: Doc<"primaryGroupHistory">["group"]) => (group === null ? null : ((await ctx.db.get(group))?.name ?? null));
    return Promise.all(entries.map(async ({ from, group, cause }) => ({ from: await nameOf(from), group: await nameOf(group), cause })));
  });
}

async function primaryGroupChangesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const changes = vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is PrimaryGroupChangedEvent => event.type === "primaryGroupChanged" && event.member === member);
  return t.run(async (ctx) => {
    const nameOf = async (group: PrimaryGroupChangedEvent["to"]) => (group === null ? null : ((await ctx.db.get(group))?.name ?? null));
    return Promise.all(changes.map(async ({ from, to, cause, at }) => ({ from: await nameOf(from), to: await nameOf(to), cause, at })));
  });
}

function messagesSent() {
  return slack.calls.filter(({ method }) => method.startsWith("chat.") || method === "conversations.open");
}

async function latestChangeAt(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const latest = await ctx.db
      .query("primaryGroupHistory")
      .withIndex("by_member_at", (q) => q.eq("member", member))
      .order("desc")
      .first();
    return latest?.at;
  });
}

async function primaryGroupNameAt(t: Backend, user: string, at: number) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const group = await primaryGroupAt(ctx, member, at);
    return group === null ? null : ((await ctx.db.get(group))?.name ?? null);
  });
}

async function settledWithMostJobsPending(t: Backend) {
  let most = 0;
  while (vi.getTimerCount() > 0) {
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    most = Math.max(most, (await pendingJobs(t)).length);
  }
  return most;
}

function pendingJobs(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ state }) => state.kind === "pending"));
}

async function primaryGroupNamesOf(t: Backend) {
  return t.run(async (ctx) => {
    const counts: Record<string, number> = {};
    for (const { primary } of await ctx.db.query("memberGroups").collect()) {
      const name = primary === null ? "none" : ((await ctx.db.get(primary))?.name ?? "missing");
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  });
}

async function primaryGroupsOutsideCountingGroups(t: Backend) {
  return t.run(async (ctx) => {
    const outside = [];
    for (const person of await ctx.db.query("members").collect()) {
      const counting = person.kind === "member" ? (await userGroupsOf(ctx, person.workspace, person.user)).map(({ name }) => name) : [];
      const primary = await primaryGroupOf(ctx, person._id);
      const fits = primary === null ? counting.length === 0 : counting.includes(primary.name);
      if (!fits) outside.push({ user: person.user, primary: primary?.name ?? null, counting });
    }
    return outside;
  });
}

async function countingGroupCountsOf(t: Backend) {
  return t.run(async (ctx) => {
    const counts: Record<number, number> = {};
    for (const { groups } of await ctx.db.query("memberGroups").collect()) counts[groups.length] = (counts[groups.length] ?? 0) + 1;
    return counts;
  });
}

async function copyRecordsWithoutReconciling(t: Backend, group: string) {
  await t.action(internal.slack.userGroups.refreshMembers, { workspace: "T1", group });
}
