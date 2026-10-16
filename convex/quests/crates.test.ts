import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withoutCollectionExposure } from "../../testing/hoggies";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import { crateOpeningOf } from "./crates";
import { openQuestCrate } from "./open";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const finishedAt = now.getTime();
const openedAt = finishedAt + 60_000;
const weekMs = 7 * 24 * 60 * 60 * 1000;
const firstThanks = { kind: "journey", step: "first-thanks" } as const;
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CR3 P92: opening a crate applies its held reward once", () => {
  test("opening a crate whose reward counted at its finish writes only one crate opening beside its reward record, without what it applied, and publishes only questOpened", async () => {
    const { t, alice } = await withFinishedFirstThanks();
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();
    vi.setSystemTime(openedAt);

    expect(await open(t, alice)).toBe("done");

    const after = await everyTable(t);
    expect(withoutCollectionExposure({ ...after, crateOpenings: [] })).toEqual(before);
    expect(after.crateOpenings).toEqual([{ _id: expect.anything(), _creationTime: expect.any(Number), member: alice, key: "journey:first-thanks", at: openedAt }]);
    expect(published()).toEqual([{ type: "questOpened", workspace: "T1", member: alice, quest: firstThanks, at: openedAt }]);
  });

  test("opening a held reward's crate adds its XP and coins once, stores what it applied on the crate opening, and publishes xpRecorded, levelReached, then questOpened", async () => {
    const { t, alice } = await withFinishedFirstThanks("crate-rewards");
    await t.run((ctx) => recordReward(ctx, "T1", { member: alice, key: "weekly:2026-10-12:0", xp: 15, coins: 3, item: null, catalogueVersion: "1", at: finishedAt }));
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();
    vi.setSystemTime(openedAt);

    expect(await open(t, alice)).toBe("done");

    const after = await everyTable(t);
    expect(withoutCollectionExposure({ ...after, crateOpenings: [], memberProgress: [], wallets: [] })).toEqual({ ...before, memberProgress: [], wallets: [] });
    const from = { xp: 15, level: 1, coins: 3, skillPoints: 0 };
    const to = { xp: 25, level: 2, coins: 3, skillPoints: 0 };
    expect(after.crateOpenings).toEqual([expect.objectContaining({ member: alice, key: "journey:first-thanks", at: openedAt, applied: { xp: 10, coins: 0, from, to } })]);
    expect(after.memberProgress).toEqual([expect.objectContaining({ member: alice, xp: 25, pointsSpent: 0 })]);
    expect(after.wallets).toEqual(before.wallets);
    expect(published()).toEqual([
      { type: "xpRecorded", workspace: "T1", member: alice, at: openedAt },
      { type: "levelReached", workspace: "T1", member: alice, level: 2, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 75, at: openedAt },
      { type: "questOpened", workspace: "T1", member: alice, quest: firstThanks, at: openedAt },
    ]);
  });

  test("with collection on, a held crate's first open also drops one hoggie after its own writes and before questOpened, and nothing else changes", async () => {
    const { t, alice } = await withFinishedFirstThanks("crate-rewards", "collection");
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();
    vi.setSystemTime(openedAt);

    expect(await open(t, alice)).toBe("done");

    const after = await everyTable(t);
    expect(withoutCollectionExposure({ ...after, crateOpenings: [], memberProgress: [], drops: [], hoggieTallies: [], dropTallies: [] })).toEqual({ ...before, memberProgress: [] });
    expect(after.drops).toEqual([expect.objectContaining({ member: alice, crate: "journey:first-thanks", n: 1, copy: 1, at: openedAt })]);
    expect(published().map(({ type }) => type)).toEqual(["xpRecorded", "hoggieDropped", "questOpened"]);

    vi.mocked(publish).mockClear();
    expect(await open(t, alice)).toBe("done");
    expect(await everyTable(t)).toEqual(after);
    expect(published()).toEqual([]);
  });

  test("a held weekly reward's open credits its coins through the wallet", async () => {
    const { t, alice } = await withFinishedFirstThanks("crate-rewards");
    const weekly = { kind: "weekly", week: "2026-10-12", slot: 0 } as const;
    await t.run((ctx) => recordReward(ctx, "T1", { member: alice, key: "weekly:2026-10-12:0", xp: 20, coins: 7, item: null, catalogueVersion: "1", at: finishedAt, held: true }));

    expect(await t.run((ctx) => openQuestCrate(ctx, alice, weekly))).toBe("done");

    expect(await t.run((ctx) => balanceOf(ctx, alice))).toBe(7);
    expect((await t.run((ctx) => crateOpeningOf(ctx, alice, "weekly:2026-10-12:0")))?.applied).toEqual({
      xp: 20,
      coins: 7,
      from: { xp: 0, level: 1, coins: 0, skillPoints: 0 },
      to: { xp: 20, level: 2, coins: 7, skillPoints: 0 },
    });
  });

  test.each([
    ["counted at its finish", []],
    ["held", ["crate-rewards"]],
  ])("a second open of a crate whose reward %s, a week later, writes nothing and publishes nothing, and the crate keeps its first opening", async (_, flags) => {
    const { t, alice } = await withFinishedFirstThanks(...flags);
    vi.setSystemTime(openedAt);
    await open(t, alice);
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();
    vi.setSystemTime(openedAt + weekMs);

    await open(t, alice);

    expect(await everyTable(t)).toEqual(before);
    expect(published()).toEqual([]);
    expect(await journeyOf(t, alice)).toEqual([expect.objectContaining({ step: "first-thanks", finishedAt, openedAt })]);
  });
});

describe("P85: only a finished crate of the member's own opens", () => {
  test("a member whose step isn't finished opens nothing, though another member finished theirs", async () => {
    const { t, bob } = await withFinishedFirstThanks();
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    expect(await open(t, bob)).toBe("refused");

    expect(await everyTable(t)).toEqual(before);
    expect(published()).toEqual([]);
  });

  test("while quests is off, a finished crate opens nothing, and opens once quests is on again", async () => {
    const { t, alice } = await withFinishedFirstThanks();
    await questsTurned(t, "xp-levels", "unlocks");
    const before = await everyTable(t);

    expect(await open(t, alice)).toBe("refused");
    expect(await everyTable(t)).toEqual(before);

    await questsTurned(t, "xp-levels", "unlocks", "quests");
    expect(await open(t, alice)).toBe("done");
  });
});

async function withFinishedFirstThanks(...flags: string[]) {
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests", ...flags);
  const t = await flagsLoaded(testBackend());
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  await unlocksShippedBeforeAnyoneJoined(t);
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { annotations: saysWhy }));
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
  return { t, alice: alice!, bob: bob! };
}

function questsTurned(t: Backend, ...on: string[]) {
  flagsOnForEveryone(new FakeSlack().fetch, ...on);
  return flagsLoaded(t);
}

function open(t: Backend, member: MemberId) {
  return t.run((ctx) => openQuestCrate(ctx, member, firstThanks));
}

async function journeyOf(t: Backend, member: MemberId) {
  return (await t.query(internal.quests.quests.questsOf, { member }))?.journey;
}

function published(): DomainEvent[] {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

async function everyTable(t: Backend) {
  return t.run(async (ctx) => {
    const tables: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) tables[table] = await ctx.db.query(table).collect();
    return tables as Record<keyof typeof schema.tables, Array<Record<string, unknown>>>;
  });
}
