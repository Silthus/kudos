import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { buttonInHome } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { allowanceDay } from "../engine/allowance";
import type { QuestId } from "../quests/pool";
import type { Quest } from "../quests/step";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const thisWeek = "2026-10-12";
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests"];
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const firstThanks: Quest = { kind: "journey", step: "first-thanks" };
const firstSlot: Quest = { kind: "weekly", week: thisWeek, slot: 0 };

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation">;

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

function flagsOn(backend: Backend, ...keys: string[]) {
  return switchWebsite(backend, postHog, true, ...keys);
}

async function questsApplyIn(backend: Backend = t) {
  await flagsOn(backend, ...questsFlags);
  await journeyShippedBeforeAnyoneJoined(backend);
}

async function aTeamIn(backend: Backend = t) {
  const member = await aMember(backend, juno.user);
  const teammate = await aMember(backend, rowan.user);
  const { asSignedIn, sessionId } = await aSignedInSession(backend, juno);
  return { backend, member, teammate, asSignedIn, sessionId };
}

async function thanks(backend: Backend, giver: MemberId, recipient: MemberId) {
  const at = Date.now();
  const event = await backend.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await backend.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function aFinishedJourneyStepIn(backend: Backend = t) {
  await questsApplyIn(backend);
  const team = await aTeamIn(backend);
  await thanks(backend, team.member, team.teammate);
  return team;
}

function drawnIn(backend: Backend, member: MemberId, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  return backend.run((ctx) => ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots }));
}

async function aFinishedWeeklyQuest() {
  await questsApplyIn();
  const team = await aTeamIn();
  await reachesLevel(t, team.member, 2);
  await opens(t, team.member, "quests");
  await drawnIn(t, team.member, ["say-why", "say-why-three-times"]);
  await thanks(t, team.member, team.teammate);
  return team;
}

function openQuestCrate(caller: Caller, quest: Quest = firstThanks) {
  return caller.mutation(api.website.commands.openQuestCrate, { quest });
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

function crateOpeningsOf(member: MemberId) {
  return t.run((ctx) =>
    ctx.db
      .query("crateOpenings")
      .withIndex("by_member_key", (q) => q.eq("member", member))
      .collect(),
  );
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

describe("website commands pass one guard", () => {
  describe("WS61: a quest crate's denial answers as a read does and writes nothing at all", () => {
    test("with the website flag off, a finished step's open answers closed", async () => {
      const { asSignedIn } = await aFinishedJourneyStepIn();
      await switchWebsite(t, postHog, false, ...questsFlags);
      const before = await everythingWritten();

      expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a flags key but no workspace key yet, the open answers closed and makes no key", async () => {
      postHog.withFlags({ key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      const before = await everythingWritten();

      expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
      expect(before.tables.workspaceKeys).toEqual([]);
    });

    test("without a session, the open answers signed-out", async () => {
      await aFinishedJourneyStepIn();
      const before = await everythingWritten();

      expect(await openQuestCrate(t)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a signed-out session, a finished step's open answers signed-out", async () => {
      const { asSignedIn, sessionId } = await aFinishedJourneyStepIn();
      await t.run((ctx) => ctx.db.delete(sessionId));
      const before = await everythingWritten();

      expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a member who left the workspace with a finished step answers not-a-member", async () => {
      const { asSignedIn } = await aFinishedJourneyStepIn();
      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
      const before = await everythingWritten();

      expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "not-a-member" });
      expect(await everythingWritten()).toEqual(before);
    });
  });

  test("WS61: the quest is the only argument, so no call names a member", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn();
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: firstThanks, member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS74 P77: with every flag on and no unlocks launch, a quest crate's open answers refused and launches nothing", async () => {
    await flagsOn(t, ...questsFlags);
    const { asSignedIn } = await aTeamIn();
    const before = await everythingWritten();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS74 P91: with unlocks launched and no Journey launch, a quest crate's open answers refused and neither launches the Journey nor joins anyone", async () => {
    await flagsOn(t, ...questsFlags);
    await unlocksShippedBeforeAnyoneJoined(t);
    const { asSignedIn } = await aTeamIn();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
  test("WS74: with achievements on, the Journey launched and no Book launch, a finished step's open answers refused and doesn't launch the Book", async () => {
    const { asSignedIn } = await aFinishedJourneyStepIn();
    await flagsOn(t, ...questsFlags, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  test("WS74 P85: a finished Journey step's crate opens for good, and App Home's republish is scheduled", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn();
    const republishedBefore = await homeRepublishesFor(juno.user);
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened" });

    expect(await crateOpeningsOf(member)).toMatchObject([{ key: "journey:first-thanks", at: now.getTime() }]);
    expect(publishedEvents()).toEqual([{ type: "questOpened", workspace: "T1", member, quest: firstThanks, at: now.getTime() }]);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
  });

  test("WS74 P85: a finished weekly quest's crate opens for good", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuest();

    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened" });

    expect(await crateOpeningsOf(member)).toContainEqual(expect.objectContaining({ key: `weekly:${thisWeek}:0` }));
    expect(publishedEvents()).toContainEqual({ type: "questOpened", workspace: "T1", member, quest: firstSlot, poolQuest: "say-why", at: now.getTime() });
  });

  test("WS74: App Home's republished view no longer offers the step's crate", async () => {
    const { asSignedIn } = await aFinishedJourneyStepIn();
    await settle(t);
    expect(buttonInHome(slack, juno.user, "Open")).toBeDefined();
    const publishedBefore = slack.callsTo("views.publish").length;

    await openQuestCrate(asSignedIn);
    await settle(t);

    expect(slack.callsTo("views.publish").length).toBeGreaterThan(publishedBefore);
    expect(() => buttonInHome(slack, juno.user, "Open")).toThrow(/no Open button/);
  });

  test("WS63 WS74: a doubled open opens once and answers opened again, keeping the first time", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn();
    await openQuestCrate(asSignedIn);
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened" });
    expect(await crateOpeningsOf(member)).toMatchObject([{ key: "journey:first-thanks", at: now.getTime() }]);
    expect(publishedEvents().filter(({ type }) => type === "questOpened")).toHaveLength(1);
  });

  type Refusal = { condition: string; arrange: () => Promise<{ asSignedIn: Caller }>; quest: Quest };

  const refusedByQuests: Refusal[] = [
    { condition: "a Journey step still active", quest: firstThanks, arrange: async () => (await questsApplyIn(), aTeamIn()) },
    { condition: "a weekly quest still in progress", quest: { kind: "weekly", week: thisWeek, slot: 1 }, arrange: aFinishedWeeklyQuest },
    { condition: "a weekly quest that was never drawn", quest: { kind: "weekly", week: "2020-01-06", slot: 0 }, arrange: aFinishedWeeklyQuest },
  ];

  test.each(refusedByQuests)("WS74: $condition answers refused and writes nothing at all", async ({ arrange, quest }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn, quest)).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test.each([
    { condition: "quests", stillOn: ["xp-levels", "unlocks"] },
    { condition: "unlocks", stillOn: ["xp-levels", "quests"] },
    { condition: "xp-levels", stillOn: ["unlocks", "quests"] },
  ])("WS74: a finished step with $condition switched off answers refused before any command and writes nothing at all", async ({ stillOn }) => {
    const { asSignedIn } = await aFinishedJourneyStepIn();
    await flagsOn(t, ...stillOn);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS64 WS74: opening on the website leaves the domain tables and events Slack's Open leaves, besides Slack's receipt", async () => {
    const slackSide = await aFinishedJourneyStepIn(testBackend());
    vi.mocked(publish).mockClear();
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "Ev_OPEN",
      user: juno.user,
      commands: [{ type: "openQuestCrate", quest: firstThanks }],
    });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };

    const websiteSide = await aFinishedJourneyStepIn(t);
    vi.mocked(publish).mockClear();
    expect(await openQuestCrate(websiteSide.asSignedIn)).toEqual({ kind: "opened" });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide)).toEqual(comparable(fromSlack, slackSide));
    expect(fromWebsite.events).toEqual([{ type: "questOpened", workspace: "T1", member: websiteSide.member, quest: firstThanks, at: now.getTime() }]);
  });
});

describe("opening on the website grants nothing", () => {
  test("P92: opening a finished step's crate writes only one crate opening, with the XP and every other record as they were", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn();
    const before = await everyTable();
    vi.mocked(publish).mockClear();

    await openQuestCrate(asSignedIn);

    const after = await everyTable();
    expect({ ...after, crateOpenings: [] }).toEqual({ ...before, crateOpenings: [] });
    expect(after.crateOpenings).toMatchObject([{ member, key: "journey:first-thanks", at: now.getTime() }]);
    expect(before.crateOpenings).toEqual([]);
    expect(publishedEvents()).toEqual([{ type: "questOpened", workspace: "T1", member, quest: firstThanks, at: now.getTime() }]);
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
