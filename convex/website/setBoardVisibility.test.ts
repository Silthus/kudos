import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { isOnTheBoards } from "../leaderboard/visibility";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const unlocksFlags = ["everyone-board", "xp-levels", "unlocks"];

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;

type Caller = Pick<Backend, "mutation">;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
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

async function signedIn(backend: Backend = t) {
  const member = await aMember(backend, juno.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  return { backend, member, asSignedIn };
}

async function aBoardWithoutUnlocks(backend: Backend = t) {
  await switchWebsite(backend, postHog, true, "everyone-board");
  return signedIn(backend);
}

async function anOpenBoardIn(backend: Backend = t, ...alsoOn: string[]) {
  await switchWebsite(backend, postHog, true, ...unlocksFlags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  const team = await signedIn(backend);
  await reachesLevel(backend, team.member, 3);
  await opens(backend, team.member, "leaderboard");
  await switchWebsite(backend, postHog, true, ...unlocksFlags, ...alsoOn);
  return team;
}

async function aBoardAtLevel(level: number) {
  await switchWebsite(t, postHog, true, ...unlocksFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
  const team = await signedIn();
  await reachesLevel(t, team.member, level);
  return team;
}

function setBoardVisibility(caller: Caller, visible: boolean) {
  return caller.mutation(api.website.commands.setBoardVisibility, { visible });
}

async function everyTable(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const tables = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}

async function everythingWritten(backend: Backend = t) {
  return { tables: await everyTable(backend), scheduled: await scheduledFunctions(backend) };
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

function scheduledFunctions(backend: Backend = t) {
  return backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

async function visibilityChangesRecorded() {
  return (await scheduledFunctions()).filter(({ name }) => name === "analytics/isolatedUsage:recordLeaderboardVisibilityChanged");
}

function onTheBoards(member: MemberId, backend: Backend = t) {
  return backend.run((ctx) => isOnTheBoards(ctx, member));
}

describe("website commands pass one guard", () => {
  describe("WS61: a denial answers as a read does and writes nothing at all", () => {
    test("with the website flag off, the switch answers closed", async () => {
      const { asSignedIn } = await aBoardWithoutUnlocks();
      await switchWebsite(t, postHog, false, "everyone-board");
      const before = await everythingWritten();

      expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("without a session, the switch answers signed-out", async () => {
      await aBoardWithoutUnlocks();
      const before = await everythingWritten();

      expect(await setBoardVisibility(t, false)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a member who left the workspace answers not-a-member", async () => {
      const { asSignedIn } = await aBoardWithoutUnlocks();
      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
      const before = await everythingWritten();

      expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "not-a-member" });
      expect(await everythingWritten()).toEqual(before);
    });
  });

  test("WS61: the setting is the only argument, so no call names a member", async () => {
    const { member, asSignedIn } = await aBoardWithoutUnlocks();
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.setBoardVisibility, { visible: false, member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS321 WS335 P77: with the boards, xp-levels and unlocks on and no unlocks launch, the switch answers refused and launches nothing", async () => {
    await switchWebsite(t, postHog, true, ...unlocksFlags);
    const { asSignedIn } = await signedIn();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(before.tables.leaderboardSettings).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS321 WS335 P91: with quests on and no Journey launch, an open board's switch answers refused and neither launches the Journey nor joins anyone", async () => {
    const { asSignedIn } = await anOpenBoardIn(t, "quests");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS321 WS335: with achievements on and no Book launch, an open board's switch answers refused and doesn't launch the Book", async () => {
    const { asSignedIn } = await anOpenBoardIn(t, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  type Refusal = { condition: string; arrange: () => Promise<{ asSignedIn: Caller }> };

  const refusedByTheBoard: Refusal[] = [
    { condition: "a Leaderboard still locked at level 1", arrange: () => aBoardAtLevel(1) },
    { condition: "a ready Leaderboard", arrange: () => aBoardAtLevel(3) },
    { condition: "the boards switched off while unlocks don't apply", arrange: async () => (await switchWebsite(t, postHog, true), signedIn()) },
  ];

  test.each(refusedByTheBoard)("WS321: $condition answers refused before D17 and writes nothing at all", async ({ arrange }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS321: an open Leaderboard on the unlock path switches, with the Journey and the Book launched", async () => {
    const { member, asSignedIn } = await anOpenBoardIn(t, "quests", "achievements");
    await journeyShippedBeforeAnyoneJoined(t);
    await bookShippedBeforeAnyoneJoined(t);

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "set", visible: false });
    expect(await onTheBoards(member)).toBe(false);
  });

  test("WS321: with the board open while unlocks don't apply, a member switches themselves off and on, answering the stored setting", async () => {
    const { member, asSignedIn } = await aBoardWithoutUnlocks();

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "set", visible: false });
    expect(await onTheBoards(member)).toBe(false);

    expect(await setBoardVisibility(asSignedIn, true)).toEqual({ kind: "set", visible: true });
    expect(await onTheBoards(member)).toBe(true);
  });

  test("WS321: App Home's republish is scheduled after a change, and a second identical call changes nothing and republishes nothing", async () => {
    const { member, asSignedIn } = await aBoardWithoutUnlocks();
    const republishedBefore = await homeRepublishesFor(juno.user);

    await setBoardVisibility(asSignedIn, false);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);

    expect(await setBoardVisibility(asSignedIn, false)).toEqual({ kind: "set", visible: false });
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
    expect(await t.run((ctx) => ctx.db.query("leaderboardSettings").collect())).toMatchObject([{ member, visible: false }]);
    expect(await visibilityChangesRecorded()).toHaveLength(1);
  });

  test("WS321: switching on a member who was never off changes nothing and republishes nothing", async () => {
    const { asSignedIn } = await aBoardWithoutUnlocks();
    const republishedBefore = await homeRepublishesFor(juno.user);

    expect(await setBoardVisibility(asSignedIn, true)).toEqual({ kind: "set", visible: true });
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length);
  });

  test("WS64 WS335: switching off on the website leaves the domain tables and events Slack's Settings switch leaves, besides Slack's receipt", async () => {
    const slackSide = await anOpenBoardIn(testBackend());
    vi.mocked(publish).mockClear();
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "Ev_SETTINGS",
      user: juno.user,
      commands: [{ type: "setLeaderboardVisibility", visible: false }],
    });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };

    const websiteSide = await anOpenBoardIn(t);
    vi.mocked(publish).mockClear();
    expect(await setBoardVisibility(websiteSide.asSignedIn, false)).toEqual({ kind: "set", visible: false });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide.member)).toEqual(comparable(fromSlack, slackSide.member));
    expect(fromWebsite.tables.leaderboardSettings).toMatchObject([{ member: websiteSide.member, visible: false }]);
  });
});

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, member: MemberId) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [] };
  return normalised({ domain, events }, member);
}

const generatedKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalised(value: unknown, member: MemberId): unknown {
  if (value === member) return "<member>";
  if (typeof value === "string" && generatedKey.test(value)) return "<generated key>";
  if (Array.isArray(value)) return value.map((item) => normalised(item, member));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_id" && key !== "_creationTime")
      .map(([key, field]) => [key, normalised(field, member)]),
  );
}
