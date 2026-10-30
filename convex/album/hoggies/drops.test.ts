import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { flagsFromPostHog, unlocksShippedBeforeAnyoneJoined, offForEveryone, onForEveryone } from "../../../testing/flags";
import { settleInTimeOrder, testBackend, type Backend } from "../../../testing/slackBackend";
import { reachesLevel } from "../../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api, internal } from "../../_generated/api";
import { publish } from "../../bus/publish";
import { fromTheNewestDecided } from "../../engine/awards";
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
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests"];

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

async function aReadyFeatureIn(backend: Backend = t, ...alsoOn: string[]) {
  await flagsOn(backend, ...questsFlags, ...alsoOn);
  await unlocksShippedBeforeAnyoneJoined(backend);
  const team = await aTeamIn(backend);
  await reachesLevel(backend, team.member, 3);
  return team;
}

function openFeature(caller: Caller, feature: Feature = "quests") {
  return caller.mutation(api.website.commands.openFeature, { feature });
}

function openFromAppHome(backend: Backend, command: { type: "openUnlock"; feature: Feature }, eventId = "Ev_OPEN") {
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
  test("CL6 CL14: opening a ready feature on the website answers its one drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:quests") });
  });

  test("CL7: a second website open answers the same drop and writes nothing", async () => {
    const { asSignedIn } = await aReadyFeatureIn(t, "collection");
    const first = await openFeature(asSignedIn);
    const before = await everythingWritten();
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await openFeature(asSignedIn)).toEqual(first);
    expect((await everythingWritten()).tables).toEqual(before.tables);
  });

  test("CL6 CL7: a feature opened from App Home drops once, and the website's open answers that drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");
    await openFromAppHome(t, { type: "openUnlock", feature: "quests" });

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:quests") });
    expect(await dropsOf(member)).toHaveLength(1);
  });

  test("CL7: a replayed App Home Open writes nothing", async () => {
    await aReadyFeatureIn(t, "collection");
    await openFromAppHome(t, { type: "openUnlock", feature: "quests" });
    const before = await everythingWritten();

    await openFromAppHome(t, { type: "openUnlock", feature: "quests" });

    expect(await everythingWritten()).toEqual(before);
  });

  test("CL7: a second App Home Open of the same crate, under a new event, writes no drop", async () => {
    const { member } = await aReadyFeatureIn(t, "collection");
    await openFromAppHome(t, { type: "openUnlock", feature: "quests" });
    vi.mocked(publish).mockClear();

    await openFromAppHome(t, { type: "openUnlock", feature: "quests" }, "Ev_OPEN_AGAIN");

    expect(await dropsOf(member)).toHaveLength(1);
    expect(publishedEvents()).toEqual([]);
  });

  test("CL8: the same member, crate and catalogue version draw the same hoggie in two fresh backends", async () => {
    const elsewhere = await aReadyFeatureIn(testBackend(), "collection");
    const here = await aReadyFeatureIn(t, "collection");
    expect(here.member).toBe(elsewhere.member);

    expect(await openFeature(here.asSignedIn)).toEqual(await openFeature(elsewhere.asSignedIn));
  });

  test("CL6: a feature opened by the unlocks launch drops nothing, and its website open answers no drop", async () => {
    await flagsOn(t, ...questsFlags, "collection");
    const { member, asSignedIn } = await aTeamIn(t);
    await unlocksShippedBeforeAnyoneJoined(t);
    await unlocksShippedBeforeAnyoneJoined(t);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: null });
    expect(await dropsOf(member)).toEqual([]);
  });

  test("CL7: a refused open drops nothing", async () => {
    await flagsOn(t, ...questsFlags, "collection");
    await unlocksShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await aTeamIn(t);

    expect(await openFeature(asSignedIn)).toEqual({ kind: "refused" });
    expect(await dropsOf(member)).toEqual([]);
  });

  test("CL10: a second drop of one hoggie answers copy 2 and isNew false", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection", "everyone-board");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingTheSameHoggieFor(member, ["unlock:quests", "unlock:leaderboard"]));
    const first = await openFeature(asSignedIn);

    expect(await openFeature(asSignedIn, "leaderboard")).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:leaderboard", 2) });
    expect(first).toMatchObject({ drop: { copy: 1, isNew: true } });
  });

  test("CL8: a different HOGGIE_DRAW_SECRET draws differently for the same crate", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");
    const drawnWithoutSecret = await dropDrawnFor(member, "unlock:quests");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingOtherThan(member, "unlock:quests", drawnWithoutSecret.hoggie));

    const answer = await openFeature(asSignedIn);

    expect(answer).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "unlock:quests") });
    expect(answer).not.toMatchObject({ drop: { hoggie: drawnWithoutSecret.hoggie } });
  });

  test("CL9: drops in one millisecond get consecutive n, newest first", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection", "everyone-board");
    await openFeature(asSignedIn);
    await openFeature(asSignedIn, "leaderboard");

    expect((await dropsOf(member)).map(({ at, n, drop }) => ({ at, n, hoggie: drop.hoggie }))).toEqual([
      { at: now.getTime(), n: 2, hoggie: (await dropDrawnFor(member, "unlock:leaderboard")).hoggie },
      { at: now.getTime(), n: 1, hoggie: (await dropDrawnFor(member, "unlock:quests")).hoggie },
    ]);
  });

  test("CL11: a crate opened while collection was off has no drop after it turns on", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t);
    await openFeature(asSignedIn);
    await flagsOn(t, ...questsFlags, "collection");

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened", drop: null });
    expect(await dropsOf(member)).toEqual([]);
  });

});

describe("CL20: a drop never changes", () => {
  test("CL2 CL11: after a later catalogue moves the dropped hoggie to another rarity, the repeated open answers the stored drop", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection");
    const first = await openFeature(asSignedIn);
    const dropped = catalogue.hoggies.find(({ hoggie }) => hoggie === (first as { drop: { hoggie: string } }).drop.hoggie)!;
    const storedRarity = dropped.rarity;
    dropped.rarity = storedRarity === "legendary" ? "common" : "legendary";
    try {
      expect(await openFeature(asSignedIn)).toEqual(first);
      expect((await dropsOf(member))[0]?.drop.rarity).toBe(storedRarity);
    } finally {
      dropped.rarity = storedRarity;
    }
  });

  test("CL10: a later drop of the same hoggie leaves the first drop's copy as it was", async () => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "collection", "everyone-board");
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingTheSameHoggieFor(member, ["unlock:quests", "unlock:leaderboard"]));
    const first = await openFeature(asSignedIn);
    await openFeature(asSignedIn, "leaderboard");

    expect(await openFeature(asSignedIn)).toEqual(first);
    expect(first).toMatchObject({ drop: { copy: 1, isNew: true } });
  });

  test("CL11: collection going off and on again answers the same drop", async () => {
    const { asSignedIn } = await aReadyFeatureIn(t, "collection");
    const first = await openFeature(asSignedIn);
    await flagsOn(t, ...questsFlags);
    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
    await flagsOn(t, ...questsFlags, "collection");

    expect(await openFeature(asSignedIn)).toEqual(first);
  });
});

describe("CL14 CL18: with collection off or unset, nothing drops and the answers are main's", () => {
  test.each([
    { condition: "off", collection: [offForEveryone("collection")] },
    { condition: "unset", collection: [] },
  ])("with collection $condition, the opens answer no drop field and leave no drop", async ({ collection }) => {
    const { member, asSignedIn } = await aReadyFeatureIn(t, "everyone-board");
    await flagsFromPostHog(t, postHog, ...["website", "everyone-board", ...questsFlags].map(onForEveryone), ...collection);
    vi.mocked(publish).mockClear();

    expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
    expect(await openFeature(asSignedIn, "leaderboard")).toEqual({ kind: "opened" });
    expect(publishedEvents().map(({ type }) => type)).not.toContain("hoggieDropped");
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
    await flagsOn(t, ...questsFlags, "collection", "everyone-board");
    await unlocksShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await aTeamIn(t);
    await openFeature(asSignedIn);
    await settleInTimeOrder(t);
    expect(collectionExposures()).toEqual([]);

    await reachesLevel(t, member, 3);
    await openFeature(asSignedIn);
    await openFeature(asSignedIn);
    await openFeature(asSignedIn, "leaderboard");
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
