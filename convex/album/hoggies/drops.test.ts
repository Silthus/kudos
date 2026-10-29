import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../../testing/flags";
import { settleInTimeOrder, testBackend, type Backend } from "../../../testing/slackBackend";
import { opens, reachesLevel } from "../../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api, internal } from "../../_generated/api";
import { publish } from "../../bus/publish";
import { allowanceDay } from "../../engine/allowance";
import { fromTheNewestDecided } from "../../engine/awards";
import type { Quest } from "../../quests/step";
import type { Feature } from "../../unlocks/feature";
import schema from "../../schema";
import type { MemberId } from "../../workspace/directory";
import { catalogue, hoggieNamed } from "./catalogue";
import { drawOf } from "./draw";
import { dropsByDecision } from "./drops";

vi.mock("../../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../bus/publish")>();
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

function flagsOn(backend: Backend, ...keys: string[]) {
  return switchWebsite(backend, postHog, true, ...keys);
}

async function aTeamIn(backend: Backend) {
  const member = await aMember(backend, juno.user);
  const teammate = await aMember(backend, rowan.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  return { backend, member, teammate, asSignedIn };
}

async function thanks(backend: Backend, giver: MemberId, recipient: MemberId) {
  const at = Date.now();
  const event = await backend.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await backend.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function aFinishedJourneyStepIn(backend: Backend = t, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await thanks(backend, team.member, team.teammate);
  return team;
}

async function aFinishedWeeklyQuestIn(backend: Backend = t, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  await opens(backend, team.member, "quests");
  const slots = (["say-why", "say-why-three-times"] as const).map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  await backend.run((ctx) => ctx.db.insert("questDraws", { member: team.member, week: thisWeek, drawnAt: Date.now(), slots }));
  await thanks(backend, team.member, team.teammate);
  return team;
}

async function aReadyFeatureIn(backend: Backend = t, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await journeyShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  return team;
}

function openQuestCrate(caller: Caller, quest: Quest = firstThanks) {
  return caller.mutation(api.website.commands.openQuestCrate, { quest });
}

function openFeature(caller: Caller, feature: Feature = "quests") {
  return caller.mutation(api.website.commands.openFeature, { feature });
}

function openFromAppHome(backend: Backend, command: { type: "openQuestCrate"; quest: Quest } | { type: "openUnlock"; feature: Feature }, eventId = "Ev_OPEN") {
  return backend.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId, user: juno.user, commands: [command] });
}

async function everythingWritten(backend: Backend = t) {
  const tables = await backend.run(async (ctx) => {
    const rows = {} as Record<TableName, unknown[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

async function dropDrawnFor(member: MemberId, crate: string, copy = 1) {
  const { hoggie, rarity } = await drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version });
  return { hoggie, name: hoggieNamed(hoggie)!.name, rarity, art: { kind: "hoggie", slug: hoggie }, copy, isNew: copy === 1 };
}

function dropsOf(member: MemberId, backend: Backend = t) {
  return backend.run(async (ctx) => {
    const drops = [];
    for await (const drop of dropsByDecision(ctx, member, fromTheNewestDecided, { crests: false })) drops.push(drop);
    return drops;
  });
}

async function aSecretDrawingTheSameHoggieFor(member: MemberId, crates: string[]) {
  for (let attempt = 0; ; attempt++) {
    const secret = `secret-${attempt}`;
    const drawn = await Promise.all(crates.map((crate) => drawOf({ secret, member, crate, version: catalogue.version })));
    if (drawn.every(({ hoggie }) => hoggie === drawn[0]!.hoggie)) return secret;
  }
}

async function aSecretDrawingOtherThan(member: MemberId, crate: string, hoggie: string) {
  for (let attempt = 0; ; attempt++) {
    const secret = `secret-${attempt}`;
    if ((await drawOf({ secret, member, crate, version: catalogue.version })).hoggie !== hoggie) return secret;
  }
}

function collectionExposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === "collection");
  return [...new Map(sent.map((event) => [event.uuid, event])).values()].map(({ properties }) => properties.$feature_flag_response);
}

describe("CL20: a crate drops at most one hoggie", () => {
  test("CL6 CL14: opening a finished Journey step's crate on the website answers its one drop beside applied", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "collection");

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened", applied: null, drop: await dropDrawnFor(member, "journey:first-thanks") });
  });

  test("CL6 CL14: opening a finished weekly quest's crate on the website answers its one drop", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t, "collection");

    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened", applied: null, drop: await dropDrawnFor(member, `weekly:${thisWeek}:0`) });
  });

  test("CL6 CL14: opening a ready feature on the website answers its one drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:quests") });
  });

  test("CL7: a second website open answers the same drop and writes nothing", async () => {
    const { asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    const first = await openQuestCrate(asSignedIn);
    const before = await everythingWritten();
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await openQuestCrate(asSignedIn)).toEqual(first);
    expect((await everythingWritten()).tables).toEqual(before.tables);
  });

  test("CL7: a website open after App Home's Open answers the drop App Home's Open made and draws nothing", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toMatchObject({ drop: await dropDrawnFor(member, "journey:first-thanks") });
    expect(await dropsOf(member)).toHaveLength(1);
    expect(publishedEvents()).toEqual([]);
  });

  test("CL6 CL7: a feature opened from App Home drops once, and the website's open answers that drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");
    await openFromAppHome(t, { type: "openUnlock", feature: "quests" });

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:quests") });
    expect(await dropsOf(member)).toHaveLength(1);
  });

  test("CL7: a replayed App Home Open writes nothing", async () => {
    await aFinishedJourneyStepIn(t, "collection");
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    const before = await everythingWritten();

    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });

    expect(await everythingWritten()).toEqual(before);
  });

  test("CL7: a second App Home Open of the same crate, under a new event, writes no drop", async () => {
    const { member } = await aFinishedJourneyStepIn(t, "collection");
    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks });
    vi.mocked(publish).mockClear();

    await openFromAppHome(t, { type: "openQuestCrate", quest: firstThanks }, "Ev_OPEN_AGAIN");

    expect(await dropsOf(member)).toHaveLength(1);
    expect(publishedEvents()).toEqual([]);
  });

  test("CL8: the same member, crate and catalogue version draw the same hoggie in two fresh backends", async () => {
    const elsewhere = await aFinishedJourneyStepIn(testBackend(), "collection");
    const here = await aFinishedJourneyStepIn(t, "collection");
    expect(here.member).toBe(elsewhere.member);

    expect(await openQuestCrate(here.asSignedIn)).toEqual(await openQuestCrate(elsewhere.asSignedIn));
  });

  test("CL6: a feature opened by the unlocks launch drops nothing, and its website open answers no drop", async () => {
    await flagsOn(t, ...questsFlags, "collection");
    const { member, asSignedIn } = await aTeamIn(t);
    await unlocksShippedBeforeAnyoneJoined(t);
    await journeyShippedBeforeAnyoneJoined(t);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: null });
    expect(await dropsOf(member)).toEqual([]);
  });

  test("CL7: a refused open drops nothing", async () => {
    await flagsOn(t, ...questsFlags, "collection");
    await journeyShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await aTeamIn(t);

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "refused" });
    expect(await openFeature(asSignedIn)).toEqual({ kind: "refused" });
    expect(await dropsOf(member)).toEqual([]);
  });

  test("CL10: a second drop of one hoggie answers copy 2 and isNew false", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t, "collection");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingTheSameHoggieFor(member, ["journey:first-thanks", `weekly:${thisWeek}:0`]));
    const first = await openQuestCrate(asSignedIn);

    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened", applied: null, drop: await dropDrawnFor(member, `weekly:${thisWeek}:0`, 2) });
    expect(first).toMatchObject({ drop: { copy: 1, isNew: true } });
  });

  test("CL8: a different HOGGIE_DRAW_SECRET draws differently for the same crate", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    const drawnWithoutSecret = await dropDrawnFor(member, "journey:first-thanks");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingOtherThan(member, "journey:first-thanks", drawnWithoutSecret.hoggie));

    const answer = await openQuestCrate(asSignedIn);

    expect(answer).toEqual({ kind: "opened", applied: null, drop: await dropDrawnFor(member, "journey:first-thanks") });
    expect(answer).not.toMatchObject({ drop: { hoggie: drawnWithoutSecret.hoggie } });
  });

  test("CL9: drops in one millisecond get consecutive n, newest first", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t, "collection");
    await openQuestCrate(asSignedIn);
    await openQuestCrate(asSignedIn, firstSlot);

    expect((await dropsOf(member)).map(({ at, n, drop }) => ({ at, n, hoggie: drop.hoggie }))).toEqual([
      { at: now.getTime(), n: 3, hoggie: (await dropDrawnFor(member, `weekly:${thisWeek}:0`)).hoggie },
      { at: now.getTime(), n: 2, hoggie: (await dropDrawnFor(member, "journey:first-thanks")).hoggie },
      { at: now.getTime(), n: 1, hoggie: (await dropDrawnFor(member, "unlock:quests")).hoggie },
    ]);
  });

  test("CL11: a crate opened while collection was off has no drop after it turns on", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t);
    await openQuestCrate(asSignedIn);
    await flagsOn(t, ...questsFlags, "collection");

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened", applied: null, drop: null });
    expect(await dropsOf(member)).toEqual([]);
  });

  test("CL7 CL12: a held crate's open applies its reward as CR14 says and drops after it, before questOpened", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "crate-rewards", "collection");
    vi.mocked(publish).mockClear();
    const drop = await dropDrawnFor(member, "journey:first-thanks");

    expect(await openQuestCrate(asSignedIn)).toEqual({
      kind: "opened",
      applied: { xp: 10, coins: 0, from: { xp: 0, level: 1, coins: 0, skillPoints: 0 }, to: { xp: 10, level: 1, coins: 0, skillPoints: 0 } },
      drop,
    });
    expect(publishedEvents().map(({ type }) => type)).toEqual(["xpRecorded", "hoggieDropped", "questOpened"]);
    expect(publishedEvents()[1]).toEqual({ type: "hoggieDropped", workspace: "T1", member, crate: "journey:first-thanks", hoggie: drop.hoggie, rarity: drop.rarity, copy: 1, at: now.getTime(), surface: "website" });
  });
});

describe("CL20: a drop never changes", () => {
  test("CL2 CL11: after a later catalogue moves the dropped hoggie to another rarity, the repeated open answers the stored drop", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    const first = await openQuestCrate(asSignedIn);
    const dropped = catalogue.hoggies.find(({ hoggie }) => hoggie === (first as { drop: { hoggie: string } }).drop.hoggie)!;
    const storedRarity = dropped.rarity;
    dropped.rarity = storedRarity === "legendary" ? "common" : "legendary";
    try {
      expect(await openQuestCrate(asSignedIn)).toEqual(first);
      expect((await dropsOf(member))[0]?.drop.rarity).toBe(storedRarity);
    } finally {
      dropped.rarity = storedRarity;
    }
  });

  test("CL10: a later drop of the same hoggie leaves the first drop's copy as it was", async () => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t, "collection");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingTheSameHoggieFor(member, ["journey:first-thanks", `weekly:${thisWeek}:0`]));
    const first = await openQuestCrate(asSignedIn);
    await openQuestCrate(asSignedIn, firstSlot);

    expect(await openQuestCrate(asSignedIn)).toEqual(first);
    expect(first).toMatchObject({ drop: { copy: 1, isNew: true } });
  });

  test("CL11: collection going off and on again answers the same drop", async () => {
    const { asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    const first = await openQuestCrate(asSignedIn);
    await flagsOn(t, ...questsFlags);
    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened", applied: null });
    await flagsOn(t, ...questsFlags, "collection");

    expect(await openQuestCrate(asSignedIn)).toEqual(first);
  });
});

describe("CL14 CL18: with collection off or unset, nothing drops and the answers are main's", () => {
  test.each([
    { condition: "off", collection: [offForEveryone("collection")] },
    { condition: "unset", collection: [] },
  ])("with collection $condition, the opens answer no drop field and leave no drop", async ({ collection }) => {
    const { member, asSignedIn } = await aFinishedWeeklyQuestIn(t);
    await flagsFromPostHog(t, postHog, ...["website", ...questsFlags].map(onForEveryone), ...collection);
    vi.mocked(publish).mockClear();

    expect(await openQuestCrate(asSignedIn)).toEqual({ kind: "opened", applied: null });
    expect(await openQuestCrate(asSignedIn, firstSlot)).toEqual({ kind: "opened", applied: null });
    expect(publishedEvents().map(({ type }) => type)).toEqual(["questOpened", "questOpened"]);
    expect(await dropsOf(member)).toEqual([]);
    expect(await t.run((ctx) => Promise.all([ctx.db.query("drops").collect(), ctx.db.query("hoggieTallies").collect(), ctx.db.query("dropTallies").collect()]))).toEqual([[], [], []]);
  });

  test("with collection off, a feature's open answers main's opened", async () => {
    const { asSignedIn } = await aReadyFeatureIn(t);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
  });
});

describe("CL7 CL18: collection's exposure", () => {
  test("goes once per member and value, only on a successful open", async () => {
    const { member, asSignedIn } = await aFinishedJourneyStepIn(t, "collection");
    await openQuestCrate(asSignedIn, firstSlot);
    await openFeature(asSignedIn);
    await settleInTimeOrder(t);
    expect(collectionExposures()).toEqual([]);

    await openQuestCrate(asSignedIn);
    await openQuestCrate(asSignedIn);
    await reachesLevel(t, member, 3);
    await openFeature(asSignedIn);
    await settleInTimeOrder(t);

    expect(collectionExposures()).toEqual([true]);
    expect(await dropsOf(member)).toHaveLength(2);
  });
});

describe("CL17: hoggie dropped", () => {
  test("projects the drop with its rarity, whether it's new and the crate's kind, never the hoggie's name", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");
    await openFeature(asSignedIn);
    await settleInTimeOrder(t);

    const dropped = postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
    expect(dropped.map(({ properties: { rarity, is_new, crate_kind } }) => ({ rarity, is_new, crate_kind }))).toEqual([{ rarity: (await dropDrawnFor(member, "unlock:quests")).rarity, is_new: true, crate_kind: "unlock" }]);
    expect(Object.keys(dropped[0]!.properties)).not.toContain("hoggie");
    expect(Object.keys(dropped[0]!.properties)).not.toContain("name");
  });
});
