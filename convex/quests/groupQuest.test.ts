import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import crons from "../crons";
import type { GroupId } from "../groups/groups";
import { keepOpen } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const weekMs = 7 * dayMs;
const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const monday = Date.parse("2026-10-19T00:00:00Z");
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const wednesday = Date.parse("2026-10-21T10:00:00Z");
const thisWeek = "2026-10-19";
const nextWeek = "2026-10-26";
const auckland = "Pacific/Auckland";
const everyFlag = ["xp-levels", "unlocks", "quests", "groups", "group-quest"];

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: lastTuesday });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  postHog = flagsOnForEveryone(new FakeSlack().fetch, ...everyFlag);
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GB21 GB22: at Monday 00:00 UTC, the hourly sweep draws one group quest for each group of 2 or more participants", { timeout: 60_000 }, () => {
  test("a group of 4 participants gets one quest with target 3, stored with its participants, a reward of 15 coins, the catalogue version and the facts that made it feasible", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_A4"], Bees: ["U_B1", "U_B2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    await sweepAt(t, monday + 10 * minuteMs);

    expect(await groupQuestsOf(t)).toEqual([
      {
        workspace: "T1",
        group: groups.Ants,
        week: thisWeek,
        quest: expect.stringMatching(/^together-(say-why|reach-out)$/),
        participants: ["U_A1", "U_A2", "U_A3", "U_A4"].map((user) => members[user]),
        target: 3,
        reward: { xp: 0, coins: 15, item: null },
        catalogueVersion: "1",
        feasibleBecause: { participants: 4, membersOutside: 2 },
        drawnAt: monday + 10 * minuteMs,
      },
      {
        workspace: "T1",
        group: groups.Bees,
        week: thisWeek,
        quest: expect.stringMatching(/^together-(say-why|reach-out)$/),
        participants: [members.U_B1, members.U_B2],
        target: 1,
        reward: { xp: 0, coins: 15, item: null },
        catalogueVersion: "1",
        feasibleBecause: { participants: 2, membersOutside: 4 },
        drawnAt: monday + 10 * minuteMs,
      },
    ]);
  });

  test("a group of 1 participant, a member who opened Quests on Tuesday and a member who joined the group on Tuesday get none, even when the first sweep runs on Tuesday", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_LATE"], Solo: ["U_S1"] }, { groupless: ["U_NEW"] });
    await openQuests(t, [members.U_A1!, members.U_A2!, members.U_S1!, members.U_NEW!], lastTuesday);
    await launched(t);
    await openQuests(t, [members.U_LATE!], tuesday);
    await joins(t, "U_NEW", "S_ANTS", tuesday);

    await sweepAt(t, tuesday + hourMs);

    expect((await groupQuestsOf(t)).map(({ group, participants, target }) => ({ group, participants, target }))).toEqual([{ group: groups.Ants, participants: [members.U_A1, members.U_A2], target: 1 }]);
    for (const user of ["U_LATE", "U_S1", "U_NEW"]) expect(await groupQuestOf(t, members[user]!)).toBeNull();
  });

  test("a member in Pacific/Auckland is a participant of the group week that starts at Monday 00:00 UTC", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2"] }, { timeZones: { U_A1: auckland } });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    await sweepAt(t, monday - minuteMs);
    expect(await groupQuestsOf(t)).toEqual([]);

    await sweepAt(t, monday + 10 * minuteMs);
    expect((await groupQuestsOf(t)).map(({ week, participants }) => ({ week, participants }))).toEqual([{ week: thisWeek, participants: [members.U_A1, members.U_A2] }]);
  });

  test("the sweep running twice draws once, and quest drawn is sent once per participant", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"], Bees: ["U_B1", "U_B2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    await sweepAt(t, monday + 10 * minuteMs);
    await sweepAt(t, monday + hourMs + 10 * minuteMs);

    expect(await groupQuestsOf(t)).toHaveLength(2);
    expect(groupQuestsDrawn()).toHaveLength(5);
  });

  test("while group-quest is off, the sweep draws nothing; a group's first quest comes at the first Monday after group-quest applies in the workspace, never mid-week", async () => {
    postHog = flagsOnForEveryone(new FakeSlack().fetch, ...everyFlag.filter((flag) => flag !== "group-quest"));
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await sweepAt(t, lastTuesday + hourMs);

    await sweepAt(t, monday + 10 * minuteMs);
    expect(await groupQuestsOf(t)).toEqual([]);

    postHog = flagsOnForEveryone(new FakeSlack().fetch, ...everyFlag);
    await flagsLoaded(t);
    await sweepAt(t, wednesday);
    await sweepAt(t, wednesday + hourMs);
    expect(await groupQuestsOf(t)).toEqual([]);

    await sweepAt(t, monday + weekMs + 10 * minuteMs);
    expect((await groupQuestsOf(t)).map(({ group, week }) => ({ group, week }))).toEqual([{ group: groups.Ants, week: nextWeek }]);
  });

  test("a member to whom group-quest doesn't apply when the draw runs isn't a participant", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests", "groups");
    await flagsLoaded(t);

    await sweepAt(t, monday + 10 * minuteMs);

    expect(await groupQuestsOf(t)).toEqual([]);
  });
});

describe("GB22: the week's group quest is drawn deterministically among the feasible ones", { timeout: 60_000 }, () => {
  test("a group holding every member never draws together-reach-out, in 12 weeks", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    for (let week = 0; week < 12; week += 1) await sweepAt(t, monday + week * weekMs + 10 * minuteMs);

    const drawn = await groupQuestsOf(t);
    expect(drawn).toHaveLength(12);
    expect(new Set(drawn.map(({ quest }) => quest))).toEqual(new Set(["together-say-why"]));
    expect(new Set(drawn.map(({ feasibleBecause }) => feasibleBecause.membersOutside))).toEqual(new Set([0]));
  });

  test("a group with a member outside it draws both quests over 12 weeks, and another backend draws the same quest for the same group and week", async () => {
    const drawsIn = async () => {
      const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"], Bees: ["U_B1"] });
      await openQuests(t, Object.values(members), lastTuesday);
      await launched(t);
      for (let week = 0; week < 12; week += 1) await sweepAt(t, monday + week * weekMs + 10 * minuteMs);
      return (await groupQuestsOf(t)).map(({ group, week, quest }) => ({ group, week, quest }));
    };

    const first = await drawsIn();
    vi.setSystemTime(lastTuesday);
    const second = await drawsIn();

    expect(new Set(first.map(({ quest }) => quest))).toEqual(new Set(["together-say-why", "together-reach-out"]));
    expect(second).toEqual(first);
  });
});

describe("GB24 GB31 GB33: groupQuestOf and quest drawn give counts, never names", { timeout: 60_000 }, () => {
  test("groupQuestOf gives a participant their group, the quest, its goal, the week and its end, 0 of the target took part, the reward and no crate", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_A4"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await sweepAt(t, monday + 10 * minuteMs);
    vi.setSystemTime(tuesday);

    expect(await groupQuestOf(t, members.U_A1!)).toEqual({
      group: { group: groups.Ants, name: "Ants" },
      quest: "together-say-why",
      goal: "Thank someone and say why.",
      week: thisWeek,
      endsAt: monday + weekMs,
      tookPart: 0,
      target: 3,
      you: false,
      done: false,
      reward: { xp: 0, coins: 15, item: null },
      crate: null,
    });
  });

  test("together-reach-out's goal names the group", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"], Bees: ["U_B1"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    for (let week = 0; week < 12; week += 1) {
      await sweepAt(t, monday + week * weekMs + 10 * minuteMs);
      const quest = await groupQuestOf(t, members.U_A1!);
      if (quest?.quest === "together-reach-out") return expect(quest.goal).toBe("Thank someone outside Ants.");
    }
    throw new Error("Ants never drew together-reach-out in 12 weeks");
  });

  test("next week, before the sweep draws it, groupQuestOf gives nothing", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await sweepAt(t, monday + 10 * minuteMs);

    vi.setSystemTime(monday + weekMs + minuteMs);

    expect(await groupQuestOf(t, members.U_A1!)).toBeNull();
  });

  test("quest drawn goes to each participant with kind group and the quest, and no property names a group or a member", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    await sweepAt(t, monday + 10 * minuteMs);

    const [drawn] = await groupQuestsOf(t);
    const events = groupQuestsDrawn();
    expect(events.map(({ timestamp, properties: { quest, kind } }) => ({ timestamp, quest, kind }))).toEqual(
      Object.values(members).map(() => ({ timestamp: new Date(monday + 10 * minuteMs).toISOString(), quest: drawn!.quest, kind: "group" })),
    );
    expect(new Set(events.map(({ distinct_id }) => distinct_id)).size).toBe(3);
    const said = JSON.stringify(events.map(({ properties }) => properties));
    for (const named of [groups.Ants, "S_ANTS", "Ants", ...Object.keys(members), ...Object.values(members)]) expect(said).not.toContain(named);
  });
});

type Groups = Record<string, string[]>;

async function workspace(groupsByName: Groups, { timeZones = {}, groupless = [] }: { timeZones?: Record<string, string>; groupless?: string[] } = {}) {
  vi.setSystemTime(lastTuesday - weekMs);
  const t = await flagsLoaded(testBackend());
  await unlocksShippedBeforeAnyoneJoined(t);
  const at = Date.now();
  const { members, groups } = await t.run(async (ctx) => {
    const members: Record<string, MemberId> = {};
    const groups: Record<string, GroupId> = {};
    for (const [name, users] of Object.entries(groupsByName)) {
      const group = `S_${name.toUpperCase()}`;
      groups[name] = await ctx.db.insert("userGroups", { workspace: "T1", group, handle: name.toLowerCase(), name, enabled: true, automatic: false, members: users.length, asOf: at, membersAsOf: at, changedAt: at });
      for (const user of users) {
        members[user] = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: timeZones[user], asOf: at });
        await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user });
      }
    }
    for (const user of groupless) members[user] = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: at });
    return { members, groups };
  });
  await t.mutation(internal.groups.reconcile.reconcileWorkspace, { workspace: "T1" });
  await settle(t);
  vi.setSystemTime(lastTuesday);
  return { t, members, groups };
}

async function joins(t: Backend, user: string, group: string, at: number) {
  vi.setSystemTime(at);
  await t.run((ctx) => ctx.db.insert("userGroupMembers", { workspace: "T1", group, user }));
  await t.mutation(internal.groups.reconcile.reconcileUsers, { workspace: "T1", users: [user], cause: { at, groups: [group] } });
  await settle(t);
}

async function openQuests(t: Backend, members: MemberId[], at: number) {
  vi.setSystemTime(at);
  for (const member of members) await t.run((ctx) => keepOpen(ctx, { workspace: "T1", member, at }, "quests"));
  await settle(t);
}

async function launched(t: Backend) {
  await sweepAt(t, lastTuesday + hourMs);
}

function sweepJob() {
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  expect(job.schedule).toEqual({ type: "interval", hours: 1 });
  return makeFunctionReference<"mutation">(job.name);
}

async function sweepAt(t: Backend, at: number) {
  vi.setSystemTime(at);
  await t.mutation(sweepJob(), {});
  await settle(t);
}

async function groupQuestsOf(t: Backend) {
  const rows = await t.run((ctx) => ctx.db.query("groupQuests").collect());
  return rows.map(({ _id, _creationTime, ...row }) => row);
}

function groupQuestOf(t: Backend, member: MemberId) {
  return t.query(internal.quests.groupQuest.groupQuestOf, { member });
}

function groupQuestsDrawn() {
  return postHog.productEvents().filter((event) => event.event === "quest drawn" && event.properties.kind === "group");
}
