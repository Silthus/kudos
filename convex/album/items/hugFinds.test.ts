import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { react, settle, testBackend, type Backend } from "../../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { HugGivenEvent } from "../../bus/events";
import { standingOf } from "../../progression/progression";
import type { MemberId } from "../../workspace/directory";
import type { AlbumAnswer, AlbumRead, TurnAnswer } from "../../website/album";
import type { Denial } from "../../website/memberQuery";
import { catalogue, rankOf } from "../hoggies/catalogue";
import { drawOf, findsOnHug } from "../hoggies/draw";

const tuesday = new Date("2026-10-13T10:00:00Z").getTime();
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const rewardsOn = ["album", "collection", "packs", "hidden-items", "hugs", "hug-rewards"];

type Person = { user: string; name: string };
type Reader = Awaited<ReturnType<typeof signedIn>>;

let postHog: FakePostHog;
let t: Backend;
let bobsId: MemberId;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const person of [alice, bob]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await switchWebsite(t, postHog, true, ...rewardsOn);
  await aMember(t, alice.user);
  bobsId = await aMember(t, bob.user);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH35 HH36: a hug given can find a hoggie, capped at rare", () => {
  test("a hug that finds earns Bob one face-down item, and its turn draws a hoggie and pays no XP", async () => {
    await hugAlice(await aMessageWhereBobsHug("finds"));
    const asBob = await signedIn(bob);
    const board = await boardOf(asBob);
    const xpBefore = await xpOfBob();

    const turned = await turn(asBob, board.items[0]!.item);

    expect(board.items.map(({ reason }) => reason)).toEqual([{ kind: "hug" }]);
    expect(turned).toMatchObject({ kind: "turned", face: { kind: "hoggie" }, applied: null });
    expect(await xpOfBob()).toBe(xpBefore);
  });

  test("a hug that doesn't find earns nothing", async () => {
    await hugAlice(await aMessageWhereBobsHug("misses"));

    expect(await hugFindsOnTheBoardOf(bob)).toEqual([]);
  });

  test("Bob finds at most once a day: a second finding hug that day earns nothing, and the next day's finds again", async () => {
    await hugAlice(await aMessageWhereBobsHug("finds"));
    await hugAlice(await aMessageWhereBobsHug("finds"));
    vi.setSystemTime(tuesday + dayMs);
    await hugAlice(await aMessageWhereBobsHug("finds"));

    expect(await hugFindsOnTheBoardOf(bob)).toHaveLength(2);
  });

  test("on a day whose uncapped draw would be epic or legendary, the find still turns up a hoggie no rarer than rare, with rarity-caps off", async () => {
    vi.setSystemTime(await aDayWhoseUncappedDrawIsAboveRare());
    await hugAlice(await aMessageWhereBobsHug("finds"));
    const asBob = await signedIn(bob);

    const turned = await turn(asBob, (await boardOf(asBob)).items[0]!.item);

    expect(turned.kind === "turned" && turned.face.kind === "hoggie" && rankOf(turned.face.drop.rarity)).toBeLessThanOrEqual(rankOf("rare"));
  });

  test("while hug-rewards is off, a hug finds nothing", async () => {
    await switchWebsite(t, postHog, true, ...rewardsOn.filter((flag) => flag !== "hug-rewards"));

    await hugAlice(await aMessageWhereBobsHug("finds"));

    expect(await hugFindsOnTheBoardOf(bob)).toEqual([]);
  });
});

describe("HH34 HH35: Album finds from hugGiven as the hug decided", () => {
  test("a finding hugGiven delivered twice earns one item", async () => {
    const event = hugGiven(await aMessageWhereBobsHug("finds"), { rewards: true });

    await t.mutation(internal.album.items.hugFinds.findOnHug, { event });
    await t.mutation(internal.album.items.hugFinds.findOnHug, { event });

    expect(await hugFindsOnTheBoardOf(bob)).toHaveLength(1);
  });

  test("a finding hugGiven decided with rewards finds after hug-rewards turned off", async () => {
    await switchWebsite(t, postHog, true, ...rewardsOn.filter((flag) => flag !== "hug-rewards"));

    await t.mutation(internal.album.items.hugFinds.findOnHug, { event: hugGiven(await aMessageWhereBobsHug("finds"), { rewards: true }) });

    expect(await hugFindsOnTheBoardOf(bob)).toHaveLength(1);
  });

  test("a finding hugGiven decided without rewards, or from before the flag, finds nothing after hug-rewards turned on", async () => {
    const ts = await aMessageWhereBobsHug("finds");

    await t.mutation(internal.album.items.hugFinds.findOnHug, { event: hugGiven(ts, { rewards: false }) });
    await t.mutation(internal.album.items.hugFinds.findOnHug, { event: hugGiven(ts) });

    expect(await hugFindsOnTheBoardOf(bob)).toEqual([]);
  });

  test("a giver who left finds nothing, and nothing throws", async () => {
    await t.run((ctx) => ctx.db.patch(bobsId, { kind: "not-a-member" }));

    await t.mutation(internal.album.items.hugFinds.findOnHug, { event: hugGiven(await aMessageWhereBobsHug("finds"), { rewards: true }) });

    expect(await t.run((ctx) => ctx.db.query("items").withIndex("by_member_turned", (q) => q.eq("member", bobsId)).take(1))).toEqual([]);
  });
});

let candidates = 0;

async function aMessageWhereBobsHug(outcome: "finds" | "misses") {
  for (;;) {
    candidates += 1;
    const ts = `${Math.floor((Date.now() - hourMs) / 1000)}.${String(candidates).padStart(6, "0")}`;
    if ((await findsOnHug({ secret: "", member: bobsId, hug: `C1:${ts}` })) === (outcome === "finds")) return ts;
  }
}

async function aDayWhoseUncappedDrawIsAboveRare() {
  for (let day = tuesday; ; day += dayMs) {
    const crate = `hug-find:${new Date(day).toISOString().slice(0, 10)}`;
    const { rarity } = await drawOf({ secret: "", member: bobsId, crate, version: catalogue.version, weights: "base" });
    if (rankOf(rarity) > rankOf("rare")) return day;
  }
}

async function hugAlice(ts: string) {
  await react(t, { user: bob.user, itemUser: alice.user, ts });
  await settle(t);
}

function hugGiven(ts: string, rewarded: Pick<HugGivenEvent, "rewards"> = {}): HugGivenEvent {
  return { type: "hugGiven", workspace: "T1", giver: bobsId, message: { workspace: "T1", conversation: "C1", message: ts }, onKudos: false, at: Date.now(), day: "2026-10-13", first: false, reaction: "taco", ...rewarded };
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function boardOf(reader: Reader) {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  const { board } = album as AlbumAnswer;
  if (board === undefined) throw new Error(`expected the item board, got ${JSON.stringify(album)}`);
  return board;
}

async function hugFindsOnTheBoardOf(person: Person) {
  return (await boardOf(await signedIn(person))).items.filter(({ reason }) => reason.kind === "hug");
}

function turn(reader: Reader, item: Id<"items">): Promise<TurnAnswer | Denial> {
  return reader.mutation(api.website.album.turnItem, { item });
}

async function xpOfBob() {
  return (await t.run((ctx) => standingOf(ctx, bobsId))).xp;
}
