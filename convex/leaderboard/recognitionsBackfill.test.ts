import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { post, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { HugGivenEvent } from "../bus/events";
import { insertAwards } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { totalsOf } from "./counts";

const sundayNoon = new Date("2026-10-18T12:00:00Z");
const hourMs = 60 * 60 * 1000;
const alicesKudosTs = slackTs(sundayNoon.getTime() - hourMs);
const danasKudosTs = slackTs(sundayNoon.getTime() - 2 * hourMs);
const carolsTs = slackTs(sundayNoon.getTime() - 3 * hourMs);
const nothingCounted = { kudosReceived: 0, hugsGiven: 0, hugsReceived: 0 };

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

describe("HH27: the backfill counts the kudos and hugs that came before Leaderboard counted them", () => {
  test("from the stored awards and hugs it counts what the followers would have, and running it again changes nothing", async () => {
    const t = await workspaceWithKudosAndHugs();
    const counted = await everyCount(t);

    await asBeforeLeaderboardCountedThem(t);
    expect(await countEarlierRecognitions(t)).toEqual({ kudosReceived: 3, hugsGiven: 2, hugsReceived: 3 });
    expect(await everyCount(t)).toEqual(counted);

    expect(await countEarlierRecognitions(t)).toEqual({ kudosReceived: 0, hugsGiven: 0, hugsReceived: 0 });
    expect(await everyCount(t)).toEqual(counted);
  });

  test("a kudos or hug the followers already counted counts once", async () => {
    const t = await workspaceWithKudosAndHugs();
    const counted = await everyCount(t);

    expect(await countEarlierRecognitions(t)).toEqual({ kudosReceived: 0, hugsGiven: 0, hugsReceived: 0 });
    expect(await everyCount(t)).toEqual(counted);
  });

  test("firstDay keeps the earliest giving day, whatever order the awards were stored in and whatever the followers counted first", async () => {
    const t = testBackend();
    const [ann, bea, cy] = await members(t, 3);
    await storedAward(t, ann!, cy!, { day: "2026-10-16", message: "1" });
    await storedAward(t, ann!, cy!, { day: "2026-10-14", message: "2" });
    await storedAward(t, bea!, cy!, { day: "2026-10-15", message: "3" });
    await t.action(internal.leaderboard.backfill.countEarlierKudos, {});
    await t.mutation(internal.leaderboard.hugs.countHugGiven, { event: hugGivenLive(bea!, "2026-10-13") });

    await countEarlierRecognitions(t);
    await countEarlierRecognitions(t);

    for (const period of ["week:2026-10-12", "month:2026-10", "all"]) {
      expect(await t.run((ctx) => totalsOf(ctx, ann!, period)), `Ann's ${period}`).toMatchObject({ kudosGiven: 2, firstDay: "2026-10-14" });
      expect(await t.run((ctx) => totalsOf(ctx, bea!, period)), `Bea's ${period}`).toMatchObject({ kudosGiven: 1, hugsGiven: 1, firstDay: "2026-10-13" });
    }
  });

  test("a kudos and a hug to 1,000 people count within Convex's limits", async () => {
    const t = testBackend({ transactionLimits: true });
    const [giver, hugger, ...recipients] = await members(t, 1_002);
    await kudosAndHugStoredBeforeTheFollowers(t, giver!, hugger!, recipients);
    await t.action(internal.leaderboard.backfill.countEarlierKudos, {});

    expect(await countEarlierRecognitions(t)).toEqual({ kudosReceived: 1_000, hugsGiven: 1, hugsReceived: 1_000 });

    const received = await t.run(async (ctx) => Promise.all(recipients.map(async (recipient) => totalsOf(ctx, recipient, "week:2026-10-12"))));
    expect(received.filter(({ kudosReceived, hugsReceived }) => kudosReceived === 1 && hugsReceived === 1)).toHaveLength(1_000);
    expect(await t.run((ctx) => totalsOf(ctx, giver!, "week:2026-10-12"))).toEqual({ ...nothingCounted, kudosGiven: 1_000, firstDay: "2026-10-18" });
    expect(await t.run((ctx) => totalsOf(ctx, hugger!, "week:2026-10-12"))).toEqual({ ...nothingCounted, kudosGiven: 0, hugsGiven: 1, firstDay: "2026-10-18" });
  }, 120_000);
});

async function workspaceWithKudosAndHugs() {
  const t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  await flagsLoaded(t);
  await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"], alicesKudosTs);
  await kudos(t, "U_DANA", ["U_BOB"], danasKudosTs);
  await hug(t, "U_BOB", "U_ALICE", alicesKudosTs);
  await hug(t, "U_DANA", "U_CAROL", carolsTs);
  return t;
}

async function kudos(t: Backend, giver: string, recipients: string[], ts: string) {
  await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: giver, ts });
  await settle(t);
}

async function hug(t: Backend, giver: string, author: string, ts: string) {
  await react(t, { user: giver, itemUser: author, ts });
  await settle(t);
}

async function countEarlierRecognitions(t: Backend) {
  return t.action(internal.leaderboard.backfill.countEarlierRecognitions, {});
}

async function everyCount(t: Backend) {
  return t.run(async (ctx) => {
    const days = (await ctx.db.query("givenByDay").collect()).map(({ _id, _creationTime, ...row }) => row);
    const periods = (await ctx.db.query("givenTotals").collect()).map(({ _id, _creationTime, ...row }) => row);
    return { days: sortedByMember(days), periods: sortedByMember(periods) };
  });
}

function sortedByMember<Row extends { member: MemberId }>(rows: Row[]) {
  return rows.toSorted((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
}

async function asBeforeLeaderboardCountedThem(t: Backend) {
  await t.run(async (ctx) => {
    for (const { _id } of await ctx.db.query("countedRecognitions").collect()) await ctx.db.delete(_id);
    for (const row of await ctx.db.query("givenByDay").collect()) {
      if (row.kudos === 0) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { kudosReceived: undefined, hugsGiven: undefined, hugsReceived: undefined });
    }
    for (const row of await ctx.db.query("givenTotals").collect()) {
      if (row.kudos === 0) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { kudosReceived: undefined, hugsGiven: undefined, hugsReceived: undefined, firstDay: undefined });
    }
  });
}

function members(t: Backend, count: number) {
  return t.run(async (ctx) => {
    const inserted: MemberId[] = [];
    for (let index = 0; index < count; index += 1) inserted.push(await ctx.db.insert("members", { workspace: "T1", user: `U${index}`, kind: "member", asOf: 0 }));
    return inserted;
  });
}

async function kudosAndHugStoredBeforeTheFollowers(t: Backend, giver: MemberId, hugger: MemberId, recipients: MemberId[]) {
  const message = { workspace: "T1", conversation: "C1", message: alicesKudosTs };
  const at = sundayNoon.getTime();
  await t.run(async (ctx) => {
    await insertAwards(
      ctx,
      message,
      recipients.map((recipient) => ({ giver, recipient, kudos: 1 })),
      "2026-10-18",
      at,
    );
    const hug = await ctx.db.insert("hugs", { ...message, giver: hugger, onKudos: true, emoji: "taco", at, day: "2026-10-18" });
    for (const member of recipients) await ctx.db.insert("hugPeople", { hug, member, at });
  });
}

async function storedAward(t: Backend, giver: MemberId, recipient: MemberId, { day, message }: { day: string; message: string }) {
  await t.run((ctx) => insertAwards(ctx, { workspace: "T1", conversation: "C1", message }, [{ giver, recipient, kudos: 1 }], day, Date.parse(`${day}T12:00:00Z`)));
}

function hugGivenLive(giver: MemberId, day: string): HugGivenEvent {
  return { type: "hugGiven", workspace: "T1", giver, message: { workspace: "T1", conversation: "C1", message: "9" }, onKudos: false, at: Date.parse(`${day}T12:00:00Z`), day };
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}
