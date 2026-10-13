import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { insertAwards } from "../engine/awards";
import { observe } from "../engine/engine";
import type { MessageEvent } from "../engine/messageEvent";
import { standingOf } from "./progression";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("P10: every earlier award gets one record per side with base XP only, and nobody is told", async () => {
  const t = await withMembers("U_ALICE", "U_BOB", "U_CAROL");
  await givenEarlier(t, "2026-09-01", ["U_ALICE", "U_BOB", 3]);
  await givenEarlier(t, "2026-09-02", ["U_BOB", "U_CAROL", 1], ["U_BOB", "U_ALICE", 2]);
  progressionShips();

  await backfill(t);
  await settle(t);

  expect(await effectsRecords(t)).toEqual([
    { member: "U_ALICE", side: "giver", baseXp: 30, gate: null, catalogueVersion: "1", day: "2026-09-01" },
    { member: "U_ALICE", side: "recipient", baseXp: 10, gate: null, catalogueVersion: "1", day: "2026-09-02" },
    { member: "U_BOB", side: "giver", baseXp: 10, gate: null, catalogueVersion: "1", day: "2026-09-02" },
    { member: "U_BOB", side: "giver", baseXp: 20, gate: null, catalogueVersion: "1", day: "2026-09-02" },
    { member: "U_BOB", side: "recipient", baseXp: 15, gate: null, catalogueVersion: "1", day: "2026-09-01" },
    { member: "U_CAROL", side: "recipient", baseXp: 5, gate: null, catalogueVersion: "1", day: "2026-09-02" },
  ]);
  expect(await standings(t, "U_ALICE", "U_BOB", "U_CAROL")).toEqual({
    U_ALICE: { xp: 40, level: 2, skillPoints: 0 },
    U_BOB: { xp: 45, level: 2, skillPoints: 0 },
    U_CAROL: { xp: 5, level: 1, skillPoints: 0 },
  });
  expect(vi.mocked(publish)).not.toHaveBeenCalled();
  expect(slack.calls).toEqual([]);
});

test("P8: running the backfill again records nothing more", async () => {
  const t = await withMembers("U_ALICE", "U_BOB");
  await givenEarlier(t, "2026-09-01", ["U_ALICE", "U_BOB", 2]);
  progressionShips();
  expect(await backfill(t)).toEqual({ awards: 1, recorded: 2 });
  const records = await effectsRecords(t);

  expect(await backfill(t)).toEqual({ awards: 0, recorded: 0 });

  expect(await effectsRecords(t)).toEqual(records);
  expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 20, level: 2, skillPoints: 0 }, U_BOB: { xp: 10, level: 1, skillPoints: 0 } });
});

test("P8: a backfill interrupted after its first batch resumes where it stopped", async () => {
  const t = await withMembers("U_ALICE", "U_BOB");
  await givenEarlier(t, "2026-09-01", ...Array.from({ length: 150 }, (): EarlierAward => ["U_ALICE", "U_BOB", 1]));
  progressionShips();
  await t.mutation(internal.progression.backfill.replayAwards, {});

  expect(await backfill(t)).toEqual({ awards: 50, recorded: 100 });

  expect(await effectsRecords(t)).toHaveLength(300);
  expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 1500, level: 7, skillPoints: 3 }, U_BOB: { xp: 750, level: 5, skillPoints: 1 } });
});

describe("P8: an award given around the backfill is counted once", () => {
  test("when its subscriber recorded it before the backfill started", async () => {
    const t = await withMembers("U_ALICE", "U_BOB");
    await givenEarlier(t, "2026-09-01", ["U_ALICE", "U_BOB", 1]);
    progressionShips();
    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB"], "thanks for reviewing the backfill plan")));
    await settle(t);
    later(1000);

    expect(await backfill(t)).toEqual({ awards: 2, recorded: 2 });

    expect(await effectsRecords(t)).toHaveLength(4);
    expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 20, level: 2, skillPoints: 0 }, U_BOB: { xp: 10, level: 1, skillPoints: 0 } });
  });

  test("when it is given after the backfill started, it is left to its subscriber with its gate decision and level up", async () => {
    const t = await withMembers("U_ALICE", "U_BOB");
    await givenEarlier(t, "2026-09-01", ...Array.from({ length: 119 }, (): EarlierAward => ["U_BOB", "U_ALICE", 1]));
    progressionShips();
    await t.mutation(internal.progression.backfill.replayAwards, {});
    later(1000);
    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB"], "thanks for reviewing the backfill plan")));

    expect(await backfill(t)).toEqual({ awards: 19, recorded: 38 });
    await settle(t);

    const live = (await effectsRecords(t)).filter(({ gate }) => gate !== null);
    expect(live).toEqual([
      { member: "U_ALICE", side: "giver", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1", day: "2026-10-13" },
      { member: "U_BOB", side: "recipient", baseXp: 5, gate: { version: 1, thoughtful: true }, catalogueVersion: "1", day: "2026-10-13" },
    ]);
    expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 605, level: 5, skillPoints: 1 }, U_BOB: { xp: 1195, level: 6, skillPoints: 2 } });
    expect(publishedEvents("levelReached").map(({ level }) => level)).toEqual([5]);
  });

  test("when the backfill records one of its message's awards before the subscriber runs, the subscriber still records the other", async () => {
    const t = await withMembers("U_ALICE", "U_BOB", "U_CAROL");
    await givenEarlier(t, "2026-09-01", ...Array.from({ length: 99 }, (): EarlierAward => ["U_ALICE", "U_BOB", 1]));
    progressionShips();
    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB", "U_CAROL"], "thanks for reviewing the backfill plan")));
    later(1000);
    await t.mutation(internal.progression.backfill.replayAwards, {});

    await settle(t);
    expect(await backfill(t)).toEqual({ awards: 1, recorded: 0 });

    expect(await effectsRecords(t)).toHaveLength(202);
    expect(await standings(t, "U_ALICE", "U_BOB", "U_CAROL")).toEqual({
      U_ALICE: { xp: 1010, level: 6, skillPoints: 2 },
      U_BOB: { xp: 500, level: 4, skillPoints: 0 },
      U_CAROL: { xp: 5, level: 1, skillPoints: 0 },
    });
  });
});

type EarlierAward = [giver: string, recipient: string, kudos: number];

async function withMembers(...users: string[]) {
  const t = testBackend();
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
  });
  return t;
}

let messages = 0;

async function givenEarlier(t: Backend, day: string, ...awards: EarlierAward[]) {
  messages += 1;
  await t.run(async (ctx) => {
    const resolved = await Promise.all(
      awards.map(async ([giver, recipient, kudos]) => ({ giver: (await memberId(ctx, giver))!, recipient: (await memberId(ctx, recipient))!, kudos })),
    );
    await insertAwards(ctx, { workspace: "T1", conversation: "C1", message: `earlier-${messages}` }, resolved, day, Date.parse(day));
  });
}

function progressionShips() {
  later(60 * 60 * 1000);
}

function later(byMs: number) {
  vi.setSystemTime(Date.now() + byMs);
}

function kudosMessage(author: string, recipients: string[], text: string): MessageEvent {
  return {
    kind: "posted",
    ref: { workspace: "T1", conversation: "C1", message: "live" },
    author,
    revision: BigInt(Date.now()) * 1000n,
    at: Date.now(),
    content: { mentions: recipients.map((user) => ({ kind: "person", user })), emoji: ["taco"], text },
  };
}

function publishedEvents<T extends DomainEvent["type"]>(type: T) {
  const events = vi.mocked(publish).mock.calls.map(([, event]) => event);
  return events.filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}

async function backfill(t: Backend) {
  return t.action(internal.progression.backfill.backfillEffects, {});
}

async function memberId(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member?._id;
}

async function effectsRecords(t: Backend) {
  return t.run(async (ctx) => {
    const records = await ctx.db.query("effectsRecords").collect();
    const readable = await Promise.all(
      records.map(async ({ member, side, baseXp, gate, catalogueVersion, day }) => ({
        member: (await ctx.db.get(member))?.user,
        side,
        baseXp,
        gate,
        catalogueVersion,
        day,
      })),
    );
    return readable.sort((a, b) => `${a.member}${a.side}${a.baseXp}`.localeCompare(`${b.member}${b.side}${b.baseXp}`));
  });
}

async function standings(t: Backend, ...users: string[]) {
  return t.run(async (ctx) => {
    const entries = await Promise.all(users.map(async (user) => [user, await standingOf(ctx, (await memberId(ctx, user))!)] as const));
    return Object.fromEntries(entries);
  });
}
