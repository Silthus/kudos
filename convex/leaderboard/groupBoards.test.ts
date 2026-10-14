import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, offForEveryone, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import type { GroupId } from "../groups/groups";
import type { MemberId } from "../workspace/directory";
import { groupBoardsOf } from "./groupBoards";
import type { Period } from "./periods";

const tuesday = new Date("2026-10-13T10:00:00Z");

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GB13, GB14, GB18: groupBoardsOf gives the website the Groups board", { timeout: 30_000 }, () => {
  test("ranked rows with their places climbed, the window, the viewer's standing, the group's line and the most improved group", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"], Bees: ["B1", "B2", "B3", "B4"], Pair: ["P1", "P2"] });
    await attributed(t, members.B1, groups.Bees, 8, "2026-10-06");
    await attributed(t, members.B2, groups.Bees, 5, "2026-10-08");
    await attributed(t, members.A1, groups.Ants, 4, "2026-10-12");
    await attributed(t, members.A2, groups.Ants, 2, "2026-10-13");
    await attributed(t, members.B1, groups.Bees, 3, "2026-10-13");
    await attributed(t, members.P1, groups.Pair, 10, "2026-10-13");

    const board = await groupsBoard(t, "A1", "week");

    expect(board).toEqual({
      rows: [
        { position: 1, rank: 1, tied: false, group: groups.Ants, name: "Ants", perMember: 2, participation: 66, kudos: 6, members: 3, mine: true, climbed: null },
        { position: 2, rank: 2, tied: false, group: groups.Bees, name: "Bees", perMember: 0.8, participation: 25, kudos: 3, members: 4, mine: false, climbed: null },
      ],
      window: [1, 2],
      standing: { kind: "ranked", position: 1, rank: 1 },
      improvement: { gain: 2 },
      mostImproved: { group: groups.Ants, name: "Ants", gain: 2 },
    });
  });

  test("a group's kudos stay with it after their giver moves to another group, who no longer counts for its participation", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3", "A4"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A4, groups.Ants, 6, "2026-10-12");
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-12");
    await movedTo(t, members.A4, groups.Bees);

    const board = await groupsBoard(t, "B1", "month");

    expect(board?.rows.map(({ name, kudos, members, participation }) => ({ name, kudos, members, participation }))).toEqual([
      { name: "Ants", kudos: 9, members: 3, participation: 33 },
      { name: "Bees", kudos: 0, members: 4, participation: 0 },
    ]);
    expect(board?.standing).toEqual({ kind: "ranked", position: 2, rank: 2 });
    expect(board?.improvement).toBeNull();
  });

  test("a group that gave less than last period up to the same day has its best completed period per person instead", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 12, "2026-09-28");
    await attributed(t, members.A2, groups.Ants, 3, "2026-09-29");
    await attributed(t, members.A1, groups.Ants, 4, "2026-10-05");
    await attributed(t, members.A1, groups.Ants, 1, "2026-10-12");

    const board = await groupsBoard(t, "A1", "week");

    expect(board?.improvement).toEqual({ best: 5 });
    expect(board?.mostImproved).toBeNull();
  });

  test("all time ranks every kudos attributed so far, with no line and nothing climbed", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-08-03");
    await attributed(t, members.B1, groups.Bees, 6, "2026-09-14");
    await attributed(t, members.A2, groups.Ants, 9, "2026-10-13");

    const board = await groupsBoard(t, "A1", "all");

    expect(board?.rows.map(({ name, kudos, climbed }) => ({ name, kudos, climbed }))).toEqual([
      { name: "Ants", kudos: 12, climbed: null },
      { name: "Bees", kudos: 6, climbed: null },
    ]);
    expect(board?.improvement).toBeNull();
    expect(board?.mostImproved).toBeNull();
  });

  test.each([
    { case: "groups is off", flags: [offForEveryone("groups")], viewer: "A1" },
    { case: "the flag is unset", flags: [], viewer: "A1" },
    { case: "the directory doesn't know the viewer", flags: [onForEveryone("groups")], viewer: "U_STRANGER" },
  ])("no Groups board where $case", async ({ flags, viewer }) => {
    const t = await testBackendServing(postHog, ...flags);
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-13");

    expect(await groupsBoard(t, viewer, "week")).toBeNull();
  });

  test("GB1, GB13: a group disabled in Slack leaves the board at once, before reconciliation moves its members", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A1, groups.Ants, 6, "2026-10-13");
    await attributed(t, members.B1, groups.Bees, 3, "2026-10-13");
    await t.run((ctx) => ctx.db.patch(groups.Ants, { enabled: false }));

    const board = await groupsBoard(t, "A1", "week");

    expect(board?.rows.map(({ name }) => name)).toEqual(["Bees"]);
    expect(board?.standing).toEqual({ kind: "not-listed" });
    expect(board?.mostImproved).toMatchObject({ name: "Bees" });
  });

  test("no Groups board where no group counts", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await t.run((ctx) => ctx.db.patch(groups.Ants, { enabled: false }));

    expect(await groupsBoard(t, "A1", "week")).toBeNull();
  });
});

describe("GB35: the Groups board at scale", () => {
  test("1,500 members in 60 groups giving every day for two months: the month board and its comparison read within Convex's transaction limits", async () => {
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    postHog.withFlags(onForEveryone("groups"));
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    const viewer = await sixtyGroupsOf(t, 1_500);
    await eachGaveDailyFor(t, "2026-09", 30, (group) => 1 + (group % 5));
    await eachGaveDailyFor(t, "2026-10", 31, (group) => 1 + ((group + 1) % 5));

    const board = await t.run((ctx) => groupBoardsOf(ctx, "T1", viewer, "month"));

    expect(board.groups?.rows).toHaveLength(60);
    expect(board.groups?.rows[0]).toMatchObject({ name: "Group 03", perMember: 155, participation: 100, kudos: 3_875, members: 25, climbed: 12 });
    expect(board.groups?.standing).toEqual({ kind: "ranked", position: 15, rank: 13 });
    expect(board.groups?.improvement).toEqual({ gain: 34, places: 12 });
    expect(board.groups?.mostImproved).toMatchObject({ name: "Group 03", gain: 35 });
  }, 120_000);

  test("1,500 members who each gave for their group and 10 earlier ones in each of September and October: the month board reads one range per current member within Convex's transaction limits", async () => {
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    postHog.withFlags(onForEveryone("groups"));
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    const viewer = await sixtyGroupsOf(t, 1_500);
    await eachGaveForTheirGroupAndTenEarlierOnes(t, ["2026-09", "2026-10"]);

    const board = await t.run((ctx) => groupBoardsOf(ctx, "T1", viewer, "month"));

    expect(board.groups?.rows).toHaveLength(60);
    expect(board.groups?.rows.every(({ perMember, participation, kudos, climbed }) => perMember === 20 && participation === 100 && kudos === 500 && climbed === null)).toBe(true);
    expect(board.groups?.improvement).toEqual({ best: 20 });
  }, 300_000);
});

type GroupsOf<N extends string, U extends string> = { groups: Record<N, GroupId>; members: Record<U, MemberId> };

async function groupsOf<N extends string, U extends string>(t: Backend, membersOf: Record<N, U[]>): Promise<GroupsOf<N, U>> {
  return t.run(async (ctx) => {
    const groups = {} as Record<N, GroupId>;
    const members = {} as Record<U, MemberId>;
    for (const [name, users] of Object.entries(membersOf) as Array<[N, U[]]>) {
      groups[name] = await aUserGroup(ctx, name, users.length);
      for (const user of users) members[user] = await aMemberOf(ctx, user, groups[name]);
    }
    return { groups, members };
  });
}

function aUserGroup(ctx: MutationCtx, name: string, members: number) {
  return ctx.db.insert("userGroups", { workspace: "T1", group: `S_${name.toUpperCase()}`, handle: name.toLowerCase(), name, enabled: true, automatic: false, members, asOf: 0, membersAsOf: 0 });
}

async function aMemberOf(ctx: MutationCtx, user: string, group: GroupId) {
  const member = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", name: user, asOf: 0 });
  await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
  return member;
}

async function movedTo(t: Backend, member: MemberId, group: GroupId) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("memberGroups")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(row!._id, { groups: [group], primary: group });
  });
}

let messages = 0;

async function attributed(t: Backend, giver: MemberId, group: GroupId, kudos: number, day: string) {
  const message = { workspace: "T1", conversation: "C1", message: String(messages++) };
  const event = { type: "awardsAttributed" as const, workspace: "T1", message, giver, group, kudos, day, at: Date.parse(`${day}T09:00:00Z`), awards: [] };
  await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event });
}

async function groupsBoard(t: Backend, viewer: string, period: Period) {
  return (await t.run((ctx) => groupBoardsOf(ctx, "T1", viewer, period))).groups;
}

let groupIds: GroupId[] = [];
let membersByGroup: Array<Array<Id<"members">>> = [];

async function sixtyGroupsOf(t: Backend, count: number) {
  const perGroup = count / 60;
  groupIds = [];
  membersByGroup = [];
  await t.run(async (ctx) => {
    for (let group = 0; group < 60; group += 1) {
      const name = `Group ${String(group).padStart(2, "0")}`;
      const id = await aUserGroup(ctx, name, perGroup);
      groupIds.push(id);
      const members = [];
      for (let index = 0; index < perGroup; index += 1) members.push(await aMemberOf(ctx, `U${String(group * perGroup + index).padStart(4, "0")}`, id));
      membersByGroup.push(members);
    }
  });
  return "U0300";
}

async function eachGaveDailyFor(t: Backend, month: string, days: number, kudos: (group: number) => number) {
  await t.run(async (ctx) => {
    for (const [index, group] of groupIds.entries()) {
      const runningTotal = Array.from({ length: days }, (_, day) => kudos(index) * (day + 1));
      for (const member of membersByGroup[index]!) await ctx.db.insert("attributedTotals", { workspace: "T1", group, member, period: `month:${month}`, kudos: kudos(index) * days, runningTotal });
      const members = membersByGroup[index]!.length;
      await ctx.db.insert("attributedGroupTotals", { workspace: "T1", group, period: `month:${month}`, kudos: kudos(index) * days * members, runningTotal: runningTotal.map((total) => total * members) });
    }
  });
}

async function eachGaveForTheirGroupAndTenEarlierOnes(t: Backend, months: string[]) {
  for (const month of months) {
    for (const [index, group] of groupIds.entries()) {
      await t.run(async (ctx) => {
        for (const member of membersByGroup[index]!) {
          await ctx.db.insert("attributedTotals", { workspace: "T1", group, member, period: `month:${month}`, kudos: 10, runningTotal: [10] });
          for (let earlier = 1; earlier <= 10; earlier += 1) await ctx.db.insert("attributedTotals", { workspace: "T1", group: groupIds[(index + earlier) % 60]!, member, period: `month:${month}`, kudos: 1, runningTotal: [1] });
        }
        await ctx.db.insert("attributedGroupTotals", { workspace: "T1", group, period: `month:${month}`, kudos: 25 * 10 + 10 * 25, runningTotal: [500] });
      });
    }
  }
}
