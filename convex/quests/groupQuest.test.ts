import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { api, internal } from "../_generated/api";
import crons from "../crons";
import type { GroupId } from "../groups/groups";
import { pickPrimaryGroup } from "../groups/pick";
import { reconcileMember } from "../groups/reconcile";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { opens } from "../../testing/unlocks";
import { aSignedInSession } from "../../testing/website";
import { achievementsLiveIn } from "../achievements/flag";
import { keepOpen } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { standingOf } from "../progression/progression";
import { openQuestCrate } from "./open";

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const weekMs = 7 * dayMs;
const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const monday = Date.parse("2026-10-19T00:00:00Z");
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const wednesday = Date.parse("2026-10-21T10:00:00Z");
const saturday = Date.parse("2026-10-24T10:00:00Z");
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

  test("a member deactivated on Tuesday, before the week's first sweep, stays one of Monday's participants, so the target stays 3", async () => {
    const { t, members } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_A4"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await deactivated(t, members.U_A4!, tuesday);

    await sweepAt(t, tuesday + hourMs);

    expect((await groupQuestsOf(t)).map(({ participants, target }) => ({ participants, target }))).toEqual([{ participants: ["U_A1", "U_A2", "U_A3", "U_A4"].map((user) => members[user]), target: 3 }]);
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

  test("a group that holds every member's primary group when the draw runs never draws together-reach-out, even when one of them was outside it at Monday 00:00, in 12 weeks", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_SWITCH"], Bees: ["U_SWITCH"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    for (let week = 0; week < 12; week += 1) {
      await picks(t, members.U_SWITCH!, groups.Bees!, monday + week * weekMs - minuteMs);
      await picks(t, members.U_SWITCH!, groups.Ants!, monday + week * weekMs + 5 * minuteMs);
      await sweepAt(t, monday + week * weekMs + 10 * minuteMs);
    }

    const drawn = await groupQuestsOf(t);
    expect(drawn.map(({ group }) => group)).toEqual(Array.from({ length: 12 }, () => groups.Ants));
    expect(new Set(drawn.map(({ quest }) => quest))).toEqual(new Set(["together-say-why"]));
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

  test("groupQuestOf gives each participant how many took part and whether they did, done once the target is reached, and a crate only to a contributor", async () => {
    const { t, members, groups } = await antsOfFiveDrew();
    await gives(t, members.U_A1!, members.U_A2!, tuesday);
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ tookPart: 1, target: 3, you: true, done: false, crate: null });
    expect(await groupQuestOf(t, members.U_A2!)).toMatchObject({ tookPart: 1, target: 3, you: false, done: false, crate: null });

    await gives(t, members.U_A2!, members.U_A1!, tuesday);
    await gives(t, members.U_A3!, members.U_A1!, tuesday);
    await gives(t, members.U_A4!, members.U_A1!, tuesday);

    const key = groupRewardKey(groups.Ants!, thisWeek);
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ tookPart: 3, target: 3, you: true, done: true, crate: { key, opened: false } });
    expect(await groupQuestOf(t, members.U_A5!)).toMatchObject({ tookPart: 3, target: 3, you: false, done: true, crate: null });
    const said = JSON.stringify(await groupQuestOf(t, members.U_A5!));
    for (const named of ["U_A1", "U_A2", "U_A3", "U_A4", members.U_A1!, members.U_A2!, members.U_A3!, members.U_A4!]) expect(said).not.toContain(named);
  });

  test("quest finished goes to each rewarded contributor with kind group, the quest and the reward, and no property names a group or a member", async () => {
    const { t, members, groups } = await antsOfFiveDrew();
    await gives(t, members.U_A1!, members.U_A2!, tuesday);
    await gives(t, members.U_A2!, members.U_A1!, tuesday);
    await gives(t, members.U_A3!, members.U_A1!, tuesday);

    const events = groupQuestsFinished();
    expect(events.map(({ properties: { kind, quest, xp, coins } }) => ({ kind, quest, xp, coins }))).toEqual([0, 1, 2].map(() => ({ kind: "group", quest: "together-say-why", xp: 0, coins: 15 })));
    expect(new Set(events.map(({ distinct_id }) => distinct_id)).size).toBe(3);
    const said = JSON.stringify(events.map(({ properties }) => properties));
    for (const named of [groups.Ants, "S_ANTS", "Ants", ...Object.keys(members), ...Object.values(members)]) expect(said).not.toContain(named);
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

describe("GB22 GB23: participants finish the group quest together, and each contributor gets the reward once", { timeout: 60_000 }, () => {
  test("three participants who each give a kudos that says why reach the target and get one reward each; a fourth on Saturday gets one at their contribution; one next Monday gets none", async () => {
    const { t, members, groups } = await antsOfFiveDrew();
    const [ann, al, amy, abe, ada] = [members.U_A1!, members.U_A2!, members.U_A3!, members.U_A4!, members.U_A5!];

    await gives(t, ann, al, tuesday);
    await gives(t, al, amy, tuesday + hourMs);
    expect(await groupRewardsOf(t)).toEqual([]);
    await gives(t, amy, ann, wednesday);
    expect(await groupRewardsOf(t)).toEqual([ann, al, amy].map((member) => groupReward(member, groups.Ants!, thisWeek)));

    await gives(t, abe, ann, saturday);
    expect(await groupRewardsOf(t)).toEqual([ann, al, amy, abe].map((member) => groupReward(member, groups.Ants!, thisWeek)));

    await gives(t, ada, ann, monday + weekMs + hourMs);
    expect(await groupRewardsOf(t)).toEqual([ann, al, amy, abe].map((member) => groupReward(member, groups.Ants!, thisWeek)));
  });

  test("for together-say-why, a kudos that doesn't say why isn't a contribution and one that does is", async () => {
    const { t, members } = await antsOfFiveDrew();

    await gives(t, members.U_A1!, members.U_A2!, tuesday, { saysWhy: false });
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ quest: "together-say-why", tookPart: 0, you: false });

    await gives(t, members.U_A1!, members.U_A2!, tuesday + hourMs);
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ quest: "together-say-why", tookPart: 1, you: true });
  });

  test("together-reach-out counts a kudos to a recipient whose primary group at the spend instant isn't the group, and not one to a fellow member", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3"], Bees: ["U_B1"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    const weekStart = await firstWeekDrawing(t, groups.Ants!, "together-reach-out");

    await gives(t, members.U_A1!, members.U_A2!, weekStart + dayMs, { saysWhy: true });
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ quest: "together-reach-out", tookPart: 0, you: false });

    await gives(t, members.U_A1!, members.U_B1!, weekStart + dayMs + hourMs, { saysWhy: false });
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ quest: "together-reach-out", tookPart: 1, you: true });
  });

  test("a kudos spent Sunday 23:59 UTC and processed on Monday counts for the week it was spent in", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2"] }, { timeZones: { U_A1: auckland } });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await sweepAt(t, monday + 10 * minuteMs);

    await gives(t, members.U_A1!, members.U_A2!, monday + weekMs - minuteMs, { processedAt: monday + weekMs + 5 * minuteMs });

    expect(await groupRewardsOf(t)).toEqual([groupReward(members.U_A1!, groups.Ants!, thisWeek)]);
  });

  test("a kudos spent on Monday and processed before the week's draw counts once the draw runs, once", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);

    await gives(t, members.U_A1!, members.U_A2!, monday + 5 * minuteMs);
    await sweepAt(t, monday + 10 * minuteMs);
    expect(await groupRewardsOf(t)).toEqual([groupReward(members.U_A1!, groups.Ants!, thisWeek)]);

    await redeliverLatestAwardsAttributed(t);
    expect(await groupRewardsOf(t)).toEqual([groupReward(members.U_A1!, groups.Ants!, thisWeek)]);
    expect(await groupQuestOf(t, members.U_A2!)).toMatchObject({ tookPart: 1, done: true });
  });

  test("two kudos from one participant count one contribution, and a redelivered awardsAttributed changes nothing", async () => {
    const { t, members } = await antsOfFiveDrew();

    await gives(t, members.U_A1!, members.U_A2!, tuesday);
    await gives(t, members.U_A1!, members.U_A3!, wednesday);
    await redeliverLatestAwardsAttributed(t);
    await redeliverLatestAwardsAttributed(t);

    expect(await groupQuestOf(t, members.U_A2!)).toMatchObject({ tookPart: 1, you: false, done: false });
    expect(await groupRewardsOf(t)).toEqual([]);
  });

  test("a redelivered awardsAttributed of the contribution that reaches the target records each reward once and sends quest finished once each", async () => {
    const { t, members } = await antsOfFiveDrew();
    await gives(t, members.U_A1!, members.U_A2!, tuesday);
    await gives(t, members.U_A2!, members.U_A3!, tuesday);
    await gives(t, members.U_A3!, members.U_A1!, tuesday);

    await redeliverLatestAwardsAttributed(t);

    expect(await groupRewardsOf(t)).toHaveLength(3);
    expect(groupQuestsFinished()).toHaveLength(3);
  });
});

describe("GB36: the week's lifecycle", { timeout: 60_000 }, () => {
  test("a participant who switched group mid-week contributes nothing more to the old quest, and what they contributed stays", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_SWITCH", "U_MOVER"], Bees: ["U_SWITCH", "U_MOVER", "U_B1", "U_B2", "U_B3", "U_B4"] });
    await picks(t, members.U_SWITCH!, groups.Ants!, lastTuesday);
    await picks(t, members.U_MOVER!, groups.Ants!, lastTuesday);
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await sweepAt(t, monday + 10 * minuteMs);

    await gives(t, members.U_SWITCH!, members.U_B1!, tuesday);
    await picks(t, members.U_SWITCH!, groups.Bees!, wednesday);
    await picks(t, members.U_MOVER!, groups.Bees!, wednesday);
    await gives(t, members.U_SWITCH!, members.U_B1!, wednesday + hourMs);
    await gives(t, members.U_MOVER!, members.U_B2!, wednesday + hourMs);
    expect(await groupQuestOf(t, members.U_MOVER!)).toMatchObject({ group: { group: groups.Ants, name: "Ants" }, tookPart: 1, you: false });
    await gives(t, members.U_A1!, members.U_B1!, wednesday + hourMs);
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ tookPart: 2, done: false });
    await gives(t, members.U_A2!, members.U_B1!, wednesday + hourMs);

    expect(await groupQuestOf(t, members.U_SWITCH!)).toMatchObject({ group: { group: groups.Ants, name: "Ants" }, tookPart: 3, you: true, done: true });
    expect(await groupQuestOf(t, members.U_B1!)).toMatchObject({ tookPart: 0, you: false });
    expect((await groupRewardsOf(t)).map(({ member, key }) => ({ member, key }))).toEqual(
      [members.U_A1!, members.U_A2!, members.U_SWITCH!].map((member) => ({ member, key: groupRewardKey(groups.Ants!, thisWeek) })),
    );
  });

  test("archiving the group mid-week ends its quest: later kudos contribute nothing, and the rewards already recorded stay", async () => {
    const { t, members, groups } = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_A4"], Bees: ["U_B1", "U_B2"] });
    await openQuests(t, Object.values(members), lastTuesday);
    await launched(t);
    await sweepAt(t, monday + 10 * minuteMs);
    await gives(t, members.U_B1!, members.U_A1!, tuesday);
    await gives(t, members.U_A1!, members.U_B1!, tuesday);
    await gives(t, members.U_A2!, members.U_B1!, tuesday);

    await archived(t, "Bees", wednesday);
    await archived(t, "Ants", wednesday);
    await gives(t, members.U_B2!, members.U_A1!, wednesday + hourMs);
    await gives(t, members.U_A3!, members.U_B1!, wednesday + hourMs);

    expect((await groupRewardsOf(t)).map(({ member, key }) => ({ member, key }))).toEqual([{ member: members.U_B1!, key: groupRewardKey(groups.Bees!, thisWeek) }]);
    expect(await t.run((ctx) => ctx.db.query("groupQuestContributions").collect())).toHaveLength(3);
  });

  test("while group-quest is off nothing is recorded; turned on again in the same week, contributions count from then", async () => {
    const { t, members } = await antsOfFiveDrew();
    postHog = flagsOnForEveryone(new FakeSlack().fetch, ...everyFlag.filter((flag) => flag !== "group-quest"));
    await flagsLoaded(t);

    await gives(t, members.U_A1!, members.U_A2!, tuesday);
    expect(await t.run((ctx) => ctx.db.query("groupQuestContributions").collect())).toEqual([]);

    postHog = flagsOnForEveryone(new FakeSlack().fetch, ...everyFlag);
    await flagsLoaded(t);
    await gives(t, members.U_A2!, members.U_A1!, wednesday);

    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ tookPart: 1, you: false });
    expect(await groupQuestOf(t, members.U_A2!)).toMatchObject({ tookPart: 1, you: true });
  });
});

describe("GB23 P85: a group reward's crate waits for its member and opens once", { timeout: 60_000 }, () => {
  test("a contributor's reward is a pending crate that groupQuestOf shows and openQuestCrate opens once; a participant without the reward can't open it", async () => {
    const { t, members, groups } = await antsOfFiveDrew();
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const crate = { kind: "group" as const, group: groups.Ants!, week: thisWeek };
    const key = groupRewardKey(groups.Ants!, thisWeek);
    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ crate: { key, opened: false } });

    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A1!, crate))).toBe("done");
    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A1!, crate))).toBe("done");
    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A4!, crate))).toBe("refused");
    await settle(t);

    expect(await groupQuestOf(t, members.U_A1!)).toMatchObject({ crate: { key, opened: true } });
    expect(await t.run((ctx) => ctx.db.query("crateOpenings").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("pendingCrates").collect())).toEqual([members.U_A2!, members.U_A3!].map((member) => expect.objectContaining({ member, key })));
    expect(postHog.productEvents().filter(({ event }) => event === "crate opened").map(({ properties: { kind, quest } }) => ({ kind, quest }))).toEqual([{ kind: "group", quest: "together-say-why" }]);
  });
});

describe("CL6: a group quest's crate drops one hoggie", { timeout: 60_000 }, () => {
  test("a contributor's group crate opened twice while collection is on stores one drop and publishes hoggie dropped once, with the group crate's kind", async () => {
    const { t, members, groups } = await antsOfFiveDrew();
    await flagsFromPostHog(t, postHog, ...[...everyFlag, "collection"].map(onForEveryone));
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const crate = { kind: "group" as const, group: groups.Ants!, week: thisWeek };

    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A1!, crate))).toBe("done");
    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A1!, crate))).toBe("done");
    await settle(t);

    expect(await t.run((ctx) => ctx.db.query("drops").collect())).toEqual([expect.objectContaining({ member: members.U_A1!, crate: groupRewardKey(groups.Ants!, thisWeek), n: 1, copy: 1 })]);
    expect(postHog.productEvents().filter(({ event }) => event === "hoggie dropped").map(({ properties: { crate_kind } }) => crate_kind)).toEqual(["group"]);
  });

  test("the website's open of a group crate answers its one drop while collection is on, and the same drop again", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const { t, members, groups } = await antsOfFiveDrew();
    await flagsFromPostHog(t, postHog, ...[...everyFlag, "website", "collection"].map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const { asSignedIn } = await aSignedInSession(t, { user: "U_A1" });
    const openGroupCrate = () => asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: { kind: "group", group: groups.Ants!, week: thisWeek } });

    const first = await openGroupCrate();
    const [stored] = await t.run((ctx) => ctx.db.query("drops").collect());

    expect(first).toEqual({ kind: "opened", applied: null, drop: expect.objectContaining({ hoggie: stored!.hoggie, rarity: stored!.rarity, copy: 1, isNew: true }) });
    expect(await openGroupCrate()).toEqual(first);
  });

  test("with collection off, the website's open of a group crate answers main's opened, stores no drop and exposes collection false once", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const { t, members, groups } = await antsOfFiveDrew();
    await flagsFromPostHog(t, postHog, ...[...everyFlag, "website"].map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const { asSignedIn } = await aSignedInSession(t, { user: "U_A1" });
    const openGroupCrate = () => asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: { kind: "group", group: groups.Ants!, week: thisWeek } });

    expect(await openGroupCrate()).toEqual({ kind: "opened", applied: null });
    expect(await openGroupCrate()).toEqual({ kind: "opened", applied: null });
    await settle(t);

    expect(await t.run((ctx) => ctx.db.query("drops").collect())).toEqual([]);
    expect(postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === "collection").map(({ properties }) => properties.$feature_flag_response)).toEqual([false]);
  });
});

describe("CV13: a pack pays its bonus once", { timeout: 60_000 }, () => {
  test("CV2 CV5: a group crate opened from App Home's open path and then on the website pays one bonus inside band v1, and the website answers it", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const { t, members, groups } = await antsOfFiveDrew();
    await flagsFromPostHog(t, postHog, ...[...everyFlag, "website", "collection", "packs"].map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const crate = { kind: "group" as const, group: groups.Ants!, week: thisWeek };
    const { asSignedIn } = await aSignedInSession(t, { user: "U_A1" });
    const before = await t.run((ctx) => standingOf(ctx, members.U_A1!));

    expect(await t.run((ctx) => openQuestCrate(ctx, members.U_A1!, crate))).toBe("done");
    const answer = await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: crate });
    const after = await t.run((ctx) => standingOf(ctx, members.U_A1!));

    expect(answer).toEqual({ kind: "opened", applied: { xp: after.xp - before.xp, coins: 0, from: { ...before, coins: 0 }, to: { ...after, coins: 0 } }, drop: expect.objectContaining({ copy: 1 }) });
    expect([5, 10, 15, 20, 25], "the group crate's bonus XP inside band v1").toContain(after.xp - before.xp);
    expect(await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: crate }), "the repeated open").toEqual(answer);
    expect(await t.run((ctx) => standingOf(ctx, members.U_A1!)), "the standing after the repeated open").toEqual(after);
  });
});

describe("CV7 CV8: a group crate in the pack stack", { timeout: 60_000 }, () => {
  test("waits in getCollection's packs only while the group quest applies, and openCrate opens it as openQuestCrate does", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const { t, members, groups } = await antsOfFiveDrew();
    const flags = [...everyFlag, "website", "achievements", "collection", "packs"];
    await flagsFromPostHog(t, postHog, ...flags.map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    await t.run((ctx) => achievementsLiveIn(ctx, "T1"));
    await opens(t, members.U_A1!, "book");
    for (const [giver, recipient] of [["U_A1", "U_A2"], ["U_A2", "U_A3"], ["U_A3", "U_A1"]] as const) await gives(t, members[giver]!, members[recipient]!, tuesday);
    const quest = { kind: "group" as const, group: groups.Ants!, week: thisWeek };
    const crate = `group:${groups.Ants}:${thisWeek}`;
    const { asSignedIn } = await aSignedInSession(t, { user: "U_A1" });
    const packsOf = async () => {
      const answer = await asSignedIn.query(api.website.collection.getCollection, {});
      return answer.kind === "collection" ? answer.packs : answer;
    };

    expect(await packsOf(), "while the group quest applies").toContainEqual({ crate, kind: "group", n: expect.any(Number) });
    await flagsFromPostHog(t, postHog, ...flags.filter((flag) => flag !== "group-quest").map(onForEveryone));
    expect(await packsOf(), "with group-quest off").not.toContainEqual(expect.objectContaining({ crate }));
    expect(await asSignedIn.mutation(api.website.commands.openCrate, { crate }), "openCrate with group-quest off").toEqual({ kind: "refused" });
    await flagsFromPostHog(t, postHog, ...flags.map(onForEveryone));

    const answer = await asSignedIn.mutation(api.website.commands.openCrate, { crate });
    expect(answer).toEqual({ kind: "opened", applied: expect.objectContaining({ xp: expect.any(Number) }), drop: expect.objectContaining({ copy: 1 }) });
    expect(await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest }), "openQuestCrate's answer").toEqual(answer);
    expect(await packsOf(), "once opened").not.toContainEqual(expect.objectContaining({ crate }));
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
        members[user] ??= await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: timeZones[user], asOf: at });
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
  await t.mutation(internal.groups.reconcile.reconcileUsers, { workspace: "T1", users: [user] });
  await settle(t);
}

async function deactivated(t: Backend, member: MemberId, at: number) {
  vi.setSystemTime(at);
  await t.run(async (ctx) => {
    await ctx.db.patch(member, { kind: "not-a-member" });
    await reconcileMember(ctx, member, at);
  });
  await settle(t);
}

async function picks(t: Backend, member: MemberId, group: GroupId, at: number) {
  vi.setSystemTime(at);
  await t.run((ctx) => pickPrimaryGroup(ctx, member, group));
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

function groupQuestsFinished() {
  return postHog.productEvents().filter((event) => event.event === "quest finished" && event.properties.kind === "group");
}

async function antsOfFiveDrew() {
  const drawn = await workspace({ Ants: ["U_A1", "U_A2", "U_A3", "U_A4", "U_A5"] });
  await openQuests(drawn.t, Object.values(drawn.members), lastTuesday);
  await launched(drawn.t);
  await sweepAt(drawn.t, monday + 10 * minuteMs);
  return drawn;
}

async function firstWeekDrawing(t: Backend, group: GroupId, quest: string) {
  for (let week = 0; week < 12; week += 1) {
    const weekStart = monday + week * weekMs;
    await sweepAt(t, weekStart + 10 * minuteMs);
    const drawn = await t.run((ctx) => ctx.db.query("groupQuests").collect());
    if (drawn.some((row) => row.group === group && row.drawnAt === weekStart + 10 * minuteMs && row.quest === quest)) return weekStart;
  }
  throw new Error(`the group never drew ${quest} in 12 weeks`);
}

let messages = 0;

async function gives(t: Backend, giver: MemberId, recipient: MemberId, at: number, { saysWhy = true, processedAt = at }: { saysWhy?: boolean; processedAt?: number } = {}) {
  vi.setSystemTime(processedAt);
  messages += 1;
  const message = { workspace: "T1", conversation: "C1", message: `${Math.floor(at / 1000)}.${String(messages).padStart(6, "0")}` };
  const saidWhy = saysWhy ? { annotations: { gate: { version: 1, thoughtful: true, words: 7 } } } : {};
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { message, at, day: new Date(at).toISOString().slice(0, 10), ...saidWhy }));
  await t.mutation(internal.groups.attribution.attributeKudosGiven, { event });
  await settle(t);
}

async function redeliverLatestAwardsAttributed(t: Backend) {
  const attribution = await t.run((ctx) => ctx.db.query("attributions").order("desc").first());
  if (attribution === null) throw new Error("nothing was attributed");
  const { _id, _creationTime, conversation, message, ...facts } = attribution;
  const event = { type: "awardsAttributed" as const, message: { workspace: facts.workspace, conversation, message }, ...facts };
  await t.mutation(internal.quests.groupQuest.followAwardsAttributed, { event });
  await settle(t);
}

async function archived(t: Backend, name: string, at: number) {
  vi.setSystemTime(at);
  const group = `S_${name.toUpperCase()}`;
  const listed = [{ workspace: "T1", group, handle: name.toLowerCase(), name, enabled: false, automatic: false }];
  await t.mutation(internal.workspace.userGroups.keepUserGroups, { listed, scope: { kind: "one-group", workspace: "T1", group }, asOf: at });
  await settle(t);
}

function groupRewardKey(group: GroupId, week: string) {
  return `group:${group}:${week}`;
}

function groupReward(member: MemberId, group: GroupId, week: string) {
  return { member, key: groupRewardKey(group, week), xp: 0, coins: 15, item: null, catalogueVersion: "1" };
}

async function groupRewardsOf(t: Backend) {
  const rows = await t.run((ctx) => ctx.db.query("rewardRecords").collect());
  const inMemberOrder = rows.toSorted((one, other) => one.member.localeCompare(other.member) || one.key.localeCompare(other.key));
  return inMemberOrder.filter(({ key }) => key.startsWith("group:")).map(({ member, key, xp, coins, item, catalogueVersion }) => ({ member, key, xp, coins, item, catalogueVersion }));
}
