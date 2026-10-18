import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { runCommand } from "../commands/commands";
import type { QuestId } from "../quests/pool";
import type { WeeklyQuest } from "../quests/step";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

vi.mock("../commands/commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../commands/commands")>();
  return { ...actual, runCommand: vi.fn(actual.runCommand) };
});

const now = new Date("2026-10-14T10:00:00Z");
const thisWeek = "2026-10-12";
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests"];
const sayingWhyThreeWays: QuestId[] = ["say-why", "say-why-twice", "say-why-three-times"];
const secondSlot: WeeklyQuest = { kind: "weekly", week: thisWeek, slot: 1 };
const thirdSlot: WeeklyQuest = { kind: "weekly", week: thisWeek, slot: 2 };

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation">;
type Team = { backend: Backend; member: MemberId; teammate: MemberId; asSignedIn: Caller };

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.mocked(runCommand).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(backend: Backend, ...keys: string[]) {
  return switchWebsite(backend, postHog, true, ...keys);
}

async function aTeamIn(backend: Backend): Promise<Team> {
  const member = await aMember(backend, juno.user);
  const teammate = await aMember(backend, rowan.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  return { backend, member, teammate, asSignedIn };
}

async function questsLaunchedWithATeamIn(backend: Backend = t) {
  await flagsOn(backend, ...questsFlags);
  await journeyShippedBeforeAnyoneJoined(backend);
  return aTeamIn(backend);
}

async function aSwappableWeekIn(backend: Backend = t) {
  const team = await questsLaunchedWithATeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  await opens(backend, team.member, "quests");
  await drawnIn(backend, team.member, sayingWhyThreeWays);
  return team;
}

async function aSwappableWeekWrittenDirectlyIn(team: Team) {
  await team.backend.run((ctx) => ctx.db.insert("unlocks", { member: team.member, feature: "quests", readyAt: Date.now(), openedAt: Date.now() }));
  await drawnIn(team.backend, team.member, sayingWhyThreeWays);
  return team;
}

function drawnIn(backend: Backend, member: MemberId, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  return backend.run((ctx) => ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots }));
}

function swapQuest(caller: Caller, quest: WeeklyQuest = secondSlot) {
  return caller.mutation(api.website.commands.swapQuest, { quest });
}

async function everyTable(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const tables = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}

function scheduledFunctions(backend: Backend = t) {
  return backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function everythingWritten(backend: Backend = t) {
  return { tables: await everyTable(backend), scheduled: await scheduledFunctions(backend) };
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

function d17Calls() {
  return vi.mocked(runCommand).mock.calls;
}

function weekOf(member: MemberId, backend: Backend = t) {
  return backend.query(internal.quests.quests.questsOf, { member }).then((facts) => facts!.week);
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, a swap answers closed and writes nothing at all", async () => {
    const { asSignedIn } = await aSwappableWeekIn();
    await switchWebsite(t, postHog, false, ...questsFlags);
    const before = await everythingWritten();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(before);
    expect(d17Calls()).toEqual([]);
  });

  test("WS61: without a session, a swap answers signed-out and writes nothing at all", async () => {
    await aSwappableWeekIn();
    const before = await everythingWritten();

    expect(await swapQuest(t)).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: the swap's quest is the only argument, so no call names a member", async () => {
    const { member, asSignedIn } = await aSwappableWeekIn();

    await expect(asSignedIn.mutation(api.website.commands.swapQuest, { quest: secondSlot, member } as never)).rejects.toThrow(/member/);
  });
});

describe("a website command never launches unlocks", () => {
  type Gate = { condition: string; arrange: () => Promise<Team> };

  const closedGates: Gate[] = [
    {
      condition: "Quests locked at level 1",
      arrange: async () => {
        const team = await questsLaunchedWithATeamIn();
        await drawnIn(t, team.member, sayingWhyThreeWays);
        return team;
      },
    },
    {
      condition: "Quests ready and not yet opened",
      arrange: async () => {
        const team = await questsLaunchedWithATeamIn();
        await reachesLevel(t, team.member, 3);
        await drawnIn(t, team.member, sayingWhyThreeWays);
        return team;
      },
    },
    {
      condition: "the quests flag off",
      arrange: async () => {
        const team = await aSwappableWeekIn();
        await flagsOn(t, "xp-levels", "unlocks");
        return team;
      },
    },
  ];

  test.each(closedGates)("WS318: a swap with $condition answers refused without reaching D17 and writes nothing at all", async ({ arrange }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "refused" });

    expect(d17Calls()).toEqual([]);
    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335 P77: with every flag on and no unlocks launch, a member whose Quests is open with a drawn week gets refused and nothing launches", async () => {
    await flagsOn(t, ...questsFlags);
    const { asSignedIn } = await aSwappableWeekWrittenDirectlyIn(await aTeamIn(t));
    const before = await everythingWritten();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "refused" });

    expect(d17Calls()).toEqual([]);
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335 P91: with unlocks launched and no Journey launch, a swap of an open, drawn week answers refused and neither launches the Journey nor joins anyone", async () => {
    await flagsOn(t, ...questsFlags);
    await unlocksShippedBeforeAnyoneJoined(t);
    const { asSignedIn } = await aSwappableWeekWrittenDirectlyIn(await aTeamIn(t));
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "refused" });

    expect(d17Calls()).toEqual([]);
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335: with achievements on and no Book launch, a swappable quest answers refused and doesn't launch the Book", async () => {
    const { asSignedIn } = await aSwappableWeekIn();
    await flagsOn(t, ...questsFlags, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "refused" });

    expect(d17Calls()).toEqual([]);
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  test("WS318: an open week's swap replaces exactly that slot, answers swapped, and schedules App Home's republish", async () => {
    const { member, asSignedIn } = await aSwappableWeekIn();
    const republishedBefore = await homeRepublishesFor(juno.user);
    vi.mocked(publish).mockClear();

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "swapped" });

    expect(d17Calls().map(([, , , command, origin]) => ({ command, origin }))).toEqual([{ command: { type: "rerollQuest", quest: secondSlot }, origin: { surface: "website", idempotencyKey: `website:swapQuest:${member}:${thisWeek}:1` } }]);
    const week = await weekOf(member);
    expect(week).toMatchObject({ swap: { slot: 1, replaced: "say-why-twice", swappedAt: now.getTime() }, swapAvailable: false });
    expect(publishedEvents()).toEqual([{ type: "questSwapped", workspace: "T1", member, week: thisWeek, replaced: "say-why-twice", swappedIn: week!.swap!.quest, at: now.getTime() }]);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
  });

  test("WS318: a repeated swap for the same slot answers swapped again and keeps the one swap", async () => {
    const { member, asSignedIn } = await aSwappableWeekIn();
    await swapQuest(asSignedIn);
    const swapped = await weekOf(member);
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await swapQuest(asSignedIn)).toEqual({ kind: "swapped" });

    expect(await weekOf(member)).toEqual(swapped);
    expect(publishedEvents().filter(({ type }) => type === "questSwapped")).toHaveLength(1);
  });

  test("WS318: after the week's swap, another slot answers refused and writes nothing at all", async () => {
    const { asSignedIn } = await aSwappableWeekIn();
    await swapQuest(asSignedIn);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await swapQuest(asSignedIn, thirdSlot)).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS318: a slot that was never drawn answers refused and writes nothing at all", async () => {
    const { asSignedIn } = await aSwappableWeekIn();
    const before = await everythingWritten();

    expect(await swapQuest(asSignedIn, { kind: "weekly", week: thisWeek, slot: 7 })).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
  });

  test("WS64: swapping on the website leaves the domain tables and events Slack's Swap leaves, besides Slack's receipt", async () => {
    const slackSide = await aSwappableWeekIn(testBackend());
    vi.mocked(publish).mockClear();
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "Ev_SWAP",
      user: juno.user,
      commands: [{ type: "rerollQuest", quest: secondSlot }],
    });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };

    const websiteSide = await aSwappableWeekIn(t);
    vi.mocked(publish).mockClear();
    expect(await swapQuest(websiteSide.asSignedIn)).toEqual({ kind: "swapped" });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide)).toEqual(comparable(fromSlack, slackSide));
    expect(fromWebsite.tables.questSwaps).toHaveLength(1);
    expect(fromWebsite.events).toEqual([expect.objectContaining({ type: "questSwapped", member: websiteSide.member, replaced: "say-why-twice" })]);
  });
});

type Side = { member: MemberId; teammate: MemberId };

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, side: Side) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [] };
  return normalised({ domain, events }, side);
}

const generatedKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalised(value: unknown, side: Side): unknown {
  if (value === side.member) return "<member>";
  if (value === side.teammate) return "<teammate>";
  if (typeof value === "string" && generatedKey.test(value)) return "<generated key>";
  if (Array.isArray(value)) return value.map((item) => normalised(item, side));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_id" && key !== "_creationTime")
      .map(([key, field]) => [key, normalised(field, side)]),
  );
}
