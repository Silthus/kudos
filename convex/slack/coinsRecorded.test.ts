import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const saysWhy = "thanks for untangling the release notes";
const giving = { source: "giving", coins: 4 };
const receiving = { source: "receiving", coins: 2 };

const deliverForReal = vi.mocked(publish).getMockImplementation()!;

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-14T08:00:00Z") });
  vi.mocked(publish).mockClear();
  vi.mocked(publish).mockImplementation(deliverForReal);
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CO1 CO2 CO3: a kudos that says why records coins in the wallet, whatever the flags say", () => {
  test.each([
    ["every flag off", workspaceWithFlagsOff],
    ["xp-levels, unlocks and skill-tree on", workspaceWithSkillTree],
  ])("with %s, thanking Bob and Carol records 4 coins on each giver record and 2 on each recipient record", async (_, workspace) => {
    const t = await workspace();

    await thank(t, "U_ALICE", ["U_BOB", "U_CAROL"], saysWhy, "2026-10-14T09:00:00Z");

    expect(await coinsOn(t, "U_ALICE")).toEqual([[giving], [giving]]);
    expect(await coinsOn(t, "U_BOB")).toEqual([[receiving]]);
    expect(await coinsOn(t, "U_CAROL")).toEqual([[receiving]]);
    expect(await balances(t, "U_ALICE", "U_BOB", "U_CAROL")).toEqual({ U_ALICE: 8, U_BOB: 2, U_CAROL: 2 });
  }, 30_000);

  test("a second kudos to Bob the same day records no giving coins, and no receiving coins from the same giver", async () => {
    const t = await workspaceWithFlagsOff();

    await thank(t, "U_ALICE", "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    await thank(t, "U_ALICE", "U_BOB", saysWhy, "2026-10-14T10:00:00Z");

    expect(await coinsOn(t, "U_ALICE")).toEqual([[giving], []]);
    expect(await coinsOn(t, "U_BOB")).toEqual([[receiving], []]);
    expect(await balances(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: 4, U_BOB: 2 });
  }, 30_000);

  test("a kudos that doesn't say why records none and opens no wallet", async () => {
    const t = await workspaceWithFlagsOff();

    await thank(t, "U_ALICE", "U_BOB", "thanks", "2026-10-14T09:00:00Z");

    expect(await coinsOn(t, "U_ALICE")).toEqual([[]]);
    expect(await coinsOn(t, "U_BOB")).toEqual([[]]);
    expect(await balances(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: 0, U_BOB: 0 });
    expect(await t.run((ctx) => ctx.db.query("wallets").collect())).toEqual([]);
  }, 30_000);

  test("CO5: redelivering an award whose records were written before coins existed writes and credits nothing", async () => {
    const t = await workspaceWithFlagsOff();
    const held = holdingKudosGiven();
    await thank(t, "U_ALICE", "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    const [kudosGiven] = held;
    const before = await t.run(async (ctx) => {
      const award = kudosGiven!.awards[0]!.award;
      const day = kudosGiven!.day;
      const gate = { version: 1, thoughtful: true };
      await ctx.db.insert("effectsRecords", { award, side: "giver", member: kudosGiven!.giver, day, baseXp: 10, gate, catalogueVersion: "1" });
      await ctx.db.insert("effectsRecords", { award, side: "recipient", member: kudosGiven!.awards[0]!.recipient, day, baseXp: 5, gate, catalogueVersion: "1" });
      return ctx.db.query("effectsRecords").collect();
    });

    await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });

    expect(await t.run((ctx) => ctx.db.query("effectsRecords").collect())).toEqual(before);
    expect(await balances(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: 0, U_BOB: 0 });
    expect(await t.run((ctx) => ctx.db.query("receivingGivers").collect())).toEqual([]);
  }, 30_000);
});

describe("CO3: a giver pays a recipient receiving coins at most once a week, and a recipient gets at most 20 receiving coins a week", () => {
  test("the eleventh different giver in Bob's week pays nothing", async () => {
    const givers = Array.from({ length: 11 }, (_, giver) => `U_GIVER_${giver + 1}`);
    const t = await workspaceWithFlagsOff(...givers);

    for (const [index, giver] of givers.entries()) await thank(t, giver, "U_BOB", saysWhy, `2026-10-14T09:${String(index).padStart(2, "0")}:00Z`);

    expect(await coinsOn(t, "U_BOB")).toEqual([...Array.from({ length: 10 }, () => [receiving]), []]);
    expect(await balances(t, "U_BOB")).toEqual({ U_BOB: 20 });
  }, 30_000);

  test.each([
    ["America/Los_Angeles", "2026-10-14T19:00:00Z", "2026-10-19T06:30:00Z", "2026-10-19T07:30:00Z"],
    ["Pacific/Auckland", "2026-10-13T23:00:00Z", "2026-10-18T10:30:00Z", "2026-10-18T11:30:00Z"],
  ])("with Bob in %s, Alice pays him once in his week and again after Monday 00:00 in his time zone", async (timeZone, wednesdayNoon, sundayLate, mondayEarly) => {
    const t = await workspaceWithFlagsOff();
    await bobLivesIn(t, timeZone);

    await thank(t, "U_ALICE", "U_BOB", saysWhy, wednesdayNoon);
    await thank(t, "U_ALICE", "U_BOB", saysWhy, sundayLate);
    await thank(t, "U_ALICE", "U_BOB", saysWhy, mondayEarly);

    expect(await coinsOn(t, "U_BOB")).toEqual([[receiving], [], [receiving]]);
    expect(await balances(t, "U_BOB")).toEqual({ U_BOB: 4 });
  }, 30_000);

  test("a kudos that doesn't say why uses up no giver, so Alice saying why later in the week pays", async () => {
    const t = await workspaceWithFlagsOff();

    await thank(t, "U_ALICE", "U_BOB", "thanks", "2026-10-14T09:00:00Z");
    await thank(t, "U_ALICE", "U_BOB", saysWhy, "2026-10-15T09:00:00Z");

    expect(await coinsOn(t, "U_BOB")).toEqual([[], [receiving]]);
  }, 30_000);
});

describe("CO5 CO9: the same kudosGiven delivered twice records each side once and credits the wallet once", () => {
  test("a redelivery and a retried subscriber write one record per side and leave the balances as the first delivery left them", async () => {
    const t = await workspaceWithFlagsOff();
    const held = holdingKudosGiven();
    await thank(t, "U_ALICE", ["U_BOB", "U_CAROL"], saysWhy, "2026-10-14T09:00:00Z");
    const [kudosGiven] = held;

    for (let delivery = 0; delivery < 3; delivery += 1) await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });

    expect(await coinsOn(t, "U_ALICE")).toEqual([[giving], [giving]]);
    expect(await coinsOn(t, "U_BOB")).toEqual([[receiving]]);
    expect(await balances(t, "U_ALICE", "U_BOB", "U_CAROL")).toEqual({ U_ALICE: 8, U_BOB: 2, U_CAROL: 2 });
    expect(await t.run((ctx) => ctx.db.query("receivingGivers").collect())).toHaveLength(2);
  }, 30_000);
});

describe("CO1 CO5: a kudos to more members than one mutation records every one of them, once", () => {
  test("thanking 250 people records a receiving line for each and credits each once, and a redelivery writes nothing", async () => {
    const recipients = Array.from({ length: 250 }, (_, index) => `U_R${index + 1}`);
    const t = await workspaceWithFlagsOff(...recipients);
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", baseAllowance: 1_000 }));
    const held = holdingKudosGiven();
    await thank(t, "U_ALICE", recipients, saysWhy, "2026-10-14T09:00:00Z");
    const [kudosGiven] = held;

    for (let delivery = 0; delivery < 2; delivery += 1) {
      await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });
      await settleInTimeOrder(t);
    }

    expect(await recipientLinesOf(t, recipients)).toEqual(recipients.map(() => [receiving]));
    expect(await coinsOn(t, "U_ALICE")).toEqual(recipients.map(() => [giving]));
    expect(await t.run(async (ctx) => (await ctx.db.query("wallets").collect()).map(({ balance }) => balance).sort((a, b) => a - b))).toEqual([...recipients.map(() => 2), 1_000]);
  }, 120_000);
});

async function recipientLinesOf(t: Backend, users: string[]) {
  return t.run(async (ctx) => {
    const records = await ctx.db.query("effectsRecords").collect();
    const lines = [];
    for (const user of users) {
      const member = await memberOf(ctx, user);
      lines.push(records.filter((record) => record.member === member).map(({ coins }) => coins ?? []));
    }
    return lines.map((perRecord) => perRecord.flat());
  });
}

async function workspaceWithFlagsOff(...givers: string[]) {
  slack = withMembers(givers);
  vi.stubGlobal("fetch", slack.fetch);
  return withDirectory(testBackend(), givers);
}

async function workspaceWithSkillTree() {
  slack = withMembers([]);
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
  return withDirectory(await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend())), []);
}

function withMembers(givers: string[]) {
  return [...givers, "U_ALICE", "U_BOB", "U_CAROL"].reduce((fake, user) => fake.withMember(user, { tz: "UTC" }), new FakeSlack());
}

async function withDirectory(t: Backend, givers: string[]) {
  await t.run(async (ctx) => {
    for (const user of [...givers, "U_ALICE", "U_BOB", "U_CAROL"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
  });
  return t;
}

async function bobLivesIn(t: Backend, timeZone: string) {
  await t.run(async (ctx) => ctx.db.patch(await memberOf(ctx, "U_BOB"), { timeZone }));
}

function holdingKudosGiven() {
  const held: KudosGivenEvent[] = [];
  vi.mocked(publish).mockImplementation(async (ctx, event) => {
    if (event.type === "kudosGiven") held.push(event);
    else await deliverForReal(ctx, event);
  });
  return held;
}

async function thank(t: Backend, giver: string, recipients: string | string[], words: string, at: string) {
  sentMessages += 1;
  vi.setSystemTime(new Date(at));
  const ts = `${Date.parse(at) / 1000}.${String(sentMessages).padStart(6, "0")}`;
  const mentions = [recipients].flat().map((recipient) => mention(recipient));
  await post(t, [section(text(`${words} `), ...mentions, emoji("taco"))], { user: giver, ts });
  await settleInTimeOrder(t);
}

async function coinsOn(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    const records = await ctx.db.query("effectsRecords").collect();
    return records.filter((record) => record.member === member).map(({ coins }) => coins ?? []);
  });
}

async function balances(t: Backend, ...users: string[]) {
  const answers: Record<string, number> = {};
  for (const user of users) {
    answers[user] = await t.run(async (ctx) => balanceOf(ctx, await memberOf(ctx, user)));
  }
  return answers;
}

async function memberOf(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}
