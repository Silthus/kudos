import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import { openQuestCrate } from "./crates";
import { advanceJourney, journey } from "./journey";

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

describe("P92: opening a crate grants nothing", () => {
  test("opening a finished step's crate writes only one crate opening beside its reward record, and publishes only questOpened", async () => {
    const { t, alice } = await withFinishedFirstThanks();
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();
    vi.setSystemTime(openedAt);

    expect(await open(t, alice)).toBe("done");

    const after = await everyTable(t);
    expect({ ...after, crateOpenings: [] }).toEqual(before);
    expect(after.crateOpenings).toEqual([expect.objectContaining({ member: alice, key: "journey:first-thanks", at: openedAt })]);
    expect(published()).toEqual([{ type: "questOpened", workspace: "T1", member: alice, quest: firstThanks, at: openedAt }]);
  });

  test("a second open, a week later, writes nothing and publishes nothing, and the crate keeps its first opening", async () => {
    const { t, alice } = await withFinishedFirstThanks();
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

async function withFinishedFirstThanks() {
  const t = await flagsLoaded(testBackend());
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  await unlocksShippedBeforeAnyoneJoined(t);
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice!, bob!, { annotations: saysWhy }));
  await t.run((ctx) => advanceJourney(ctx, event, journey));
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
