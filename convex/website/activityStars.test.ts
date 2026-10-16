import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text, type ReactionOptions } from "../../testing/slackMessages";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import { catalogue } from "../hoggies/catalogue";
import type { MemberId } from "../workspace/directory";
import type { Activity, ActivityEntry, Person } from "./activity";

const now = new Date("2026-10-14T10:00:00Z");
const postedTs = "1791971000.000100";
const permalink = "https://kudos-test.slack.com/archives/C1/p1791971000000100";
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const dana = { user: "U_DANA", name: "Dana Diaz" };
const reason = "for the calm rollback of the billing service";
const timeline = ["activity", "xp-levels", "unlocks", "collection"];
const minute = 60_000;

type Filter = "all" | "received" | "given";
type Caller = Pick<Backend, "query">;
type Someone = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl("https://kudos-test.slack.com/");
  for (const person of [alice, bob, carol, dana]) slack.withMember(person.user, { real_name: person.name, tz: "Europe/Berlin" });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function starsOn(on = true, ...flags: string[]) {
  return switchWebsite(t, postHog, true, ...(flags.length > 0 ? flags : timeline), ...(on ? ["stars"] : []));
}

function personOf({ name }: Someone): Person {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("");
  return { name, face: { kind: "initials", initials } };
}

async function signedIn(person: Someone) {
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  return asSignedIn;
}

async function activityOf(caller: Caller, args: { filter: Filter; cursor?: string | null; limit?: number }): Promise<Activity> {
  const answer = await caller.query(api.website.activity.getActivity, { cursor: null, ...args });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return answer;
}

async function everyAnswer(caller: Caller, filter: Filter, limit: number) {
  const answers: Activity[] = [];
  let cursor: string | null = null;
  do {
    const answer: Activity = await activityOf(caller, { filter, cursor, limit });
    answers.push(answer);
    cursor = answer.cursor;
  } while (cursor !== null && answers.length < 100);
  if (cursor !== null) throw new Error("the pages never ended");
  return answers;
}

async function everyPage(caller: Caller, filter: Filter, limit: number) {
  return (await everyAnswer(caller, filter, limit)).flatMap(({ entries }) => entries);
}

async function kudos(giver: Someone, recipients: Someone[], ts = postedTs, channel = "C1") {
  await post(t, [section(text(`thanks ${reason} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts, channel });
  await settle(t);
}

async function star(giver: Someone, author: Someone, options: ReactionOptions = {}) {
  const eventTs = `${Math.floor(Date.now() / 1000)}.000200`;
  await react(t, { user: giver.user, itemUser: author.user, ts: postedTs, eventTs, ...options });
  await settle(t);
  return Number(eventTs) * 1000;
}

describe("SR11: a star on the activity timeline", () => {
  test("a star on a teammate's message answers starReceived to its author and starGiven to its giver, with no words", async () => {
    await starsOn();
    await kudos(carol, [dana], "1791971000.000200", "C2");
    vi.advanceTimersByTime(minute);

    const at = await star(bob, alice);

    const received = await activityOf(await signedIn(alice), { filter: "all" });
    const given = await activityOf(await signedIn(bob), { filter: "all" });
    expect(received.entries).toEqual([{ kind: "starReceived", key: expect.any(String), at, giver: personOf(bob), xp: 1, on: expect.any(String), permalink, kudos: null }]);
    expect(given.entries).toEqual([{ kind: "starGiven", key: expect.any(String), at, people: [personOf(alice)], xp: 1, on: expect.any(String), permalink, kudos: null }]);
    expect(onOf(received.entries[0])).toBe(onOf(given.entries[0]));
  });

  test("a star on a Given kudos message answers each recipient and the giver with the kudos' words, one on key for all", async () => {
    await starsOn();
    await kudos(alice, [bob, carol]);
    vi.advanceTimersByTime(minute);

    const at = await star(dana, alice);

    const [asAlice, asBob, asCarol, asDana] = await Promise.all([signedIn(alice), signedIn(bob), signedIn(carol), signedIn(dana)]);
    const words = (await activityOf(asAlice, { filter: "given" })).entries.map((entry) => (entry.kind === "kudosGiven" ? entry.message : null))[0];
    const starOf = async (caller: Caller) => (await activityOf(caller, { filter: "all" })).entries.filter(({ kind }) => kind === "starReceived" || kind === "starGiven");
    const [forBob, forCarol, byDana] = await Promise.all([starOf(asBob), starOf(asCarol), starOf(asDana)]);
    const received = { kind: "starReceived", key: expect.any(String), at, giver: personOf(dana), xp: 1, on: expect.any(String), permalink, kudos: words };
    expect(words).toMatchObject({ kind: "text", segments: expect.arrayContaining([{ kind: "text", text: `thanks ${reason} ` }]) });
    expect(forBob).toEqual([received]);
    expect(forCarol).toEqual([received]);
    expect(byDana).toEqual([{ kind: "starGiven", key: expect.any(String), at, people: [personOf(bob), personOf(carol)], xp: 1, on: expect.any(String), permalink, kudos: words }]);
    expect(new Set([...forBob, ...forCarol, ...byDana].map(onOf)).size).toBe(1);
    expect((await activityOf(asAlice, { filter: "all" })).entries.map(({ kind }) => kind)).not.toContain("starReceived");
  });

  test("stars on two messages carry different on keys, and every star its own entry and key", async () => {
    await starsOn();
    await star(bob, alice);
    vi.advanceTimersByTime(minute);
    await star(carol, alice);
    vi.advanceTimersByTime(minute);
    await star(bob, alice, { ts: "1791971060.000100" });

    const { entries } = await activityOf(await signedIn(alice), { filter: "all" });

    expect(entries.map((entry) => (entry.kind === "starReceived" ? entry.giver.name : entry.kind))).toEqual([bob.name, carol.name, bob.name]);
    expect(new Set(entries.map(onOf)).size).toBe(2);
    expect(onOf(entries[1])).toBe(onOf(entries[2]));
    expect(new Set(entries.map(keyOf)).size).toBe(3);
  });

  test("xp is null while XP doesn't show to the viewer", async () => {
    await starsOn(true, "activity");

    await star(bob, alice);

    const [received] = (await activityOf(await signedIn(alice), { filter: "all" })).entries;
    const [given] = (await activityOf(await signedIn(bob), { filter: "all" })).entries;
    expect([received, given]).toMatchObject([
      { kind: "starReceived", xp: null },
      { kind: "starGiven", xp: null },
    ]);
  });
});

describe("SR11: stars stay out of the views that aren't the full timeline", () => {
  test("with stars off for the viewer, every page equals the timeline without stars, even when they received and gave stars", async () => {
    await starsOn(false);
    await kudos(alice, [bob]);
    vi.advanceTimersByTime(minute);
    await kudos(carol, [alice], "1791971180.000100");
    const [asAlice, asBob] = await Promise.all([signedIn(alice), signedIn(bob)]);
    const pagesOf = () => Promise.all([asAlice, asBob].flatMap((caller) => [1, 2, 20].flatMap((limit) => (["all", "received", "given"] as const).map((filter) => everyAnswer(caller, filter, limit)))));
    const withoutStars = await pagesOf();

    await starsOn();
    await star(bob, alice);
    await star(alice, carol, { ts: "1791971060.000100" });
    await star(dana, alice, { ts: "1791971120.000100" });
    await starsOn(false);

    expect(await pagesOf()).toEqual(withoutStars);
    expect(withoutStars[0]!.flatMap(({ entries }) => entries).map(({ kind }) => kind)).toEqual(["kudosReceived", "kudosGiven"]);
  });

  test("the received and given filters and the recent kudos answer the same with and without stars", async () => {
    await starsOn();
    await kudos(alice, [bob]);
    vi.advanceTimersByTime(minute);
    const asBob = await signedIn(bob);
    const asAlice = await signedIn(alice);
    const viewsOf = () =>
      Promise.all([asAlice, asBob].flatMap((caller) => [...(["received", "given"] as const).map((filter) => everyAnswer(caller, filter, 1)), ...(["received", "given"] as const).map((direction) => caller.query(api.website.activity.getRecentKudos, { direction }))]));
    const before = await viewsOf();

    await star(carol, alice);
    await star(alice, bob, { ts: "1791971060.000100" });
    await star(bob, alice, { ts: "1791971120.000100" });

    expect(await viewsOf()).toEqual(before);
    expect((await everyPage(asBob, "all", 20)).map(({ kind }) => kind).sort()).toEqual(["kudosReceived", "starGiven", "starReceived", "starReceived"]);
  });
});

describe("SR11: the page's recipients bound leaves a page without star people as it was", () => {
  test.each([false, true])("with stars %s, a received kudos newer than a message given to 800 people, and one older, share one page", { timeout: 120_000 }, async (on) => {
    await starsOn(on, "activity");
    const at = now.getTime();
    const [me, teammate] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob)]);
    await t.run(async (ctx) => {
      for (let index = 0; index < 800; index++) {
        const recipient = await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", asOf: 0 });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: "1.2", giver: me, recipient, kudos: 1, day: "2026-10-14", at: at - 2 * minute });
      }
    });
    await aKudos(teammate, me, "1.3", at - minute);
    await aKudos(teammate, me, "1.1", at - 3 * minute);

    const { entries, cursor } = await activityOf(await signedIn(alice), { filter: "all" });

    expect(entries.map(({ kind }) => kind)).toEqual(["kudosReceived", "kudosGiven", "kudosReceived"]);
    expect(cursor).toBeNull();
  });
});

describe("SR11: star entries in order and pages", () => {
  const morning = Date.parse("2026-10-14T08:00:00Z");
  const noon = Date.parse("2026-10-14T12:00:00Z");
  const evening = Date.parse("2026-10-14T18:00:00Z");

  async function aDayOfEverything() {
    const [me, teammate, other] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob), aMemberNamed(carol)]);
    await aStarGiven(me, teammate, "2.1", evening);
    await aKudos(teammate, me, "1.1", evening);
    await aStarReceived(teammate, me, "2.2", noon);
    await aLevelUp(me, 2, noon);
    await aStarGiven(me, other, "2.3", noon);
    await aKudos(me, teammate, "1.2", noon);
    await aDrop(me, noon, 1);
    await aStarReceived(other, me, "2.4", noon);
    await aKudos(teammate, me, "1.3", noon);
    await aStarReceived(other, me, "2.5", morning);
    await aKudos(me, teammate, "1.4", morning);
    return signedIn(alice);
  }

  const newestFirst = [
    `kudosReceived at ${evening}`,
    `starGiven at ${evening}`,
    `levelUp at ${noon}`,
    `kudosGiven at ${noon}`,
    `kudosReceived at ${noon}`,
    `found at ${noon}`,
    `starGiven at ${noon}`,
    `starReceived at ${noon}`,
    `starReceived at ${noon}`,
    `kudosGiven at ${morning}`,
    `starReceived at ${morning}`,
  ];

  test("sit in time order, below the kudos, level-up and found entries of their instant", async () => {
    await starsOn();
    const asAlice = await aDayOfEverything();

    const { entries, cursor } = await activityOf(asAlice, { filter: "all" });

    expect(entries.map(seen)).toEqual(newestFirst);
    expect(cursor).toBeNull();
  });

  test("page across every cursor, repeating and skipping none, each with its own key", async () => {
    await starsOn();
    const asAlice = await aDayOfEverything();

    for (const limit of [1, 2, 3, 4]) {
      const entries = await everyPage(asAlice, "all", limit);
      expect(entries.map(seen)).toEqual(newestFirst);
      expect(new Set(entries.map(keyOf))).toHaveProperty("size", newestFirst.length);
    }
  });

  test("a cursor from a page without stars still reads once stars are on", async () => {
    await starsOn(false);
    const asAlice = await aDayOfEverything();
    const { cursor } = await activityOf(asAlice, { filter: "all", limit: 2 });

    await starsOn();
    const { entries } = await activityOf(asAlice, { filter: "all", cursor, limit: 20 });

    expect(entries.map(seen)).toEqual(newestFirst.slice(newestFirst.indexOf(`levelUp at ${noon}`) + 1));
  });

  test("a cursor in the form main wrote before stars reads the same position once stars are on", async () => {
    await starsOn();
    const asAlice = await aDayOfEverything();
    const writtenByMainBeforeStars = "1791979200000_1_9999999999999";

    const { entries } = await activityOf(asAlice, { filter: "all", cursor: writtenByMainBeforeStars, limit: 20 });

    expect(entries.map(seen)).toEqual(newestFirst.slice(newestFirst.indexOf(`kudosGiven at ${noon}`)));
  });
});

describe("SR11 SR24: a page of stars stays within Convex's limits", () => {
  test("25 kudos given and 25 stars given on kudos messages, each to 28 people with words that mention 40, share a page's recipients and stay within Convex's limits, skipping and repeating none", { timeout: 180_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await starsOn(true, "activity", "xp-levels", "unlocks", "skill-tree");
    await unlocksShippedBeforeAnyoneJoined(t);
    const at = now.getTime();
    const [me, author] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob)]);
    const thanked = await t.run(async (ctx) => {
      const ids: MemberId[] = [];
      for (let index = 0; index < 28; index++) ids.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", asOf: 0 }));
      return ids;
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index++) {
        for (const [conversation, giver, when] of [["C1", me, at + 2 * index + 1], ["C2", author, at + 2 * index]] as const) {
          const message = `1791960${String(index).padStart(3, "0")}.000100`;
          const segments = Array.from({ length: 40 }, (_, mentioned) => ({ kind: "person" as const, user: `U_MENTIONED_${conversation}_${index}_${mentioned}` }));
          await ctx.db.insert("kudosTexts", { workspace: "T1", conversation, message, kind: "words", revision: 1n, author: giver === me ? alice.user : bob.user, edited: false, segments, visibility: "public", gate: null });
          for (const recipient of thanked) {
            const award = await ctx.db.insert("awards", { workspace: "T1", conversation, message, giver, recipient, kudos: 1, day: "2026-10-14", at: when });
            await ctx.db.insert("effectsRecords", { award, member: giver, side: "giver", day: "2026-10-14", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1", bonus: [{ source: "spark", xp: 5 }] });
          }
          if (conversation === "C2") await ctx.db.insert("stars", { workspace: "T1", conversation, message, giver: me, onKudos: true, at: when, day: "2026-10-14" });
        }
      }
    });

    const answers = await everyAnswer(await signedIn(alice), "all", 50);
    const entries = answers.flatMap((answer) => answer.entries);

    expect(answers.map((answer) => answer.entries.length)).toEqual([25, 25]);
    expect(entries.map(({ kind, at }) => `${kind} ${at - now.getTime()}`)).toEqual(Array.from({ length: 50 }, (_, index) => `${index % 2 === 0 ? "kudosGiven" : "starGiven"} ${49 - index}`));
    expect(entries.map((entry) => (entry.kind === "kudosGiven" ? entry.recipients.length : entry.kind === "starGiven" ? entry.people.length : 0))).toEqual(Array(50).fill(28));
  });

  test("a page of fifty stars received, and fifty given, each on a kudos message whose words mention forty people, stays within Convex's limits", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await starsOn(true, "activity", "xp-levels");
    const at = now.getTime();
    const [me, teammate] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob)]);
    await t.run(async (ctx) => {
      for (let index = 0; index < 51; index++) {
        const message = `1760350${String(index).padStart(3, "0")}.000100`;
        const segments = Array.from({ length: 40 }, (_, mentioned) => ({ kind: "person" as const, user: `U_MENTIONED_${index}_${mentioned}` }));
        await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: bob.user, edited: false, segments, visibility: "public", gate: null });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver: teammate, recipient: me, kudos: 1, day: "2026-10-14", at: at - 1 });
        const received = await ctx.db.insert("stars", { workspace: "T1", conversation: "C1", message, giver: teammate, onKudos: true, at: at + index, day: "2026-10-14" });
        await ctx.db.insert("starPeople", { star: received, member: me, at: at + index });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C2", message, giver: teammate, recipient: teammate, kudos: 1, day: "2026-10-14", at: at - 1 });
        await ctx.db.insert("stars", { workspace: "T1", conversation: "C2", message, giver: me, onKudos: true, at: at + index, day: "2026-10-14" });
      }
    });

    const first = await activityOf(await signedIn(alice), { filter: "all", limit: 50 });
    const next = await activityOf(await signedIn(alice), { filter: "all", limit: 50, cursor: first.cursor });

    expect(first.entries.map(({ kind }) => kind)).toEqual(Array.from({ length: 25 }, () => ["starGiven", "starReceived"]).flat());
    expect(next.entries).toHaveLength(50);
  });
});

function aMemberNamed({ user, name }: Someone): Promise<MemberId> {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, name, kind: "member", asOf: 0 }));
}

async function aKudos(giver: MemberId, recipient: MemberId, message: string, at: number) {
  await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at }));
}

async function aStarGiven(giver: MemberId, author: MemberId, message: string, at: number) {
  await t.run((ctx) => ctx.db.insert("stars", { workspace: "T1", conversation: "C1", message, giver, onKudos: false, author, at, day: "2026-10-14" }));
}

async function aStarReceived(giver: MemberId, author: MemberId, message: string, at: number) {
  await t.run(async (ctx) => {
    const star = await ctx.db.insert("stars", { workspace: "T1", conversation: "C1", message, giver, onKudos: false, author, at, day: "2026-10-14" });
    await ctx.db.insert("starPeople", { star, member: author, at });
  });
}

async function aLevelUp(member: MemberId, level: number, at: number) {
  await t.run((ctx) => ctx.db.insert("levelUps", { member, level, ready: [], at }));
}

async function aDrop(member: MemberId, at: number, n: number) {
  const hoggie = catalogue.hoggies.find(({ rarity }) => rarity === "common")!;
  await t.run((ctx) => ctx.db.insert("drops", { member, crate: `weekly:2026-10-12:${n}`, hoggie: hoggie.hoggie, rarity: hoggie.rarity, n, copy: 1, catalogueVersion: catalogue.version, at }));
}

function seen({ kind, at }: ActivityEntry) {
  return `${kind} at ${at}`;
}

function keyOf(entry: ActivityEntry) {
  return "key" in entry ? entry.key : `level ${entry.level}`;
}

function onOf(entry: ActivityEntry | undefined) {
  if (entry?.kind !== "starReceived" && entry?.kind !== "starGiven") throw new Error(`expected a star entry, got ${entry?.kind}`);
  return entry.on;
}
