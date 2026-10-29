import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { deliverAgain, post, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { HugGivenEvent, HugReceivedEvent, KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { totalsOf } from "./counts";
import { rankedBoardOf } from "./totals";

const sundayNoon = new Date("2026-10-18T12:00:00Z");
const hourMs = 60 * 60 * 1000;
const kudosTs = slackTs(sundayNoon.getTime() - hourMs);
const carolsTs = slackTs(sundayNoon.getTime() - 2 * hourMs);
const bobsKudosTs = slackTs(sundayNoon.getTime() - 3 * hourMs);
const nothing = { kudosGiven: 0, kudosReceived: 0, hugsGiven: 0, hugsReceived: 0, firstDay: null };

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: sundayNoon });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL", { tz: "Pacific/Kiritimati" }).withMember("U_DANA", { tz: "Pacific/Pago_Pago" });
  flagsOnForEveryone(slack.fetch, "hugs");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH26: Leaderboard counts every kudos and hug, each in the member's own day, week and month", () => {
  test("Alice's kudos to Carol and Dana, Bob's two to Dana and Bob's hug on Carol's message count for all four, Carol's in her Monday", async () => {
    const t = await workspace();

    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    await kudos(t, "U_BOB", ["U_DANA"], { each: 2, ts: bobsKudosTs });
    await hug(t, "U_BOB", "U_CAROL", carolsTs);

    expect(await totalsOfEveryone(t, "week:2026-10-12")).toEqual({
      U_ALICE: { ...nothing, kudosGiven: 2, firstDay: "2026-10-18" },
      U_BOB: { ...nothing, kudosGiven: 2, hugsGiven: 1, firstDay: "2026-10-18" },
      U_CAROL: nothing,
      U_DANA: { ...nothing, kudosReceived: 3 },
    });
    expect(await totalsOfEveryone(t, "week:2026-10-19"), "Carol's Sunday noon in UTC is Monday in Kiritimati").toEqual({
      U_ALICE: nothing,
      U_BOB: nothing,
      U_CAROL: { ...nothing, kudosReceived: 1, hugsReceived: 1 },
      U_DANA: nothing,
    });
    expect(await totalsOfEveryone(t, "month:2026-10")).toEqual({
      U_ALICE: { ...nothing, kudosGiven: 2, firstDay: "2026-10-18" },
      U_BOB: { ...nothing, kudosGiven: 2, hugsGiven: 1, firstDay: "2026-10-18" },
      U_CAROL: { ...nothing, kudosReceived: 1, hugsReceived: 1 },
      U_DANA: { ...nothing, kudosReceived: 3 },
    });
    expect(await totalsOfEveryone(t, "all")).toEqual(await totalsOfEveryone(t, "month:2026-10"));
    expect(await dayOf(t, "U_CAROL", "2026-10-19")).toEqual({ kudos: 0, kudosReceived: 1, hugsReceived: 1 });
    expect(await dayOf(t, "U_DANA", "2026-10-18")).toEqual({ kudos: 0, kudosReceived: 1 });
    expect(await dayOf(t, "U_DANA", "2026-10-17"), "Bob's 09:00 UTC is Saturday night in Pago Pago").toEqual({ kudos: 0, kudosReceived: 2 });
    expect(await dayOf(t, "U_BOB", "2026-10-18")).toEqual({ kudos: 2, hugsGiven: 1 });
  });

  test("each follower delivered again counts nothing twice", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    await kudos(t, "U_BOB", ["U_DANA"], { each: 2, ts: bobsKudosTs });
    await hug(t, "U_BOB", "U_CAROL", carolsTs);
    const counted = { thisWeek: await totalsOfEveryone(t, "week:2026-10-12"), nextWeek: await totalsOfEveryone(t, "week:2026-10-19"), all: await totalsOfEveryone(t, "all") };

    await deliverAgain(t, "leaderboard/totals:countKudosGiven");
    await deliverAgain(t, "leaderboard/hugs:countHugGiven");
    await deliverAgain(t, "leaderboard/hugs:countHugReceived");

    expect({ thisWeek: await totalsOfEveryone(t, "week:2026-10-12"), nextWeek: await totalsOfEveryone(t, "week:2026-10-19"), all: await totalsOfEveryone(t, "all") }).toEqual(counted);
    expect(await dayOf(t, "U_CAROL", "2026-10-19")).toEqual({ kudos: 0, kudosReceived: 1, hugsReceived: 1 });
  });

  test("a kudos to 1,000 people counts each one's kudos received in pages, within Convex's limits, once however often it is delivered", async () => {
    const t = testBackend({ transactionLimits: true });
    const [giver, ...recipients] = await members(t, 1_001);
    const event = await kudosGivenTo(t, giver!, recipients);

    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });
    await settle(t);
    await deliverAgain(t, "leaderboard/totals:countKudosGiven");

    const received = await t.run(async (ctx) => Promise.all(recipients.map(async (recipient) => (await totalsOf(ctx, recipient, "week:2026-10-12")).kudosReceived)));
    expect(received.filter((kudos) => kudos === 1), "recipients counted exactly once").toHaveLength(1_000);
    expect(await t.run((ctx) => totalsOf(ctx, giver!, "week:2026-10-12"))).toEqual({ ...nothing, kudosGiven: 1_000, firstDay: "2026-10-18" });
  }, 120_000);

  test("firstDay is the earliest day in the period the member gave a hug or a kudos, whatever order the facts arrive in, and receiving sets none", async () => {
    const t = testBackend();
    const [ann, bea] = await members(t, 2);

    await t.mutation(internal.leaderboard.hugs.countHugGiven, { event: hugGiven(ann!, { day: "2026-10-15", message: "1" }) });
    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: await kudosGivenTo(t, ann!, [bea!], { day: "2026-10-13", message: "2" }) });
    await t.mutation(internal.leaderboard.hugs.countHugGiven, { event: hugGiven(ann!, { day: "2026-10-17", message: "3" }) });
    await t.mutation(internal.leaderboard.hugs.countHugReceived, { event: hugReceived(ann!, bea!) });

    expect(await t.run((ctx) => totalsOf(ctx, ann!, "week:2026-10-12"))).toEqual({ ...nothing, kudosGiven: 1, hugsGiven: 2, firstDay: "2026-10-13" });
    expect(await t.run((ctx) => totalsOf(ctx, ann!, "month:2026-10"))).toMatchObject({ firstDay: "2026-10-13" });
    expect(await t.run((ctx) => totalsOf(ctx, bea!, "week:2026-10-12"))).toEqual({ ...nothing, kudosReceived: 1, hugsReceived: 1 });
  });
});

describe("HH26: the boards still rank only kudos given", () => {
  test("a member who only received kudos and hugs, last week and this, is on no board and gets no line", async () => {
    const t = testBackend();
    const [ann, bea] = await members(t, 2);
    await t.run((ctx) => ctx.db.patch(bea!, { name: "Bea" }));
    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: await kudosGivenTo(t, ann!, [bea!], { day: "2026-10-06", message: "1" }) });
    await t.mutation(internal.leaderboard.hugs.countHugReceived, { event: hugReceived(ann!, bea!) });
    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: await kudosGivenTo(t, ann!, [bea!], { day: "2026-10-13", message: "2" }) });

    for (const period of ["week", "month", "all"] as const) {
      const board = await t.run((ctx) => rankedBoardOf(ctx, "T1", "U1", period));
      expect(board.rows.map(({ member }) => member), `${period}: only Ann gave`).toEqual([ann]);
      expect(board.improvement, `${period}: Bea has no line`).toBeNull();
    }
  });
});

async function workspace() {
  const t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  return flagsLoaded(t);
}

async function kudos(t: Backend, giver: string, recipients: string[], { each = 1, ts = kudosTs } = {}) {
  await post(t, [section(...recipients.map((user) => mention(user)), ...Array.from({ length: each }, () => emoji("taco")))], { user: giver, ts });
  await settle(t);
}

async function hug(t: Backend, giver: string, author: string, ts: string) {
  await react(t, { user: giver, itemUser: author, ts });
  await settle(t);
}

const everyone = ["U_ALICE", "U_BOB", "U_CAROL", "U_DANA"] as const;

async function totalsOfEveryone(t: Backend, period: string) {
  const totals = await Promise.all(everyone.map(async (user) => [user, await t.run(async (ctx) => totalsOf(ctx, await memberIn(ctx, user), period))] as const));
  return Object.fromEntries(totals);
}

async function dayOf(t: Backend, user: string, day: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const row = await ctx.db
      .query("givenByDay")
      .withIndex("by_member_day", (q) => q.eq("member", member).eq("day", day))
      .unique();
    if (row === null) return null;
    const { _id, _creationTime, workspace, member: _member, day: _day, ...counts } = row;
    return counts;
  });
}

async function memberIn(ctx: QueryCtx, user: string): Promise<MemberId> {
  const row = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return row!._id;
}

function members(t: Backend, count: number) {
  return t.run(async (ctx) => {
    const inserted: MemberId[] = [];
    for (let index = 0; index < count; index += 1) inserted.push(await ctx.db.insert("members", { workspace: "T1", user: `U${index}`, kind: "member", asOf: 0 }));
    return inserted;
  });
}

type Given = { day?: string; message?: string };

async function kudosGivenTo(t: Backend, giver: MemberId, recipients: MemberId[], { day = "2026-10-18", message = "1" }: Given = {}): Promise<KudosGivenEvent> {
  const at = Date.parse(`${day}T12:00:00Z`);
  const awards = await t.run(async (ctx) => {
    const inserted: Array<{ award: Id<"awards">; giver: MemberId; recipient: MemberId; kudos: number }> = [];
    for (const recipient of recipients) inserted.push({ award: await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day, at }), giver, recipient, kudos: 1 });
    return inserted;
  });
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message },
    giver,
    awards,
    via: "message",
    kudosEmoji: "taco",
    annotations: {},
    allowance: { dailyOpening: 5, dailyLeft: 0 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day,
    at,
  };
}

function hugGiven(giver: MemberId, { day = "2026-10-18", message = "1" }: Given = {}): HugGivenEvent {
  return { type: "hugGiven", workspace: "T1", giver, message: { workspace: "T1", conversation: "C1", message }, onKudos: false, at: Date.parse(`${day}T12:00:00Z`), day };
}

function hugReceived(giver: MemberId, person: MemberId): HugReceivedEvent {
  return { type: "hugReceived", workspace: "T1", giver, person, message: { workspace: "T1", conversation: "C1", message: "9" }, at: Date.parse("2026-10-14T12:00:00Z"), week: "2026-10-12" };
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}
