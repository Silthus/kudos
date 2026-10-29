import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../../testing/flags";
import { settleInTimeOrder, testBackend, type Backend } from "../../../testing/slackBackend";
import { reachesLevel } from "../../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api } from "../../_generated/api";
import type { Feature } from "../../unlocks/feature";
import type { MemberId } from "../../workspace/directory";
import { catalogue } from "./catalogue";

const planned = vi.hoisted(() => new Map<string, string>());

vi.mock("./draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./draw")>();
  const { hoggieNamed } = await import("./catalogue");
  return {
    ...actual,
    drawOf: vi.fn(async (input: Parameters<typeof actual.drawOf>[0]) => {
      const hoggie = planned.get(input.crate);
      return hoggie === undefined ? actual.drawOf(input) : { hoggie, rarity: hoggieNamed(hoggie)!.rarity };
    }),
  };
});

const now = new Date("2026-10-14T10:00:00Z");
const minuteMs = 60_000;
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "activity", "collection"];
const apm = { crest: "apm", name: "APM", art: { kind: "crest", slug: "apm" } };

type Caller = Pick<Backend, "query" | "mutation">;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  planned.clear();
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

function drawing(draws: Partial<Record<Feature, string>>) {
  for (const [feature, hoggie] of Object.entries(draws)) planned.set(`unlock:${feature}`, hoggie);
}

async function aMemberAtLevelFive(...alsoOn: string[]) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...alsoOn);
  await bookShippedBeforeAnyoneJoined(t);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  await reachesLevel(t, member, 5);
  return { member, asSignedIn };
}

function crestsOn(...alsoOn: string[]) {
  return switchWebsite(t, postHog, true, ...bookFlags, "crests", ...alsoOn);
}

function crestsOff() {
  return switchWebsite(t, postHog, true, ...bookFlags);
}

async function opens(caller: Caller, feature: Feature) {
  return caller.mutation(api.website.commands.openFeature, { feature });
}

async function opensAMinuteLater(caller: Caller, feature: Feature) {
  vi.setSystemTime(Date.now() + minuteMs);
  return { at: Date.now(), answer: await opens(caller, feature) };
}

function crestOfTheDrop(answer: Awaited<ReturnType<typeof opens>>) {
  if (answer.kind !== "opened" || answer.drop === undefined || answer.drop === null) throw new Error(`expected a drop, got ${JSON.stringify(answer)}`);
  return answer.drop.crest;
}

async function collectionOf(caller: Caller) {
  return caller.query(api.website.collection.getCollection, {});
}

async function crestsOf(caller: Caller) {
  const answer = await collectionOf(caller);
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${answer.kind}`);
  return answer.crests;
}

async function crestNamed(caller: Caller, crest: string) {
  return (await crestsOf(caller))?.find((entry) => entry.crest === crest);
}

async function foundEntriesOf(caller: Caller) {
  const page = await caller.query(api.website.activity.getActivity, { filter: "all", cursor: null, limit: 20 });
  if (page.kind !== "activity") throw new Error(`expected the activity, got ${page.kind}`);
  return page.entries.flatMap((entry) => (entry.kind === "found" ? [{ hoggie: entry.drop.hoggie, crest: entry.drop.crest }] : []));
}

function crestsExposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === "crests");
  return [...new Map(sent.map((event) => [event.uuid, event])).values()].map(({ properties }) => properties.$feature_flag_response);
}

function underCatalogueVersion<T>(version: number, run: () => Promise<T>): Promise<T> {
  const current = catalogue.version;
  Object.assign(catalogue, { version });
  return run().finally(() => Object.assign(catalogue, { version: current }));
}

describe("CL24: the drop that completes a team answers its crest", () => {
  test("the drop of a roster's last hoggie answers the crest, the drops before it answer none, and a repeated open answers the crest again", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });

    const first = await opens(asSignedIn, "book");
    const completing = await opens(asSignedIn, "leaderboard");

    expect([crestOfTheDrop(first), crestOfTheDrop(completing)]).toEqual([null, apm]);
    expect(await opens(asSignedIn, "leaderboard")).toEqual(completing);
  });

  test("a duplicate of a roster hoggie never answers the crest", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite", skillTree: "dynamite" });
    await opens(asSignedIn, "book");
    await opens(asSignedIn, "leaderboard");

    const duplicate = await opens(asSignedIn, "skillTree");

    expect(duplicate).toMatchObject({ drop: { hoggie: "dynamite", copy: 2 } });
    expect(crestOfTheDrop(duplicate)).toBeNull();
  });

  test("of two roster hoggies dropped in the same millisecond, the drop with the higher n completes the crest", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });

    const answers = [await opens(asSignedIn, "book"), await opens(asSignedIn, "leaderboard")];

    expect(answers.map(crestOfTheDrop)).toEqual([null, apm]);
    expect(await foundEntriesOf(asSignedIn)).toEqual(expect.arrayContaining([{ hoggie: "dynamite", crest: apm }, { hoggie: "roller-coaster", crest: null }]));
    expect(await crestNamed(asSignedIn, "apm")).toMatchObject({ held: 2, collectedAt: now.getTime() });
  });

  test("CL21: the activity's found entries carry the crest their drop completed", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite", skillTree: "cursor" });
    for (const feature of ["book", "leaderboard", "skillTree"] as const) await opensAMinuteLater(asSignedIn, feature);

    expect(await foundEntriesOf(asSignedIn)).toEqual([
      { hoggie: "cursor", crest: null },
      { hoggie: "dynamite", crest: apm },
      { hoggie: "roller-coaster", crest: null },
    ]);
  });
});

describe("CL23 CL25: getCollection's crests", () => {
  test("every crest in catalogue order with its roster, the roster hoggies held, and when the drop that completed it was found", async () => {
    const { member, asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "cursor", skillTree: "dynamite" });
    await opensAMinuteLater(asSignedIn, "book");
    await opensAMinuteLater(asSignedIn, "leaderboard");
    const { at: completedAt } = await opensAMinuteLater(asSignedIn, "skillTree");

    expect(await crestsOf(asSignedIn)).toEqual(await crestsHolding(member, { apm: { held: 2, collectedAt: completedAt }, "ai-gateway": { held: 1, collectedAt: null } }));
  });

  test("a roster held whole before version 2 shows as collected at the drop that completed it, and no drop answers its crest", async () => {
    const { asSignedIn } = await aMemberAtLevelFive();
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });
    const before = await underCatalogueVersion(1, async () => [await opensAMinuteLater(asSignedIn, "book"), await opensAMinuteLater(asSignedIn, "leaderboard")]);
    await crestsOn();

    expect(await crestNamed(asSignedIn, "apm")).toMatchObject({ held: 2, collectedAt: before[1]!.at });
    expect(await opens(asSignedIn, "leaderboard")).toMatchObject({ drop: { hoggie: "dynamite", crest: null } });
    expect(await foundEntriesOf(asSignedIn)).toEqual([
      { hoggie: "dynamite", crest: null },
      { hoggie: "roller-coaster", crest: null },
    ]);
  });
});

describe("CL25 CL26: crests show only while crests is on", () => {
  test("with crests off the completing drop answers no crest field, getCollection no crests and the activity no crest, and once on the same drop answers its crest", async () => {
    const { asSignedIn } = await aMemberAtLevelFive();
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });
    await opens(asSignedIn, "book");

    const completing = await opens(asSignedIn, "leaderboard");

    expect(completing).toEqual({ kind: "opened", drop: expect.not.objectContaining({ crest: expect.anything() }) });
    expect(JSON.stringify([completing, await collectionOf(asSignedIn), await foundEntriesOf(asSignedIn)])).not.toMatch(/crest/);
    await crestsOn();
    expect(crestOfTheDrop(await opens(asSignedIn, "leaderboard"))).toEqual(apm);
  });

});

describe("CL23: a collected crest stays collected", () => {
  test("later drops, a duplicate of a roster hoggie and another team's hoggies, leave the crest collected at the drop that completed it", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite", skillTree: "dynamite" });
    await opensAMinuteLater(asSignedIn, "book");
    const { at: completedAt, answer: completing } = await opensAMinuteLater(asSignedIn, "leaderboard");
    const collected = await crestNamed(asSignedIn, "apm");
    expect(collected).toMatchObject({ held: 2, collectedAt: completedAt });

    await opensAMinuteLater(asSignedIn, "skillTree");
    await underCatalogueVersion(3, () => opens(asSignedIn, "leaderboard"));

    expect(await crestNamed(asSignedIn, "apm")).toEqual(collected);
    expect(await opens(asSignedIn, "leaderboard")).toEqual(completing);
  });

  test("turning crests off again hides the collected crest and takes nothing away", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });
    await opens(asSignedIn, "book");
    const completing = await opens(asSignedIn, "leaderboard");
    const crests = await crestsOf(asSignedIn);

    await crestsOff();
    expect(JSON.stringify([await opens(asSignedIn, "leaderboard"), await collectionOf(asSignedIn)])).not.toMatch(/crest/);
    await crestsOn();

    expect([await opens(asSignedIn, "leaderboard"), await crestsOf(asSignedIn)]).toEqual([completing, crests]);
  });
});

describe("CL26: crests' exposure", () => {
  test("goes once per member and value, only by an open that answers a crest, never by getCollection, the activity or an open without one", async () => {
    const { asSignedIn } = await aMemberAtLevelFive("crests");
    drawing({ book: "roller-coaster", leaderboard: "dynamite" });
    await opens(asSignedIn, "book");
    await opens(asSignedIn, "book");
    await collectionOf(asSignedIn);
    await foundEntriesOf(asSignedIn);
    await settleInTimeOrder(t);
    expect(crestsExposures()).toEqual([]);

    await opens(asSignedIn, "leaderboard");
    await opens(asSignedIn, "leaderboard");
    await settleInTimeOrder(t);

    expect(crestsExposures()).toEqual([true]);
  });
});

async function crestsHolding(member: MemberId, held: Record<string, { held: number; collectedAt: number | null }>) {
  const { seenKeyOf } = await import("../../website/seen");
  return Promise.all(
    catalogue.crests.map(async ({ crest, name, roster }) => {
      const { held: count, collectedAt } = held[crest] ?? { held: 0, collectedAt: null };
      return { crest, name, art: { kind: "crest", slug: crest }, roster, held: count, collectedAt, seen: collectedAt === null ? null : await seenKeyOf(member, `crest:${crest}:${collectedAt}`) };
    }),
  );
}
