import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MutationCtx } from "../_generated/server";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { offForEveryone, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import type { Backend } from "../../testing/slackBackend";
import type { GroupId } from "../groups/groups";
import type { MemberId } from "../workspace/directory";
import { peerPercent } from "./peer";
import type { Period } from "./periods";
import { rankedBoardOf } from "./totals";

const tuesday = new Date("2026-10-13T10:00:00Z");

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GB16: the peer line", () => {
  test.each([
    { case: "ahead of 6 of 9 others", gain: 5, others: [1, 2, 3, 4, 0, -1, 5, 6, 8], percent: 60 },
    { case: "ahead of 5 of 9 others", gain: 5, others: [1, 2, 3, 4, 0, 5, 6, 7, 8], percent: 50 },
    { case: "ahead of every one of 3 others", gain: 2, others: [1, 0, -4], percent: 100 },
    { case: "ahead of exactly half of 8 others", gain: 5, others: [1, 2, 3, 4, 5, 6, 7, 8], percent: null },
    { case: "ahead of both of 2 others", gain: 5, others: [1, 2], percent: null },
    { case: "a gain of 0", gain: 0, others: [-1, -2, -3], percent: null },
    { case: "a loss", gain: -1, others: [-2, -3, -4], percent: null },
  ])("$case: $percent", ({ gain, others, percent }) => {
    expect(peerPercent(gain, others)).toBe(percent);
  });

  test("rankedBoardOf: a viewer ahead of 6 of 9 others in their group improved more than 60% of it, counting every kudos they gave", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { groups } = await aGroupWhoGave(t, { Ants: { viewer: [2, 7], others: [[0, 1], [0, 2], [1, 4], [0, 4], [3, 3], [4, 3], [0, 5], [1, 7], [0, 8]] }, Bees: { others: [[0, 0], [0, 0], [0, 0]] } });

    expect((await rankedBoard(t, "week")).peer).toEqual({ percent: 60, group: { group: groups.Ants, name: "Ants" } });
  });

  test.each([
    { case: "a group with 2 others", gave: { viewer: [0, 5], others: [[0, 1], [0, 1]] } },
    { case: "a gain of 0", gave: { viewer: [3, 3], others: [[3, 0], [3, 0], [3, 0]] } },
  ])("rankedBoardOf has no peer line for $case", async ({ gave }) => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    await aGroupWhoGave(t, { Ants: gave as Gave });

    expect((await rankedBoard(t, "week")).peer).toBeNull();
  });

  test("rankedBoardOf has no peer line for all time", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    await aGroupWhoGave(t, { Ants: { viewer: [0, 5], others: [[0, 1], [0, 1], [0, 1]] } });

    expect((await rankedBoard(t, "all")).peer).toBeNull();
  });

  test("rankedBoardOf has no peer line for a viewer whose group stopped counting", async () => {
    const t = await testBackendServing(postHog, onForEveryone("groups"));
    const { groups } = await aGroupWhoGave(t, { Ants: { viewer: [0, 5], others: [[0, 1], [0, 1], [0, 1]] }, Bees: { others: [] } });
    await t.run((ctx) => ctx.db.patch(groups.Ants, { enabled: false }));

    expect((await rankedBoard(t, "week")).peer).toBeNull();
  });

  test.each([
    { case: "groups is off", flags: [offForEveryone("groups")] },
    { case: "the flag is unset", flags: [] },
  ])("rankedBoardOf's peer reads null where $case", async ({ flags }) => {
    const t = await testBackendServing(postHog, ...flags);
    await aGroupWhoGave(t, { Ants: { viewer: [0, 5], others: [[0, 1], [0, 1], [0, 1]] } });

    expect((await rankedBoard(t, "week")).peer).toBeNull();
  });
});

type Given = [lastWeekUpToTuesday: number, thisWeek: number];

type Gave = { viewer?: Given; others: Given[] };

async function aGroupWhoGave<N extends string>(t: Backend, gaveIn: Record<N, Gave>) {
  return t.run(async (ctx) => {
    const groups = {} as Record<N, GroupId>;
    for (const [name, { viewer, others }] of Object.entries(gaveIn) as Array<[N, Gave]>) {
      groups[name] = await ctx.db.insert("userGroups", { workspace: "T1", group: `S_${name}`, handle: name.toLowerCase(), name, enabled: true, automatic: false, members: others.length + 1, asOf: 0, membersAsOf: 0 });
      if (viewer !== undefined) await aMemberWhoGave(ctx, "U_VIEWER", groups[name], viewer);
      for (const [index, given] of others.entries()) await aMemberWhoGave(ctx, `U_${name}_${index}`, groups[name], given);
    }
    return { groups };
  });
}

async function aMemberWhoGave(ctx: MutationCtx, user: string, group: GroupId, [lastWeek, thisWeek]: Given) {
  const member: MemberId = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", name: user, asOf: 0 });
  await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
  await ctx.db.insert("givenTotals", { workspace: "T1", member, period: "week:2026-10-05", kudos: lastWeek, runningTotal: [lastWeek, lastWeek] });
  await ctx.db.insert("givenTotals", { workspace: "T1", member, period: "week:2026-10-12", kudos: thisWeek, runningTotal: [0, thisWeek] });
  await ctx.db.insert("givenTotals", { workspace: "T1", member, period: "all", kudos: lastWeek + thisWeek });
}

function rankedBoard(t: Backend, period: Period) {
  return t.run((ctx) => rankedBoardOf(ctx, "T1", "U_VIEWER", period));
}
