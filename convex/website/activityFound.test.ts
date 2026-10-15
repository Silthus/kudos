import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { journeyShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { allowanceDay } from "../engine/allowance";
import { catalogue, type Rarity } from "../hoggies/catalogue";
import type { MemberId } from "../workspace/directory";
import type { Activity, ActivityEntry } from "./activity";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const minute = 60_000;
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const timelineFlags = ["activity", "xp-levels", "unlocks", "quests"];

type Filter = "all" | "received" | "given";
type Caller = Pick<Backend, "query">;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
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

function collection(on: boolean) {
  return switchWebsite(t, postHog, true, ...timelineFlags, ...(on ? ["collection"] : []));
}

async function aTeam() {
  const member = await aMember(t, juno.user);
  const teammate = await aMember(t, rowan.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  return { member, teammate, asSignedIn };
}

async function activityOf(caller: Caller, args: { filter: Filter; cursor?: string | null; limit?: number }): Promise<Activity> {
  const answer = await caller.query(api.website.activity.getActivity, { cursor: null, ...args });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return answer;
}

async function everyPage(caller: Caller, filter: Filter, limit: number) {
  const entries: ActivityEntry[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const answer: Activity = await activityOf(caller, { filter, cursor, limit });
    entries.push(...answer.entries);
    cursor = answer.cursor;
    if (cursor === null) return entries;
  }
  throw new Error("the pages never ended");
}

function seen(entry: ActivityEntry) {
  if (entry.kind === "found") return `found ${entry.drop.hoggie} at ${entry.at}`;
  if (entry.kind === "levelUp") return `level ${entry.level} at ${entry.at}`;
  return `${entry.kind} at ${entry.at}`;
}

function keyOf(entry: ActivityEntry) {
  return "key" in entry ? entry.key : `level ${entry.level}`;
}

async function thanks(giver: MemberId, recipient: MemberId, message: string) {
  const at = Date.now();
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { message: { workspace: "T1", conversation: "C1", message }, annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
  return at;
}

const [common, otherCommon] = catalogue.hoggies.filter(({ rarity }) => rarity === "common");
const rare = catalogue.hoggies.find(({ rarity }) => rarity === "rare")!;

async function aDrop(member: MemberId, { hoggie, rarity }: { hoggie: string; rarity: Rarity }, at: number, n: number, copy = 1) {
  await t.run((ctx) => ctx.db.insert("drops", { member, crate: `weekly:2026-10-12:${n}`, hoggie, rarity, n, copy, catalogueVersion: catalogue.version, at }));
}

async function aKudos(giver: MemberId, recipient: MemberId, message: string, at: number) {
  await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at }));
}

describe("CL21: the hoggie a crate dropped is found in the activity", () => {
  test("opening a Journey step's crate on the website adds a found entry with the drop the open answered, between the kudos around it", async () => {
    await collection(true);
    await journeyShippedBeforeAnyoneJoined(t);
    const { member, teammate, asSignedIn } = await aTeam();
    const gaveAt = await thanks(member, teammate, "1760435000.000100");
    vi.advanceTimersByTime(minute);
    const opened = await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: { kind: "journey", step: "first-thanks" } });
    const openedAt = Date.now();
    vi.advanceTimersByTime(minute);
    const gotAt = await thanks(teammate, member, "1760435120.000100");
    if (opened?.kind !== "opened" || !("drop" in opened) || opened.drop === null) throw new Error("expected the open to answer its drop");

    const { entries } = await activityOf(asSignedIn, { filter: "all" });

    expect(entries.filter(({ kind }) => kind !== "levelUp").map(({ kind, at }) => ({ kind, at }))).toEqual([
      { kind: "kudosReceived", at: gotAt },
      { kind: "found", at: openedAt },
      { kind: "kudosGiven", at: gaveAt },
    ]);
    expect(entries.find((entry) => entry.kind === "found")).toEqual({ kind: "found", at: openedAt, key: expect.any(String), drop: opened.drop });
  });
});

describe("CL21: found entries in order, filters and pages", () => {
  const morning = Date.parse("2026-10-14T08:00:00Z");
  const noon = Date.parse("2026-10-14T12:00:00Z");
  const evening = Date.parse("2026-10-14T18:00:00Z");

  async function aMorningOfKudosAndDrops() {
    const team = await aTeam();
    await aKudos(team.teammate, team.member, "1.1", evening);
    await aDrop(team.member, rare, noon, 3);
    await aKudos(team.member, team.teammate, "1.2", noon);
    await aDrop(team.member, otherCommon!, noon, 2);
    await aKudos(team.teammate, team.member, "1.3", noon);
    await aDrop(team.member, common!, morning, 1);
    await aKudos(team.member, team.teammate, "1.4", morning);
    return team;
  }

  const newestFirst = [
    `kudosReceived at ${evening}`,
    `kudosGiven at ${noon}`,
    `kudosReceived at ${noon}`,
    `found ${rare.hoggie} at ${noon}`,
    `found ${otherCommon!.hoggie} at ${noon}`,
    `kudosGiven at ${morning}`,
    `found ${common!.hoggie} at ${morning}`,
  ];

  test("sit in time order between the kudos, below the kudos of their instant and the later drop first", async () => {
    await collection(true);
    const { asSignedIn } = await aMorningOfKudosAndDrops();

    const { entries, cursor } = await activityOf(asSignedIn, { filter: "all" });

    expect(entries.map(seen)).toEqual(newestFirst);
    expect(cursor).toBeNull();
  });

  test("show under all only, never under received or given", async () => {
    await collection(true);
    const { asSignedIn } = await aMorningOfKudosAndDrops();

    expect((await everyPage(asSignedIn, "received", 20)).map(seen)).toEqual(newestFirst.filter((line) => line.startsWith("kudosReceived")));
    expect((await everyPage(asSignedIn, "given", 20)).map(seen)).toEqual(newestFirst.filter((line) => line.startsWith("kudosGiven")));
  });

  test("page across every cursor, repeating and skipping none, each with its own key", async () => {
    await collection(true);
    const { asSignedIn } = await aMorningOfKudosAndDrops();

    for (const limit of [1, 2, 3]) {
      const entries = await everyPage(asSignedIn, "all", limit);
      expect(entries.map(seen)).toEqual(newestFirst);
      expect(new Set(entries.map(keyOf))).toHaveProperty("size", newestFirst.length);
    }
  });

  test("a found entry carries the drop as the open answered it, its key only a position", async () => {
    await collection(true);
    const { member, asSignedIn } = await aTeam();
    await aDrop(member, rare, noon, 1);
    await aDrop(member, rare, evening, 2, 2);

    const { entries } = await activityOf(asSignedIn, { filter: "all" });

    expect(entries).toEqual([
      { kind: "found", at: evening, key: expect.stringMatching(/^[\d._]+$/), drop: { hoggie: rare.hoggie, name: rare.name, rarity: "rare", art: { kind: "hoggie", slug: rare.hoggie }, copy: 2, isNew: false } },
      { kind: "found", at: noon, key: expect.stringMatching(/^[\d._]+$/), drop: { hoggie: rare.hoggie, name: rare.name, rarity: "rare", art: { kind: "hoggie", slug: rare.hoggie }, copy: 1, isNew: true } },
    ]);
  });

  test("with collection off, every page equals the timeline without any drop", async () => {
    await collection(false);
    const { member, teammate, asSignedIn } = await aTeam();
    await aKudos(teammate, member, "1.1", evening);
    await aKudos(member, teammate, "1.2", noon);
    await aKudos(teammate, member, "1.3", morning);
    const pagesOf = async () => Promise.all([1, 2, 20].flatMap((limit) => (["all", "received", "given"] as const).map((filter) => everyPage(asSignedIn, filter, limit))));
    const withoutDrops = await pagesOf();

    await aDrop(member, rare, noon, 1);
    await aDrop(member, common!, morning, 2);

    expect(await pagesOf()).toEqual(withoutDrops);
  });
});

describe("CL21 AT18: a page with drops stays within Convex's limits", () => {
  test("a member with thousands of kudos and of drops inside one instant pages within Convex's limits, repeating none", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await collection(true);
    const { member, teammate, asSignedIn } = await aTeam();
    const kudosAt = Date.parse("2026-10-14T09:00:00Z");
    const foundAt = kudosAt + minute;
    for (let batch = 0; batch < 3; batch++) {
      await t.run(async (ctx) => {
        for (let index = batch * 1000; index < (batch + 1) * 1000; index++) {
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `received-${index}`, giver: teammate, recipient: member, kudos: 1, day: "2026-10-14", at: kudosAt });
          await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `given-${index}`, giver: member, recipient: teammate, kudos: 1, day: "2026-10-14", at: kudosAt });
          await ctx.db.insert("drops", { member, crate: `weekly:2026-10-12:${index}`, hoggie: common!.hoggie, rarity: "common", n: index + 1, copy: index + 1, catalogueVersion: catalogue.version, at: foundAt });
        }
      });
    }

    const first = await activityOf(asSignedIn, { filter: "all", limit: 50 });
    const next = await activityOf(asSignedIn, { filter: "all", cursor: first.cursor, limit: 50 });

    expect([...first.entries, ...next.entries].map((entry) => (entry.kind === "found" ? entry.drop.copy : entry.kind))).toEqual(Array.from({ length: 100 }, (_, index) => 3000 - index));
  });
});
