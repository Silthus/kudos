import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import crons from "../crons";
import { allowanceDay } from "../engine/allowance";
import { standingOf } from "../progression/progression";
import { keepOpen } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayInAuckland = Date.parse("2026-10-18T11:00:00Z");
const mondayInUtc = Date.parse("2026-10-19T00:00:00Z");
const minuteMs = 60 * 1000;
const lastWeek = "2026-10-12";
const thisWeek = "2026-10-19";
const auckland = "Pacific/Auckland";
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P80: every Monday 00:00 in the member's time zone, the hourly sweep draws their week", () => {
  beforeEach(() => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
  });

  test("a member in Pacific/Auckland gets new quests at Monday 00:00 there, and a member without a time zone at Monday 00:00 UTC", async () => {
    const { t, alice, bob } = await workspace();
    await openQuests(t, [alice, bob], tuesday);

    await sweepAt(t, mondayInAuckland - 1);
    expect(await weeksAt(t, [alice, bob], mondayInAuckland - 1)).toEqual([lastWeek, lastWeek]);

    await sweepAt(t, mondayInAuckland);
    expect(await weeksAt(t, [alice, bob], mondayInAuckland)).toEqual([thisWeek, lastWeek]);

    await sweepAt(t, mondayInUtc - 1);
    expect(await weeksAt(t, [alice, bob], mondayInUtc - 1)).toEqual([thisWeek, lastWeek]);

    await sweepAt(t, mondayInUtc);
    expect(await weeksAt(t, [alice, bob], mondayInUtc)).toEqual([thisWeek, thisWeek]);
    expect(await drawsOf(t, alice)).toEqual([{ week: lastWeek, drawnAt: tuesday }, { week: thisWeek, drawnAt: mondayInAuckland }]);
    expect(await drawsOf(t, bob)).toEqual([{ week: lastWeek, drawnAt: tuesday }, { week: thisWeek, drawnAt: mondayInUtc }]);
  });

  test("a member who never opened Quests gets no quests from the sweep", async () => {
    const { t, alice, bob } = await workspace();
    await openQuests(t, [alice], tuesday);

    await sweepAt(t, mondayInUtc);

    expect(await drawsOf(t, bob)).toEqual([]);
  });

  test("while quests is off, the sweep draws nothing", async () => {
    const { t, alice } = await workspace();
    await openQuests(t, [alice], tuesday);
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks");
    await flagsLoaded(t);

    await sweepAt(t, mondayInUtc);

    expect(await drawsOf(t, alice)).toEqual([{ week: lastWeek, drawnAt: tuesday }]);
  });
});

describe("P80 P84: a new week's quests count every award from the week's start, whenever the draw is stored", () => {
  beforeEach(() => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
  });

  test.each([
    ["30 seconds after the boundary, before any sweep", mondayInAuckland + 30_000, "never", thisWeek],
    ["30 seconds after the boundary, delivered after a sweep at 00:10", mondayInAuckland + 30_000, "first", thisWeek],
    ["30 seconds after the boundary, delivered before a sweep at 00:10", mondayInAuckland + 30_000, "after", thisWeek],
    ["30 seconds before the boundary, delivered after a sweep at 00:10", mondayInAuckland - 30_000, "first", lastWeek],
  ] as const)("a kudos that says why %s counts once, for the week it was made in", async (_, at, sweep, countedWeek) => {
    const { t, alice, carol } = await workspace();
    await openQuests(t, [alice], tuesday);
    const event = await given(t, alice, carol, at);

    if (sweep === "first") await sweepAt(t, mondayInAuckland + 10 * minuteMs);
    vi.setSystemTime(Math.max(Date.now(), at + 1000));
    for (const delivery of [1, 2]) await t.mutation(internal.quests.quests.followKudosGiven, { event });
    if (sweep !== "never") await sweepAt(t, mondayInAuckland + 10 * minuteMs);

    expect(await countedWeeksOf(t, alice)).toEqual([countedWeek, countedWeek, countedWeek]);
    expect((await drawsOf(t, alice)).map(({ week }) => week)).toEqual([lastWeek, thisWeek]);
  });

  test("the week Quests is opened in still counts only awards after its draw", async () => {
    const { t, alice, carol } = await workspace();
    const event = await given(t, alice, carol, mondayInAuckland + 30_000);

    await openQuests(t, [alice], mondayInAuckland + 10 * minuteMs);
    await t.mutation(internal.quests.quests.followKudosGiven, { event });

    expect(await countedWeeksOf(t, alice)).toEqual([]);
  });
});

describe("P80: a new week is drawn from the facts at its start, whenever the draw is stored", () => {
  beforeEach(() => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
  });

  test("the sweep at 00:10 and a kudos at 00:00:30 that spent a kudos and thanked someone new draw the same quests, with the same facts and the week's start as their time", async () => {
    const swept = await workspace();
    const onDemand = await workspace();
    expect(onDemand.alice).toBe(swept.alice);
    await openQuests(swept.t, [swept.alice], tuesday);
    await openQuests(onDemand.t, [onDemand.alice], tuesday);

    await sweepAt(swept.t, mondayInAuckland + 10 * minuteMs);
    const event = await given(onDemand.t, onDemand.alice, onDemand.carol, mondayInAuckland + 30_000);
    await spent(onDemand.t, onDemand.alice, "2026-10-19", 1);
    vi.setSystemTime(mondayInAuckland + 10 * minuteMs);
    await onDemand.t.mutation(internal.quests.quests.followKudosGiven, { event });

    const drawnBySweep = await drawOfWeek(swept.t, swept.alice, thisWeek);
    expect(drawnBySweep.drawnAt).toBe(mondayInAuckland);
    expect(await drawOfWeek(onDemand.t, onDemand.alice, thisWeek)).toEqual(drawnBySweep);
  });

  test.each([
    ["at 00:00:00", 0],
    ["at 00:00:30", 30_000],
  ])("a first thanks to each teammate %s, the sweep at 00:10 and that kudos drawing on demand draw the same quests with the same facts", async (_, afterStart) => {
    const drawn: Array<{ drawnAt: number; slots: unknown }> = [];
    for (const onDemand of [false, true]) {
      vi.clearAllTimers();
      const { t, alice, bob, carol } = await workspace();
      await openQuests(t, [alice], tuesday);
      if (!onDemand) await sweepAt(t, mondayInAuckland + 10 * minuteMs);
      const events = [await given(t, alice, bob, mondayInAuckland + afterStart), await given(t, alice, carol, mondayInAuckland + afterStart)];
      vi.setSystemTime(mondayInAuckland + 10 * minuteMs);
      for (const event of events) await t.mutation(internal.quests.quests.followKudosGiven, { event });
      drawn.push(await drawOfWeek(t, alice, thisWeek));
    }
    expect(drawn[0]!.slots).toEqual(expect.arrayContaining([expect.objectContaining({ quest: expect.stringMatching(/^(someone-new|two-new|not-in-30-days)$/) })]));
    expect(drawn[1]).toEqual(drawn[0]);
  });

  test("a member with 1 kudos a day whose week is first drawn by their only kudos on Sunday still gets 3 quests, and that kudos counts", async () => {
    const { t, alice, carol } = await workspace();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", baseAllowance: 1 }));
    await openQuests(t, [alice], tuesday);
    const sundayInAuckland = Date.parse("2026-10-24T23:00:00Z");

    const event = await given(t, alice, carol, sundayInAuckland);
    await spent(t, alice, "2026-10-25", 1);
    vi.setSystemTime(sundayInAuckland + 1000);
    await t.mutation(internal.quests.quests.followKudosGiven, { event });

    expect((await drawOfWeek(t, alice, thisWeek)).slots).toHaveLength(3);
    expect(await countedWeeksOf(t, alice)).toContain(thisWeek);
  });

  async function drawOfWeek(t: Backend, member: MemberId, week: string) {
    const draw = await t.run(async (ctx) => (await ctx.db.query("questDraws").collect()).find((row) => row.member === member && row.week === week));
    if (!draw) throw new Error(`no draw for ${week}`);
    return { drawnAt: draw.drawnAt, slots: draw.slots };
  }

  async function spent(t: Backend, giver: MemberId, day: string, kudos: number) {
    await t.run((ctx) => ctx.db.insert("allowanceSpending", { giver, day, spent: kudos }));
  }
});

describe("P80 P85: a new week replaces the last on App Home without a penalty, and last week's crates stay openable", () => {
  const now = tuesday;
  const saysWhyWords = "thanks for untangling the release notes today";
  const form = { contentType: "application/x-www-form-urlencoded" };
  let slack: FakeSlack;
  let sentMessages = 0;

  beforeEach(() => {
    vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
    vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
    slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
    sentMessages = 0;
  });

  test("App Home opened at 00:05 on Monday shows this week's 3 new quests at 0, last week's are gone and the XP stays; last week's finished crate still opens from its DM", async () => {
    const t = await slackWorkspace();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    await drawLastWeek(t, "U_ALICE", ["say-why", "say-why-three-times", "say-why-two-days"]);
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    await giveKudos(t, "U_ALICE", "U_BOB");
    const finishedDm = slack.callsTo("chat.postMessage").find(({ text }) => String(text).startsWith("✅ You finished a quest"))!;
    const standing = await t.run(async (ctx) => standingOf(ctx, await memberOf(ctx, "U_ALICE")));

    vi.setSystemTime(mondayInUtc + 5 * minuteMs);
    await openHome(t, "U_ALICE");

    const quests = questsIn(publishedHome(slack, "U_ALICE"));
    expect(quests[0]).toBe("section: *Quests this week*");
    const freshQuest = expect.stringMatching(/ \*0\/\d\* · \*20 XP\*( \[button: Swap\])?$/);
    expect(quests.slice(1, 4)).toEqual([freshQuest, freshQuest, freshQuest]);
    expect(quests.filter((line) => line.includes("✅"))).toEqual([]);
    expect(await t.run(async (ctx) => standingOf(ctx, await memberOf(ctx, "U_ALICE")))).toEqual(standing);

    await send(t, blockActions("U_ALICE", buttonIn(finishedDm.blocks as Block[], "Open"), { inMessage: { channel: "U_ALICE", ts: "1760436000.000100" } }));

    expect(await t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).map(({ key }) => key))).toEqual([`weekly:${lastWeek}:0`]);
    expect(await t.run(async (ctx) => standingOf(ctx, await memberOf(ctx, "U_ALICE")))).toEqual(standing);
  });

  test("App Home after the Monday turn lists last week's unopened crate as waiting to open, and its Open opens it", async () => {
    const t = await slackWorkspace();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    await drawLastWeek(t, "U_ALICE", ["say-why", "say-why-three-times", "say-why-two-days"]);
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    await giveKudos(t, "U_ALICE", "U_BOB");
    vi.setSystemTime(mondayInUtc + 5 * minuteMs);

    await openHome(t, "U_ALICE");

    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Waiting to open*", "section: ✅ Thank someone and say why. You earned *20 XP*. [button: Open]"]);

    await send(t, blockActions("U_ALICE", buttonBeside("✅ Thank someone and say why.", "Open")));

    expect(await t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).map(({ key }) => key))).toEqual([`weekly:${lastWeek}:0`]);
    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual([]);
  });

  test("with 100 crates waiting from earlier weeks, App Home shows the oldest 5 and how many more within Slack's 100 blocks, and opening one brings the next", async () => {
    const t = await slackWorkspace();
    await giveKudos(t, "U_ALICE", "U_BOB");
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    await waitingFromAnEarlierWeek(t, "U_ALICE", 100);

    await openHome(t, "U_ALICE");

    const crate = "section: ✅ Thank someone and say why. You earned *20 XP*. [button: Open]";
    expect(publishedHomeBlocks(slack, "U_ALICE").length).toBeLessThanOrEqual(100);
    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Waiting to open*", crate, crate, crate, crate, crate, "context: 95 more crates from earlier weeks wait behind these."]);

    await send(t, blockActions("U_ALICE", buttonBeside("✅ Thank someone and say why.", "Open")));

    expect(await t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).map(({ key }) => key))).toEqual(["weekly:2026-10-05:0"]);
    expect(waitingIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Waiting to open*", crate, crate, crate, crate, crate, "context: 94 more crates from earlier weeks wait behind these."]);
  });

  async function waitingFromAnEarlierWeek(t: Backend, user: string, crates: number) {
    const week = "2026-10-05";
    const reward = { xp: 20, coins: 0, item: null };
    const slots = Array.from({ length: crates }, (_, slot) => ({ slot, quest: "say-why" as QuestId, reward, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
    await t.run(async (ctx) => {
      const member = await memberOf(ctx, user);
      await ctx.db.insert("questDraws", { member, week, drawnAt: Date.parse(`${week}T00:00:00Z`), slots });
      for (const { slot } of slots) {
        const key = `weekly:${week}:${slot}`;
        await ctx.db.insert("rewardRecords", { member, key, ...reward, catalogueVersion: "1", at: Date.parse("2026-10-07T10:00:00Z") + slot });
        await ctx.db.insert("pendingCrates", { member, key });
      }
    });
  }

  async function slackWorkspace() {
    const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
    return t;
  }

  async function drawLastWeek(t: Backend, user: string, quests: QuestId[]) {
    const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
    await t.run(async (ctx) => ctx.db.insert("questDraws", { member: await memberOf(ctx, user), week: lastWeek, drawnAt: now, slots }));
  }

  async function giveKudos(t: Backend, giver: string, recipient: string) {
    sentMessages += 1;
    const blocks = [section(mention(recipient), text(` ${saysWhyWords} `), emoji("taco"))];
    await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000 + sentMessages}.000100` })));
    await settle(t);
  }

  async function openHome(t: Backend, user: string) {
    await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
    await settle(t);
  }

  async function send(t: Backend, interaction: string) {
    await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
    await settle(t);
  }

  function buttonBeside(text: string, label: string) {
    return buttonIn(
      publishedHomeBlocks(slack, "U_ALICE").filter((block) => readBlocks([block]).some((line) => line.includes(text))),
      label,
    );
  }

  function waitingIn(home: string[]) {
    const start = home.indexOf("section: *Waiting to open*");
    return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
  }

  function questsIn(home: string[]) {
    const start = home.findIndex((line) => line.includes("*Quests this week*"));
    return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
  }
});

describe("P80: the hourly sweep stays within Convex's limits and draws a week once", () => {
  beforeEach(() => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
  });

  test("for 105 members who opened Quests and 5 who didn't, each sweep mutation schedules at most 100 draws, and a second run draws nothing new", async () => {
    const t = await flagsLoaded(testBackend());
    await unlocksShippedBeforeAnyoneJoined(t);
    const opened = await t.run(async (ctx) => {
      const members: MemberId[] = [];
      for (let index = 0; index < 110; index += 1) members.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member" }));
      for (const member of members.slice(0, 105)) await ctx.db.insert("unlocks", { member, feature: "quests", readyAt: tuesday, openedAt: tuesday });
      return members.slice(0, 105);
    });
    vi.setSystemTime(mondayInUtc);

    await t.mutation(sweepJob(), {});
    expect(await scheduled(t)).toEqual({ draws: 100, sweeps: 1 });
    await settle(t);
    expect(await scheduled(t)).toEqual({ draws: 105, sweeps: 1 });
    expect(await drawnMembers(t, thisWeek)).toEqual(new Set(opened));

    await sweepAt(t, mondayInUtc + 60 * minuteMs);

    expect(await scheduled(t)).toEqual({ draws: 105, sweeps: 2 });
    expect(await drawnMembers(t, thisWeek)).toEqual(new Set(opened));
    expect(await t.run(async (ctx) => (await ctx.db.query("questDraws").collect()).length)).toBe(105);
  }, 30_000);

  async function scheduled(t: Backend) {
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    return { draws: jobs.filter(({ name }) => name.includes("drawNewWeek")).length, sweeps: jobs.filter(({ name }) => name.includes("quests/newWeek")).length };
  }

  async function drawnMembers(t: Backend, week: string) {
    return new Set(await t.run(async (ctx) => (await ctx.db.query("questDraws").collect()).filter((draw) => draw.week === week).map(({ member }) => member)));
  }
});

async function workspace() {
  const t = await flagsLoaded(testBackend());
  await unlocksShippedBeforeAnyoneJoined(t);
  const [alice, bob, carol] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone: auckland }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob!, carol: carol! };
}

async function openQuests(t: Backend, members: MemberId[], at: number) {
  vi.setSystemTime(at);
  for (const member of members) await t.run((ctx) => keepOpen(ctx, { workspace: "T1", member, at }, "quests"));
  await settle(t);
}

function sweepJob() {
  const job = crons.crons["draw each member's new week of quests"];
  if (job === undefined) throw new Error("no cron job draws each member's new week of quests");
  expect(job.schedule).toEqual({ type: "interval", hours: 1 });
  return makeFunctionReference<"mutation">(job.name);
}

async function sweepAt(t: Backend, at: number) {
  vi.setSystemTime(at);
  await t.mutation(sweepJob(), {});
  await settle(t);
}

async function weeksAt(t: Backend, members: MemberId[], at: number) {
  vi.setSystemTime(at);
  const weeks: Array<string | null> = [];
  for (const member of members) weeks.push((await t.query(internal.quests.quests.questsOf, { member }))?.week?.week ?? null);
  return weeks;
}

async function drawsOf(t: Backend, member: MemberId) {
  const draws = await t.run((ctx) => ctx.db.query("questDraws").collect());
  return draws.filter((draw) => draw.member === member).map(({ week, drawnAt }) => ({ week, drawnAt }));
}

async function given(t: Backend, giver: MemberId, recipient: MemberId, at: number) {
  const timeZone = await t.run(async (ctx) => (await ctx.db.get(giver))?.timeZone);
  return t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, at, day: allowanceDay(at, timeZone) }));
}

async function countedWeeksOf(t: Backend, member: MemberId) {
  const counted = await t.run((ctx) => ctx.db.query("questProgress").collect());
  return counted.filter((row) => row.member === member).map(({ week }) => week);
}

async function memberOf(ctx: MutationCtx, user: string): Promise<MemberId> {
  return (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
}
