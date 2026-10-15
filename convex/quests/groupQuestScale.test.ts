import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import type { FakePostHog } from "../../testing/fakePostHog";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import crons from "../crons";
import type { GroupId } from "../groups/groups";
import type { MemberId } from "../workspace/directory";

const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const memberCount = 1_500;
const groupCount = 60;
const seededPerTransaction = 100;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: lastTuesday });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests", "groups", "group-quest");
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GB35: the group quest draw stays within Convex's limits per mutation", () => {
  test("in a workspace of 1,500 members in 60 groups who all opened Quests, the Monday sweep draws 60 group quests with under 1,000 scheduled functions", { timeout: 600_000 }, async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await unlocksShippedBeforeAnyoneJoined(t);
    await workspaceOfGroupsWhoOpenedQuests(t, groupCount);

    vi.setSystemTime(mondaySweep);
    await t.mutation(sweepJob(), {});
    await settle(t);

    const drawn = await t.run((ctx) => ctx.db.query("groupQuests").take(groupCount + 1));
    expect(drawn).toHaveLength(groupCount);
    expect(new Set(drawn.map(({ participants }) => participants.length))).toEqual(new Set([memberCount / groupCount]));
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").take(1_000)).length)).toBeLessThan(1_000);
  });

  test("a single group of 1,500 participants draws its quest and records quest drawn for every participant", { timeout: 600_000 }, async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await unlocksShippedBeforeAnyoneJoined(t);
    await workspaceOfGroupsWhoOpenedQuests(t, 1);

    vi.setSystemTime(mondaySweep);
    await t.mutation(sweepJob(), {});
    await settle(t);

    const drawn = await t.run((ctx) => ctx.db.query("groupQuests").take(2));
    expect(drawn.map(({ participants, target }) => ({ participants: participants.length, target }))).toEqual([{ participants: memberCount, target: 3 }]);
    expect(postHog.productEvents().filter((event) => event.event === "quest drawn" && event.properties.kind === "group")).toHaveLength(memberCount);
  });
});

async function workspaceOfGroupsWhoOpenedQuests(t: Backend, groupCount: number) {
  const groups = await t.run(async (ctx) => {
    const groups: GroupId[] = [];
    for (let index = 0; index < groupCount; index += 1) {
      const group = groupKeyOf(index);
      groups.push(await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group, name: group, enabled: true, automatic: false, members: memberCount / groupCount, asOf: 0, membersAsOf: 0 }));
    }
    await ctx.db.insert("groupQuestLaunches", { workspace: "T1", at: 0 });
    return groups;
  });
  for (let start = 0; start < memberCount; start += seededPerTransaction) {
    await t.run(async (ctx) => {
      for (let index = start; index < start + seededPerTransaction; index += 1) {
        const user = `U_${String(index).padStart(4, "0")}`;
        const member: MemberId = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: 0 });
        const group = groups[index % groupCount]!;
        await ctx.db.insert("userGroupMembers", { workspace: "T1", group: groupKeyOf(index % groupCount), user });
        await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
        await ctx.db.insert("primaryGroupHistory", { workspace: "T1", member, from: null, group, cause: "default", at: 0 });
        await ctx.db.insert("unlocks", { member, feature: "quests", readyAt: 0, openedAt: 0 });
      }
    });
  }
}

function groupKeyOf(index: number) {
  return `S_${String(index).padStart(3, "0")}`;
}

function sweepJob() {
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  return makeFunctionReference<"mutation">(job.name);
}
