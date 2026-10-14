import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import type { FakePostHog } from "../../testing/fakePostHog";
import { signingSecret } from "../../testing/signedSlack";
import { post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { buyPerk } from "../progression/perks";
import type { PerkId } from "../progression/tree";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const skillTreeFlags = ["xp-levels", "unlocks", "skill-tree"] as const;
const wednesdayNoonUtc = new Date("2026-10-14T12:00:00Z");
const saysWhy = "thanks for untangling the release notes";

const spark = { source: "spark", xp: 5 };
const rhythm = { source: "rhythm", xp: 2 };
const circle = { source: "circle", xp: 5 };

const deliverForReal = vi.mocked(publish).getMockImplementation()!;

let postHog: FakePostHog;
let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: wednesdayNoonUtc });
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

describe("P16 P18 P20: a giver who owns spark, rhythm and circle earns their bonus XP on qualifying recognitions", () => {
  test("thanking Bob earns every line, Bob again the same day base XP only, Carol rhythm and circle, and Bob the next day spark and rhythm", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    await thank(t, "U_BOB", saysWhy, "2026-10-14T10:00:00Z");
    await thank(t, "U_CAROL", saysWhy, "2026-10-14T11:00:00Z");
    await thank(t, "U_BOB", saysWhy, "2026-10-15T09:00:00Z");

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [spark, rhythm, circle] },
      { baseXp: 10, bonus: [] },
      { baseXp: 10, bonus: [rhythm, circle] },
      { baseXp: 10, bonus: [spark, rhythm] },
    ]);
    expect(await xpOf(t, "U_ALICE")).toBe(startingXp + 22 + 10 + 17 + 17);
  });

  test.each([
    ["America/Los_Angeles", "2026-10-14T19:00:00Z", "2026-10-19T06:30:00Z", "2026-10-19T07:30:00Z"],
    ["Pacific/Auckland", "2026-10-13T23:00:00Z", "2026-10-18T10:30:00Z", "2026-10-18T11:30:00Z"],
  ])("in %s, circle pays for Bob again after Monday 00:00 in the giver's time zone, not before", async (timeZone, wednesdayNoon, sundayLate, mondayEarly) => {
    const { t } = await giverOwning(timeZone, "spark", "rhythm", "circle");

    await thank(t, "U_BOB", saysWhy, wednesdayNoon);
    await thank(t, "U_BOB", saysWhy, sundayLate);
    await thank(t, "U_BOB", saysWhy, mondayEarly);

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [spark, rhythm, circle] },
      { baseXp: 10, bonus: [spark, rhythm] },
      { baseXp: 10, bonus: [spark, rhythm, circle] },
    ]);
  });

  test("P13: a kudos that doesn't say why earns base XP only", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, "U_BOB", "thanks", "2026-10-14T09:00:00Z");

    expect(await giverRecords(t)).toEqual([{ baseXp: 10, bonus: [] }]);
    expect(await xpOf(t, "U_ALICE")).toBe(startingXp + 10);
  });

  test("P16: a kudos that doesn't say why uses up no first, so saying why to Bob later that day earns every line", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, "U_BOB", "thanks", "2026-10-14T09:00:00Z");
    await thank(t, "U_BOB", saysWhy, "2026-10-14T10:00:00Z");

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [] },
      { baseXp: 10, bonus: [spark, rhythm, circle] },
    ]);
  });

  test("P16: a multi-kudos award earns base XP per kudos and each bonus once", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z", 3);

    expect(await giverRecords(t)).toEqual([{ baseXp: 30, bonus: [spark, rhythm, circle] }]);
  });

  test("the recipient's record carries no bonus lines", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");

    expect(await recordsOf(t, "recipient")).toEqual([{ baseXp: 5, bonus: [] }]);
  });
});

describe("SW1 SW3: the giver's gains line shows the bonus XP each owned perk paid, after base XP", () => {
  test("thanking Bob and Carol in one message that says why shows +20 XP, then spark once, rhythm and circle for each, as the effects records hold", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");

    await thank(t, ["U_BOB", "U_CAROL"], saysWhy, "2026-10-14T09:00:00Z");

    expect(gainsLineTo("U_ALICE")).toBe("+20 XP · Spark bonus (+5 XP) · Rhythm bonus (+4 XP) · Circle bonus (+10 XP)");
    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [spark, rhythm, circle] },
      { baseXp: 10, bonus: [rhythm, circle] },
    ]);
  });

  test("a later kudos the same day shows only the perks it paid, and one that pays none shows base XP alone", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm");

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    await thank(t, "U_CAROL", saysWhy, "2026-10-14T10:00:00Z");
    await thank(t, "U_BOB", saysWhy, "2026-10-14T11:00:00Z");

    expect(gainsLinesTo("U_ALICE")).toEqual(["+10 XP · Spark bonus (+5 XP) · Rhythm bonus (+2 XP)", "+10 XP · Rhythm bonus (+2 XP)", "+10 XP"]);
  });

  test("a reply held for Quests keeps its bonus when released, after the quest it finished", async () => {
    const { t } = await giverOwning("UTC", "spark");
    await flagsFromPostHog(t, postHog, ...[...skillTreeFlags, "quests"].map(onForEveryone));
    await journeyShippedBeforeAnyoneJoined(t);
    await settle(t);

    await thank(t, "U_BOB", saysWhy, "2026-10-14T13:00:00Z");

    expect(gainsLineTo("U_ALICE")).toBe("+10 XP · Quest done: Give a kudos that says why (+10 XP) · Spark bonus (+5 XP)");
  });

  test("with skill-tree switched off before Slack takes the reply, the gains line shows base XP only", async () => {
    const { t } = await giverOwning("UTC", "spark");
    slack.holdingBack("chat.postEphemeral", "U_ALICE", async () => {
      await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("skill-tree"));
      slack.answering("chat.postEphemeral", rateLimitedFor(30));
    });

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");

    expect(gainsLineTo("U_ALICE")).toBe("+10 XP");
  });
});

describe("P8: the bonus is written once", () => {
  test("delivering the same kudosGiven twice writes one record and pays the bonus once", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");
    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    const [kudosGiven] = published("kudosGiven");

    await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });
    await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });

    expect(await giverRecords(t)).toEqual([{ baseXp: 10, bonus: [spark, rhythm, circle] }]);
    expect(await xpOf(t, "U_ALICE")).toBe(startingXp + 22);
  });
});

describe("P16 P21: which recognition is first follows award order, whatever order the subscriber records them in", () => {
  test("when Carol's kudos is recorded before Bob's earlier one the same day, Bob's still earns spark and Carol's doesn't", async () => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");
    const held = holdingKudosGiven();
    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    await thank(t, "U_CAROL", saysWhy, "2026-10-14T10:00:00Z");
    const [toBob, toCarol] = held;

    await record(t, toCarol!);
    await record(t, toBob!);

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [rhythm, circle] },
      { baseXp: 10, bonus: [spark, rhythm, circle] },
    ]);
  });

  test("Monday's kudos to Bob, recorded only after Tuesday's and after buying circle, earns circle; Tuesday's, recorded before the purchase, doesn't", async () => {
    const { t, alice } = await giverOwning("UTC", "spark", "rhythm");
    const held = holdingKudosGiven();
    await thank(t, "U_BOB", saysWhy, "2026-10-12T09:00:00Z");
    await thank(t, "U_BOB", saysWhy, "2026-10-13T09:00:00Z");
    const [monday, tuesday] = held;

    await record(t, tuesday!);
    expect(await t.run((ctx) => buyPerk(ctx, alice, "circle", "slack:trigger-1"))).toEqual({ kind: "bought", perk: "circle" });
    await record(t, monday!);

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [spark, rhythm] },
      { baseXp: 10, bonus: [spark, rhythm, circle] },
    ]);
  });
});

describe("P17 P21 P9: a perk pays from its purchase on, and history is kept regardless of ownership", () => {
  test("a giver who thanked Bob and said why in the morning, then buys spark, gets rhythm but no spark for thanking Carol that afternoon, and the morning's record stays as it was", async () => {
    const { t, alice } = await giverOwning("UTC", "rhythm");
    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");
    const morning = await t.run((ctx) => ctx.db.query("effectsRecords").collect());

    expect(await t.run((ctx) => buyPerk(ctx, alice, "spark", "slack:trigger-1"))).toEqual({ kind: "bought", perk: "spark" });
    await thank(t, "U_CAROL", saysWhy, "2026-10-14T15:00:00Z");

    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [rhythm] },
      { baseXp: 10, bonus: [rhythm] },
    ]);
    expect((await t.run((ctx) => ctx.db.query("effectsRecords").collect())).slice(0, morning.length)).toEqual(morning);
  });

  test("an effects record written before bonus lines existed stays valid and unchanged", async () => {
    const { t, alice } = await giverOwning("UTC", "spark", "rhythm", "circle");
    const before = await t.run(async (ctx) => {
      const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: "0", giver: alice, recipient: alice, kudos: 1, day: "2026-10-13", at: 0 });
      const id = await ctx.db.insert("effectsRecords", { award, side: "giver", member: alice, day: "2026-10-13", baseXp: 10, gate: null, catalogueVersion: "1" });
      return ctx.db.get(id);
    });

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");

    expect(await t.run((ctx) => ctx.db.get(before!._id))).toEqual(before);
    expect(await giverRecords(t)).toEqual([
      { baseXp: 10, bonus: [] },
      { baseXp: 10, bonus: [spark, rhythm, circle] },
    ]);
  });
});

describe("P5: where the skill tree doesn't apply, no bonus lines are written and owned perks stay", () => {
  test.each(skillTreeFlags)("with %s off", async (off) => {
    const { t } = await giverOwning("UTC", "spark", "rhythm", "circle");
    await flagsFromPostHog(t, postHog, ...skillTreeFlags.map((key) => (key === off ? offForEveryone : onForEveryone)(key)));

    await thank(t, "U_BOB", saysWhy, "2026-10-14T09:00:00Z");

    expect(await giverRecords(t)).toEqual([{ baseXp: 10, bonus: [] }]);
    expect(await perksOwned(t)).toEqual(["circle", "rhythm", "spark"]);
  });
});

const startingXp = 1500;

async function giverOwning(timeZone: string, ...perks: PerkId[]) {
  slack = new FakeSlack().withMember("U_ALICE", { tz: timeZone }).withMember("U_BOB").withMember("U_CAROL");
  postHog = flagsOnForEveryone(slack.fetch, ...skillTreeFlags);
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const alice = await t.run(async (ctx) => {
    const alice = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone });
    for (const user of ["U_BOB", "U_CAROL"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
    await ctx.db.insert("memberProgress", { member: alice, xp: startingXp, pointsSpent: perks.length });
    await ctx.db.insert("unlocks", { member: alice, feature: "skillTree", readyAt: 0, openedAt: 0 });
    for (const perk of perks) await ctx.db.insert("perksOwned", { member: alice, perk, boughtAt: 0, catalogueVersion: "1" });
    return alice;
  });
  return { t, alice };
}

function holdingKudosGiven() {
  const held: KudosGivenEvent[] = [];
  vi.mocked(publish).mockImplementation(async (ctx, event) => {
    if (event.type === "kudosGiven") held.push(event);
    else await deliverForReal(ctx, event);
  });
  return held;
}

async function record(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.progression.progression.recordEffects, { event });
  await settle(t);
}

async function thank(t: Backend, recipients: string | string[], words: string, at: string, kudos = 1) {
  sentMessages += 1;
  vi.setSystemTime(new Date(at));
  const ts = `${Date.parse(at) / 1000}.${String(sentMessages).padStart(6, "0")}`;
  const kudosEmoji = Array.from({ length: kudos }, () => emoji("taco"));
  const mentions = [recipients].flat().map((recipient) => mention(recipient));
  await post(t, [section(text(`${words} `), ...mentions, ...kudosEmoji)], { user: "U_ALICE", ts });
  await settleInTimeOrder(t);
}

function gainsLinesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n").at(-1));
}

function gainsLineTo(user: string) {
  return gainsLinesTo(user).at(-1);
}

async function giverRecords(t: Backend) {
  return recordsOf(t, "giver");
}

async function recordsOf(t: Backend, side: "giver" | "recipient") {
  return t.run(async (ctx) =>
    (await ctx.db.query("effectsRecords").collect()).filter((record) => record.side === side).map(({ baseXp, bonus }) => ({ baseXp, bonus: bonus ?? [] })),
  );
}

async function xpOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    return (
      await ctx.db
        .query("memberProgress")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique()
    )?.xp;
  });
}

async function perksOwned(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).map(({ perk }) => perk).sort());
}

async function memberOf(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

function published(type: "kudosGiven") {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is KudosGivenEvent => event.type === type);
}
