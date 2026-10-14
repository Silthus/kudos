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
import { setLeaderboardVisibility } from "./visibility";
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
        { position: 1, rank: 1, tied: false, group: groups.Ants, name: "Ants", perMember: 2, participation: 66, kudos: 6, members: 3, mine: true, climbed: 1 },
        { position: 2, rank: 2, tied: false, group: groups.Bees, name: "Bees", perMember: 0.8, participation: 25, kudos: 3, members: 4, mine: false, climbed: null },
      ],
      window: [1, 2],
      standing: { kind: "ranked", position: 1, rank: 1 },
      improvement: { gain: 2, places: 1 },
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

describe("GB15, GB18: groupBoardsOf gives the website the My group board", { timeout: 30_000 }, () => {
  test("the viewer's group's members ranked by the kudos they gave for it, with their places climbed, the window and the viewer's standing", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3", "A4"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A1, groups.Ants, 1, "2026-10-05");
    await attributed(t, members.A3, groups.Ants, 3, "2026-10-05");
    await attributed(t, members.A2, groups.Ants, 5, "2026-10-06");
    await attributed(t, members.A1, groups.Ants, 10, "2026-10-08");
    await attributed(t, members.A1, groups.Ants, 4, "2026-10-12");
    await attributed(t, members.A3, groups.Ants, 6, "2026-10-13");
    await attributed(t, members.A2, groups.Ants, 2, "2026-10-13");
    await attributed(t, members.B1, groups.Bees, 9, "2026-10-13");

    const board = await myGroupBoard(t, "A1", "week");

    expect(board).toEqual({
      group: { group: groups.Ants, name: "Ants" },
      rows: [
        { position: 1, rank: 1, tied: false, member: members.A3, name: "A3", picture: null, kudos: 6, viewer: false, climbed: 1 },
        { position: 2, rank: 2, tied: false, member: members.A1, name: "A1", picture: null, kudos: 4, viewer: true, climbed: 1 },
        { position: 3, rank: 3, tied: false, member: members.A2, name: "A2", picture: null, kudos: 2, viewer: false, climbed: null },
      ],
      window: [1, 2, 3],
      standing: { kind: "ranked", position: 2, rank: 2 },
    });
  });

  test("a member who switched groups mid-week keeps their earlier kudos on the old group's board and only new ones on the new board", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3", "A4"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A4, groups.Ants, 6, "2026-10-12");
    await attributed(t, members.A1, groups.Ants, 1, "2026-10-12");
    await movedTo(t, members.A4, groups.Bees);
    await attributed(t, members.A4, groups.Bees, 2, "2026-10-13");
    await attributed(t, members.B1, groups.Bees, 3, "2026-10-13");

    const bees = await myGroupBoard(t, "B1", "week");
    const ants = await myGroupBoard(t, "A1", "week");
    const groupsBoardOfAnts = await groupsBoard(t, "A1", "week");

    expect(bees?.rows.map(({ name, kudos }) => `${name} ${kudos}`)).toEqual(["B1 3", "A4 2"]);
    expect(ants?.rows.map(({ name, kudos }) => `${name} ${kudos}`)).toEqual(["A1 1"]);
    expect(groupsBoardOfAnts?.rows.find(({ name }) => name === "Ants")?.kudos).toBe(7);
  });

  test("a viewer who gave nothing for their group sees positions 1–3 and stands as not ranked", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3", "A4", "A5"] });
    for (const [index, member] of [members.A2, members.A3, members.A4, members.A5].entries()) await attributed(t, member, groups.Ants, 4 - index, "2026-10-13");

    const board = await myGroupBoard(t, "A1", "week");

    expect(board?.rows).toHaveLength(4);
    expect(board?.window).toEqual([1, 2, 3]);
    expect(board?.standing).toEqual({ kind: "not-ranked" });
  });

  test("all time ranks every kudos given for the group so far, with nothing climbed", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-08-03");
    await attributed(t, members.A2, groups.Ants, 2, "2026-10-13");

    const board = await myGroupBoard(t, "A1", "all");

    expect(board?.rows.map(({ name, kudos, climbed }) => ({ name, kudos, climbed }))).toEqual([
      { name: "A1", kudos: 3, climbed: null },
      { name: "A2", kudos: 2, climbed: null },
    ]);
  });

  test("G15: a member who is no longer a member leaves the board", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A2, groups.Ants, 3, "2026-10-13");
    await attributed(t, members.A3, groups.Ants, 2, "2026-10-13");
    await t.run((ctx) => ctx.db.patch(members.A2, { kind: "not-a-member" }));

    expect((await myGroupBoard(t, "A1", "week"))?.rows.map(({ name }) => name)).toEqual(["A3"]);
  });

  test("a viewer without a primary group gets no My group board, beside the Groups board", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-13");
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_SOLO", kind: "member", name: "Solo", asOf: 0 }));

    const boards = await t.run((ctx) => groupBoardsOf(ctx, "T1", "U_SOLO", "week"));

    expect(boards.myGroup).toBeNull();
    expect(boards.groups?.standing).toEqual({ kind: "no-group" });
  });

  test("a viewer whose group stopped counting gets no My group board", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"], Bees: ["B1", "B2", "B3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-13");
    await t.run((ctx) => ctx.db.patch(groups.Ants, { enabled: false }));

    expect(await myGroupBoard(t, "A1", "week")).toBeNull();
  });

  test.each([
    { case: "groups is off", flags: [offForEveryone("groups")], viewer: "A1" },
    { case: "the flag is unset", flags: [], viewer: "A1" },
    { case: "the directory doesn't know the viewer", flags: [onForEveryone("groups")], viewer: "U_STRANGER" },
  ])("no My group board where $case", async ({ flags, viewer }) => {
    const t = await testBackendServing(postHog, ...flags);
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-13");

    expect(await myGroupBoard(t, viewer, "week")).toBeNull();
  });
});

describe("GB18: places climbed", { timeout: 30_000 }, () => {
  test("My group board: a member who rose since last week up to the same day says how many places, and one who fell, stayed or is new says nothing", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3", "A4", "A5"] });
    for (const [member, kudos] of [[members.A1, 4], [members.A2, 3], [members.A3, 2], [members.A4, 1]] as const) await attributed(t, member, groups.Ants, kudos, "2026-10-06");
    for (const [member, kudos] of [[members.A4, 9], [members.A1, 8], [members.A5, 7], [members.A3, 6], [members.A2, 5]] as const) await attributed(t, member, groups.Ants, kudos, "2026-10-13");

    const board = await myGroupBoard(t, "A1", "week");

    expect(board?.rows.map(({ name, climbed }) => `${name} ${climbed}`)).toEqual(["A4 3", "A1 null", "A5 null", "A3 null", "A2 null"]);
  });
});

describe("G22: a member who left the boards is on nobody's board, their own included", { timeout: 30_000 }, () => {
  test("My group board: a member who left is in nobody's rows, their own included, and stands as left", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { members, groups } = await groupsOf(t, { Ants: ["A1", "A2", "A3"] });
    await attributed(t, members.A1, groups.Ants, 3, "2026-10-13");
    await attributed(t, members.A2, groups.Ants, 5, "2026-10-13");
    await t.run((ctx) => setLeaderboardVisibility(ctx, members.A2, false));

    const theirs = await myGroupBoard(t, "A2", "week");
    const another = await myGroupBoard(t, "A1", "week");

    expect(theirs?.rows.map(({ name }) => name)).toEqual(["A1"]);
    expect(theirs?.standing).toEqual({ kind: "left" });
    expect(another?.rows.map(({ name, position }) => `${position} ${name}`)).toEqual(["1 A1"]);
    expect((await groupsBoard(t, "A1", "week"))?.rows[0]).toMatchObject({ kudos: 8, participation: 66 });
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
    expect(board.myGroup?.group.name).toBe("Group 12");
    expect(board.myGroup?.rows).toHaveLength(25);
    expect(board.myGroup?.rows.every(({ kudos, rank, climbed }) => kudos === 124 && rank === 1 && climbed === null)).toBe(true);
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
    expect(board.myGroup?.rows.map(({ kudos }) => kudos)).toEqual(Array.from({ length: 25 }, () => 10));
  }, 300_000);

  test("one group of 1,500 members who all gave this month and last: the website's group boards and each of Slack's group boards read within Convex's transaction limits", async () => {
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    postHog.withFlags(onForEveryone("groups"));
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    const viewer = await oneGroupOf(t, 1_500);

    const boards = await t.run((ctx) => groupBoardsOf(ctx, "T1", viewer, "month"));
    const slackGroupsBoard = await t.query(internal.leaderboard.groupBoards.groupsBoardOf, { workspace: "T1", viewer, period: "month" });
    const slackMyGroupBoard = await t.query(internal.leaderboard.myGroupBoard.myGroupBoardViewOf, { workspace: "T1", viewer, period: "month" });

    expect(boards.groups?.rows).toEqual([expect.objectContaining({ name: "Everyone here", members: 1_500, kudos: 15_000 })]);
    expect(boards.myGroup?.rows).toHaveLength(1_500);
    expect(slackGroupsBoard).toEqual(boards.groups);
    expect(slackMyGroupBoard?.board.rows.filter((row) => !("gap" in row))).toHaveLength(10);
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

async function myGroupBoard(t: Backend, viewer: string, period: Period) {
  return (await t.run((ctx) => groupBoardsOf(ctx, "T1", viewer, period))).myGroup;
}

async function oneGroupOf(t: Backend, count: number) {
  const group = await t.run((ctx) => aUserGroup(ctx, "Everyone here", count));
  for (let first = 0; first < count; first += 500) {
    await t.run(async (ctx) => {
      for (let index = first; index < Math.min(first + 500, count); index += 1) {
        const member = await aMemberOf(ctx, `U${String(index).padStart(4, "0")}`, group);
        for (const month of ["2026-09", "2026-10"]) await ctx.db.insert("attributedTotals", { workspace: "T1", group, member, period: `month:${month}`, kudos: 10, runningTotal: [10] });
      }
    });
  }
  await t.run(async (ctx) => {
    for (const month of ["2026-09", "2026-10"]) await ctx.db.insert("attributedGroupTotals", { workspace: "T1", group, period: `month:${month}`, kudos: 10 * count, runningTotal: [10 * count] });
  });
  return "U0300";
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
