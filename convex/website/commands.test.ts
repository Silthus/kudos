import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import schema from "../schema";
import type { Feature } from "../unlocks/feature";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const allFlags = ["everyone-board", "xp-levels", "unlocks"];

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys);
}

async function launchedThen(...keys: string[]) {
  await flagsOn(...allFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
  await flagsOn(...keys);
}

async function signedInMember() {
  const member = await aMember(t, juno.user);
  const { asSignedIn, sessionId } = await aSession(t, juno);
  return { member, asSignedIn, sessionId };
}

async function aReadyMember() {
  const signedIn = await signedInMember();
  await reachesLevel(t, signedIn.member, 3, Date.parse("2026-10-14T09:00:00Z"));
  return signedIn;
}

function openFeature(caller: Pick<Backend, "mutation">, feature: Feature = "leaderboard") {
  return caller.mutation(api.website.commands.openFeature, { feature });
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

function unlockRowsOf(member: Id<"members">) {
  return t.run((ctx) =>
    ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member))
      .collect(),
  );
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

describe("website commands pass one guard", () => {
  describe("WS61: a denial answers as a read does and writes nothing at all", () => {
    test("with the website flag off, a member's open answers closed", async () => {
      await launchedThen();
      await switchWebsite(t, postHog, false, ...allFlags);
      const { asSignedIn } = await aReadyMember();
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a flags key but no workspace key yet, the open answers closed and makes no key", async () => {
      postHog.withFlags({ key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});
      const { asSignedIn } = await signedInMember();
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
      expect(before.tables.workspaceKeys).toEqual([]);
    });

    test("without a session, the open answers signed-out", async () => {
      await launchedThen(...allFlags);
      const before = await everythingWritten();

      expect(await openFeature(t)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a signed-out session, a ready member's open answers signed-out", async () => {
      await launchedThen(...allFlags);
      const { asSignedIn, sessionId } = await aReadyMember();
      await t.run((ctx) => ctx.db.delete(sessionId));
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a person the directory is still verifying answers verifying", async () => {
      await launchedThen(...allFlags);
      const { asSignedIn } = await aSession(t, juno);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: juno.user, attempts: 1, state: "pending" }));
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "verifying" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a person whose verification failed answers unverified", async () => {
      await launchedThen(...allFlags);
      const { asSignedIn } = await aSession(t, juno);
      await t.run((ctx) => ctx.db.insert("memberVerifications", { workspace: "T1", user: juno.user, attempts: 3, state: "failed" }));
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "unverified" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a ready member who left the workspace answers not-a-member", async () => {
      await launchedThen(...allFlags);
      const { asSignedIn } = await aReadyMember();
      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
      const before = await everythingWritten();

      expect(await openFeature(asSignedIn)).toEqual({ kind: "not-a-member" });
      expect(await everythingWritten()).toEqual(before);
    });
  });

  test("WS61: the feature is the only argument, so no call names a member", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await aReadyMember();

    await expect(asSignedIn.mutation(api.website.commands.openFeature, { feature: "leaderboard", member } as never)).rejects.toThrow(/member/);
    expect((await unlockRowsOf(member)).map(({ openedAt }) => openedAt)).toEqual([undefined]);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 P77: with xp-levels and unlocks on and no launch recorded, the open answers refused and launches nothing", async () => {
    await flagsOn(...allFlags);
    const { asSignedIn } = await signedInMember();
    const before = await everythingWritten();

    expect(await openFeature(asSignedIn)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(before.tables.unlocks).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  test("WS62: a ready Leaderboard opens for good, and App Home's republish is scheduled", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await aReadyMember();
    const republishedBefore = await homeRepublishesFor(juno.user);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });

    expect(await unlockRowsOf(member)).toMatchObject([{ feature: "leaderboard", readyAt: Date.parse("2026-10-14T09:00:00Z"), openedAt: now.getTime() }]);
    expect(publishedEvents()).toContainEqual({ type: "unlockOpened", workspace: "T1", member, feature: "leaderboard", at: now.getTime() });
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
  });

  test("WS62: App Home's republished view no longer offers the Leaderboard's crate", async () => {
    await launchedThen(...allFlags);
    const { asSignedIn } = await aReadyMember();

    await openFeature(asSignedIn);
    await settle(t);

    expect(publishedHome(slack, juno.user).join("\n")).not.toMatch(/Open/);
  });

  test("WS63: a doubled open opens once and answers opened again, keeping the first time", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await aReadyMember();
    await openFeature(asSignedIn);
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
    expect(await unlockRowsOf(member)).toMatchObject([{ feature: "leaderboard", openedAt: now.getTime() }]);
    expect(publishedEvents().filter(({ type }) => type === "unlockOpened")).toHaveLength(1);
  });

  type Refusal = { condition: string; arrange: () => Promise<{ asSignedIn: Pick<Backend, "mutation"> }>; feature?: Feature };

  const refusals: Refusal[] = [
    { condition: "a Leaderboard still locked at level 1", arrange: async () => (await launchedThen(...allFlags), signedInMember()) },
    { condition: "a Skill tree that hasn't shipped, for a member past level 5", feature: "skillTree", arrange: async () => (await launchedThen(...allFlags), withLevel(5)) },
    { condition: "a ready Leaderboard with unlocks switched off after the launch", arrange: async () => (await launchedThen("everyone-board", "xp-levels"), withLevel(3)) },
    { condition: "a ready Leaderboard with xp-levels switched off after the launch", arrange: async () => (await launchedThen("everyone-board", "unlocks"), withLevel(3)) },
    { condition: "an open Leaderboard with unlocks switched off after the launch", arrange: () => openedThen("everyone-board", "xp-levels") },
    { condition: "an open Leaderboard with xp-levels switched off after the launch", arrange: () => openedThen("everyone-board", "unlocks") },
  ];

  test.each(refusals)("WS62: $condition answers refused and changes no domain table", async ({ arrange, feature }) => {
    const { asSignedIn } = await arrange();
    const before = await everyTable();
    vi.mocked(publish).mockClear();

    expect(await openFeature(asSignedIn, feature)).toEqual({ kind: "refused" });
    expect(withoutExposures(await everyTable())).toEqual(withoutExposures(before));
    expect(publishedEvents().filter(({ type }) => type === "unlockOpened")).toEqual([]);
  });

  test("WS62 WS63: an already open Leaderboard answers opened and changes no domain table", async () => {
    await launchedThen(...allFlags);
    const { asSignedIn } = await withOpened();
    const before = await everyTable();

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
    expect(withoutExposures(await everyTable())).toEqual(withoutExposures(before));
  });

  test("WS64: opening on the website leaves the domain tables and events Slack's Open leaves, besides Slack's receipt", async () => {
    const slackSide = await aReadyLeaderboardIn(testBackend());
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "Ev_OPEN",
      user: juno.user,
      commands: [{ type: "openUnlock", feature: "leaderboard" }],
    });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };
    vi.mocked(publish).mockClear();

    const websiteSide = await aReadyLeaderboardIn(t);
    expect(await openFeature(websiteSide.asSignedIn)).toEqual({ kind: "opened" });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide.member)).toEqual(comparable(fromSlack, slackSide.member));
    expect(fromWebsite.events.filter(({ type }) => type === "unlockOpened")).toHaveLength(1);
  });
});

describe("opening on the website grants nothing", () => {
  test("P92: opening a ready Leaderboard writes only its openedAt, with the XP and every other record as they were", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await aReadyMember();
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 320, pointsSpent: 0 }));
    const before = await everyTable();

    await openFeature(asSignedIn);

    const after = await everyTable();
    expect(withoutExposures({ ...after, unlocks: [] })).toEqual(withoutExposures({ ...before, unlocks: [] }));
    expect(after.unlocks).toEqual(before.unlocks.map((row) => ({ ...row, openedAt: now.getTime() })));
    expect(publishedEvents().filter(({ type }) => type !== "unlockReady")).toEqual([{ type: "unlockOpened", workspace: "T1", member, feature: "leaderboard", at: now.getTime() }]);
  });
});

async function withLevel(level: number) {
  const signedIn = await signedInMember();
  await reachesLevel(t, signedIn.member, level);
  return signedIn;
}

async function withOpened() {
  const signedIn = await withLevel(3);
  await opens(t, signedIn.member, "leaderboard");
  return signedIn;
}

async function openedThen(...keys: string[]) {
  await launchedThen(...allFlags);
  const signedIn = await withOpened();
  await flagsOn(...keys);
  return signedIn;
}

async function aReadyLeaderboardIn(backend: Backend) {
  await switchWebsite(backend, postHog, true, ...allFlags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  const member = await aMember(backend, juno.user);
  const { asSignedIn } = await aSession(backend, juno);
  await reachesLevel(backend, member, 3, Date.parse("2026-10-14T09:00:00Z"));
  return { backend, member, asSignedIn };
}

const exposureTables = ["flagExposures", "analyticsIds", "analyticsOutbox", "analyticsDrain"] as const;

function withoutExposures(tables: Record<TableName, Row[]>) {
  return { ...tables, ...Object.fromEntries(exposureTables.map((table) => [table, []])) };
}

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, member: Id<"members">) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [] };
  return normalised({ domain, events }, member);
}

const generatedKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalised(value: unknown, member: Id<"members">): unknown {
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
