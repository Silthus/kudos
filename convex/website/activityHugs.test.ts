import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text, type ReactionOptions } from "../../testing/slackMessages";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
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
const erin = { user: "U_ERIN", name: "Erin Ellis" };
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

function hugsOn(on = true, ...flags: string[]) {
  return switchWebsite(t, postHog, true, ...(flags.length > 0 ? flags : timeline), ...(on ? ["hugs"] : []));
}

function slackMember(person: Someone): Someone {
  slack.withMember(person.user, { real_name: person.name, tz: "Europe/Berlin" });
  return person;
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

async function hug(giver: Someone, author: Someone, options: ReactionOptions = {}) {
  const eventTs = `${Math.floor(Date.now() / 1000)}.000200`;
  await react(t, { user: giver.user, itemUser: author.user, ts: postedTs, eventTs, ...options });
  await settle(t);
  return Number(eventTs) * 1000;
}

describe("SR11: a hug on the activity timeline", () => {
  test("a hug on a teammate's message answers hugReceived to its author and hugGiven to its giver, with no words", async () => {
    await hugsOn();
    await kudos(carol, [dana], "1791971000.000200", "C2");
    vi.advanceTimersByTime(minute);

    const at = await hug(bob, alice);

    const received = await activityOf(await signedIn(alice), { filter: "all" });
    const given = await activityOf(await signedIn(bob), { filter: "all" });
    expect(received.entries).toEqual([{ kind: "hugReceived", key: expect.any(String), at, givers: [personOf(bob)], emoji: "taco", hugs: 1, xp: 1, on: expect.any(String), permalink, kudos: null }]);
    expect(given.entries).toEqual([{ kind: "hugGiven", key: expect.any(String), at, people: [personOf(alice)], emoji: "taco", xp: 1, on: expect.any(String), permalink, kudos: null }]);
    expect(onOf(received.entries[0])).toBe(onOf(given.entries[0]));
  });

  test("a hug on a Given kudos message answers each recipient and the giver with the kudos' words, one on key for all", async () => {
    await hugsOn();
    await kudos(alice, [bob, carol]);
    vi.advanceTimersByTime(minute);

    const at = await hug(dana, alice);

    const [asAlice, asBob, asCarol, asDana] = await Promise.all([signedIn(alice), signedIn(bob), signedIn(carol), signedIn(dana)]);
    const words = (await activityOf(asAlice, { filter: "given" })).entries.map((entry) => (entry.kind === "kudosGiven" ? entry.message : null))[0];
    const hugOf = async (caller: Caller) => (await activityOf(caller, { filter: "all" })).entries.filter(({ kind }) => kind === "hugReceived" || kind === "hugGiven");
    const [forBob, forCarol, byDana] = await Promise.all([hugOf(asBob), hugOf(asCarol), hugOf(asDana)]);
    const received = { kind: "hugReceived", key: expect.any(String), at, givers: [personOf(dana)], emoji: "taco", hugs: 1, xp: 1, on: expect.any(String), permalink, kudos: words };
    expect(words).toMatchObject({ kind: "text", segments: expect.arrayContaining([{ kind: "text", text: `thanks ${reason} ` }]) });
    expect(forBob).toEqual([received]);
    expect(forCarol).toEqual([received]);
    expect(byDana).toEqual([{ kind: "hugGiven", key: expect.any(String), at, people: [personOf(bob), personOf(carol)], emoji: "taco", xp: 1, on: expect.any(String), permalink, kudos: words }]);
    expect(new Set([...forBob, ...forCarol, ...byDana].map(onOf)).size).toBe(1);
    expect((await activityOf(asAlice, { filter: "all" })).entries.map(({ kind }) => kind)).not.toContain("hugReceived");
  });

  test("hugs received on one message fold into one row: who reacted newest first, the newest emoji, its hugs and their XP, at its newest hug", async () => {
    await hugsOn();
    await kudos(carol, [dana], "1791971000.000200", "C2");
    vi.advanceTimersByTime(minute);
    await hug(bob, alice);
    vi.advanceTimersByTime(minute);
    const newest = await hug(carol, alice, { reaction: "taco::skin-tone-3" });
    vi.advanceTimersByTime(minute);
    const other = await hug(bob, alice, { ts: "1791971060.000100" });

    const { entries } = await activityOf(await signedIn(alice), { filter: "all" });
    const given = (await activityOf(await signedIn(bob), { filter: "all" })).entries;

    expect(entries).toEqual([
      { kind: "hugReceived", key: expect.any(String), at: other, givers: [personOf(bob)], emoji: "taco", hugs: 1, xp: 1, on: "C1/1791971060.000100", permalink: "https://kudos-test.slack.com/archives/C1/p1791971060000100", kudos: null },
      { kind: "hugReceived", key: expect.any(String), at: newest, givers: [personOf(carol), personOf(bob)], emoji: "taco::skin-tone-3", hugs: 2, xp: 2, on: `C1/${postedTs}`, permalink, kudos: null },
    ]);
    expect(new Set(entries.map(keyOf)).size).toBe(2);
    expect(given.map(({ kind }) => kind)).toEqual(["hugGiven", "hugGiven"]);
  });

  test("a new hug moves its message's row to the top under the same key, and paging from a cursor returns every row once, a row that moved since the first page at its place then", async () => {
    await hugsOn();
    const messages = ["1791970700.000100", "1791970800.000100", "1791970900.000100", "1791971000.000100"];
    const firstHugs: number[] = [];
    for (const ts of messages) {
      firstHugs.push(await hug(bob, alice, { ts }));
      vi.advanceTimersByTime(minute);
    }
    const asAlice = await signedIn(alice);
    const onsOf = (entries: ActivityEntry[]) => entries.map(onOf);
    const [m1, m2, m3, m4] = messages.map((ts) => `C1/${ts}`);

    const first = await activityOf(asAlice, { filter: "all", limit: 1 });
    await hug(carol, alice, { ts: messages[0] });
    vi.advanceTimersByTime(minute);
    const second = await activityOf(asAlice, { filter: "all", limit: 1, cursor: first.cursor });
    await hug(dana, alice, { ts: messages[2] });
    vi.advanceTimersByTime(minute);
    const rest = await activityOf(asAlice, { filter: "all", limit: 10, cursor: second.cursor });
    const fresh = await activityOf(asAlice, { filter: "all", limit: 10 });

    expect([first, second, rest].map(({ entries }) => onsOf(entries))).toEqual([[m4], [m3], [m2, m1]]);
    expect(rest.entries.map(({ at }) => at)).toEqual([firstHugs[1], firstHugs[0]]);
    expect(rest.cursor).toBeNull();
    expect(onsOf(fresh.entries)).toEqual([m3, m1, m4, m2]);
    expect(fresh.entries.map((entry) => (entry.kind === "hugReceived" ? entry.hugs : 0))).toEqual([2, 2, 1, 1]);
    expect(keyOf(fresh.entries[0]!)).toBe(keyOf(second.entries[0]!));
  });

  test("a hug decided after newer entries answers first on the newest page of its giver and its author, at its reaction's time", async () => {
    await hugsOn();
    const reactedTs = `${Math.floor(Date.now() / 1000)}.000200`;
    vi.advanceTimersByTime(10 * minute);
    await kudos(carol, [alice, bob], `${Math.floor(Date.now() / 1000)}.000300`);
    vi.advanceTimersByTime(minute);

    await react(t, { user: bob.user, itemUser: alice.user, ts: postedTs, eventTs: reactedTs });
    await settle(t);

    const reactedAt = Number(reactedTs) * 1000;
    expect((await activityOf(await signedIn(alice), { filter: "all", limit: 1 })).entries.map(seen)).toEqual([`hugReceived at ${reactedAt}`]);
    expect((await activityOf(await signedIn(bob), { filter: "all", limit: 1 })).entries.map(seen)).toEqual([`hugGiven at ${reactedAt}`]);
  });

  test("a hug reacted before the first page but paid after the cursor passed its new place leaves its message's row where the first page found it, so a later page returns it once", async () => {
    await hugsOn();
    const messages = ["1791970700.000100", "1791970800.000100", "1791970900.000100"];
    const firstHugs: number[] = [];
    for (const ts of messages) {
      firstHugs.push(await hug(bob, alice, { ts }));
      vi.advanceTimersByTime(minute);
    }
    const asAlice = await signedIn(alice);
    const reactedBetween = Math.floor(firstHugs[1]! / 1000) + 30;
    await react(t, { user: carol.user, itemUser: alice.user, ts: messages[0], eventTs: `${reactedBetween}.000200` });

    const first = await activityOf(asAlice, { filter: "all", limit: 1 });
    const second = await activityOf(asAlice, { filter: "all", limit: 1, cursor: first.cursor });
    await settle(t);
    const rest = await activityOf(asAlice, { filter: "all", limit: 10, cursor: second.cursor });

    expect([first, second, rest].map(({ entries }) => entries.map(onOf))).toEqual([[`C1/${messages[2]}`], [`C1/${messages[1]}`], [`C1/${messages[0]}`]]);
    expect(rest.entries.map(({ at }) => at)).toEqual([firstHugs[0]]);
    expect((await activityOf(asAlice, { filter: "all", limit: 10 })).entries.map(onOf)).toEqual([`C1/${messages[2]}`, `C1/${messages[0]}`, `C1/${messages[1]}`]);
  });

  test("a cursor carries no hugs snapshot once hugs is off for the viewer, as main's cursors don't", async () => {
    await hugsOn();
    await kudos(bob, [alice], "1791970600.000100");
    vi.advanceTimersByTime(minute);
    await kudos(carol, [alice], "1791970650.000100");
    vi.advanceTimersByTime(minute);
    await hug(bob, alice);
    const asAlice = await signedIn(alice);
    const mainsCursor = /^-?\d+(?:\.\d+)?_[0-5]_\d+(?:\.\d+)?$/;

    const on = await activityOf(asAlice, { filter: "all", limit: 1 });
    await hugsOn(false);
    const off = await activityOf(asAlice, { filter: "all", limit: 1, cursor: on.cursor });

    expect(on.cursor).not.toMatch(mainsCursor);
    expect(off.cursor).toMatch(mainsCursor);
  });

  test("a cursor from a page read while hugs was hidden gains a snapshot once hugs shows, so a later move skips nothing", async () => {
    await hugsOn();
    await kudos(bob, [alice], "1791970600.000100");
    vi.advanceTimersByTime(minute);
    const messages = ["1791970700.000100", "1791970800.000100"];
    for (const ts of messages) {
      await hug(bob, alice, { ts });
      vi.advanceTimersByTime(minute);
    }
    await kudos(carol, [alice], `${Math.floor(Date.now() / 1000)}.000300`);
    vi.advanceTimersByTime(minute);
    const asAlice = await signedIn(alice);

    await hugsOn(false);
    const hidden = await activityOf(asAlice, { filter: "all", limit: 1 });
    await hugsOn();
    const shown = await activityOf(asAlice, { filter: "all", limit: 1, cursor: hidden.cursor });
    await hug(carol, alice, { ts: messages[0] });
    const rest = await activityOf(asAlice, { filter: "all", limit: 10, cursor: shown.cursor });

    expect([hidden, shown, rest].map(({ entries }) => entries.map(({ kind }) => kind))).toEqual([["kudosReceived"], ["hugReceived"], ["hugReceived", "kudosReceived"]]);
    expect([...shown.entries, ...rest.entries].flatMap((entry) => (entry.kind === "hugReceived" ? [entry.on] : []))).toEqual([`C1/${messages[1]}`, `C1/${messages[0]}`]);
  });

  test("a hugReceived row names only teammates whose hug paid its member", async () => {
    await hugsOn();
    await kudos(alice, [bob, carol]);
    vi.advanceTimersByTime(minute);
    await hug(dana, alice);
    await memberChanged(t, "user_change", { id: bob.user, team_id: "T1", deleted: true });
    await settle(t);
    vi.advanceTimersByTime(minute);
    await hug(slackMember(erin), alice);
    await memberChanged(t, "user_change", { id: bob.user, team_id: "T1", real_name: bob.name, tz: "Europe/Berlin" });
    await settle(t);

    const hugsOf = async (person: Someone) => (await activityOf(await signedIn(person), { filter: "all" })).entries.flatMap((entry) => (entry.kind === "hugReceived" ? [{ givers: entry.givers.map(({ name }) => name), hugs: entry.hugs }] : []));

    expect(await hugsOf(bob)).toEqual([{ givers: [dana.name], hugs: 1 }]);
    expect(await hugsOf(carol)).toEqual([{ givers: [erin.name, dana.name], hugs: 2 }]);
  });

  test("a hug reacted with a custom emoji Slack lists carries its image on both rows, a skin tone included, and none once Slack no longer lists it", async () => {
    await hugsOn();
    const tacoPng = "https://emoji.slack-edge.com/T1/taco/7a8b9c.png";
    slack.withCustomEmoji("taco", tacoPng);
    await syncCustomEmoji();
    await kudos(carol, [dana], "1791971000.000200", "C2");
    vi.advanceTimersByTime(minute);
    await hug(bob, alice, { reaction: "taco::skin-tone-2" });
    const [asAlice, asBob] = await Promise.all([signedIn(alice), signedIn(bob)]);
    const emojiOf = async (caller: Caller) => (await activityOf(caller, { filter: "all" })).entries.map((entry) => (entry.kind === "hugReceived" || entry.kind === "hugGiven" ? { kind: entry.kind, emoji: entry.emoji, emojiImage: entry.emojiImage } : entry.kind));

    expect([...(await emojiOf(asAlice)), ...(await emojiOf(asBob))]).toEqual([
      { kind: "hugReceived", emoji: "taco::skin-tone-2", emojiImage: tacoPng },
      { kind: "hugGiven", emoji: "taco::skin-tone-2", emojiImage: tacoPng },
    ]);

    slack.withoutCustomEmoji("taco");
    await syncCustomEmoji();
    const unlisted = [...(await activityOf(asAlice, { filter: "all" })).entries, ...(await activityOf(asBob, { filter: "all" })).entries];
    expect(unlisted.map(({ kind }) => kind)).toEqual(["hugReceived", "hugGiven"]);
    for (const entry of unlisted) expect(entry).not.toHaveProperty("emojiImage");
  });

  test("xp is null while XP doesn't show to the viewer", async () => {
    await hugsOn(true, "activity");

    await hug(bob, alice);

    const [received] = (await activityOf(await signedIn(alice), { filter: "all" })).entries;
    const [given] = (await activityOf(await signedIn(bob), { filter: "all" })).entries;
    expect([received, given]).toMatchObject([
      { kind: "hugReceived", xp: null },
      { kind: "hugGiven", xp: null },
    ]);
  });
});

describe("SR11: hugs stay out of the views that aren't the full timeline", () => {
  test("with hugs off for the viewer, every page equals the timeline without hugs, even when they received and gave hugs", async () => {
    await hugsOn(false);
    await kudos(alice, [bob]);
    vi.advanceTimersByTime(minute);
    await kudos(carol, [alice], "1791971180.000100");
    const [asAlice, asBob] = await Promise.all([signedIn(alice), signedIn(bob)]);
    const pagesOf = () => Promise.all([asAlice, asBob].flatMap((caller) => [1, 2, 20].flatMap((limit) => (["all", "received", "given"] as const).map((filter) => everyAnswer(caller, filter, limit)))));
    const withoutHugs = await pagesOf();

    await hugsOn();
    await hug(bob, alice);
    await hug(alice, carol, { ts: "1791971060.000100" });
    await hug(dana, alice, { ts: "1791971120.000100" });
    await hugsOn(false);

    expect(await pagesOf()).toEqual(withoutHugs);
    expect(withoutHugs[0]!.flatMap(({ entries }) => entries).map(({ kind }) => kind)).toEqual(["kudosReceived", "kudosGiven"]);
  });

  test("the received and given filters and the recent kudos answer the same with and without hugs", async () => {
    await hugsOn();
    await kudos(alice, [bob]);
    vi.advanceTimersByTime(minute);
    const asBob = await signedIn(bob);
    const asAlice = await signedIn(alice);
    const viewsOf = () =>
      Promise.all([asAlice, asBob].flatMap((caller) => [...(["received", "given"] as const).map((filter) => everyAnswer(caller, filter, 1)), ...(["received", "given"] as const).map((direction) => caller.query(api.website.activity.getRecentKudos, { direction }))]));
    const before = await viewsOf();

    await hug(carol, alice);
    await hug(alice, bob, { ts: "1791971060.000100" });
    await hug(bob, alice, { ts: "1791971120.000100" });

    expect(await viewsOf()).toEqual(before);
    expect((await everyPage(asBob, "all", 20)).map(({ kind }) => kind).sort()).toEqual(["hugGiven", "hugReceived", "hugReceived", "kudosReceived"]);
  });
});

describe("SR11: the page's recipients bound leaves a page without hug people as it was", () => {
  test.each([false, true])("with hugs %s, a received kudos newer than a message given to 800 people, and one older, share one page", { timeout: 120_000 }, async (on) => {
    await hugsOn(on, "activity");
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

describe("SR11: hug entries in order and pages", () => {
  const morning = Date.parse("2026-10-14T08:00:00Z");
  const noon = Date.parse("2026-10-14T12:00:00Z");
  const evening = Date.parse("2026-10-14T18:00:00Z");

  async function aDayOfEverything() {
    const [me, teammate, other] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob), aMemberNamed(carol)]);
    await aHugGiven(me, teammate, "2.1", evening);
    await aKudos(teammate, me, "1.1", evening);
    await aHugReceived(teammate, me, "2.2", noon);
    await aLevelUp(me, 2, noon);
    await aHugGiven(me, other, "2.3", noon);
    await aKudos(me, teammate, "1.2", noon);
    await aDrop(me, noon, 1);
    await aHugReceived(other, me, "2.4", noon);
    await aKudos(teammate, me, "1.3", noon);
    await aHugReceived(other, me, "2.5", morning);
    await aKudos(me, teammate, "1.4", morning);
    return signedIn(alice);
  }

  const newestFirst = [
    `kudosReceived at ${evening}`,
    `hugGiven at ${evening}`,
    `levelUp at ${noon}`,
    `kudosGiven at ${noon}`,
    `kudosReceived at ${noon}`,
    `found at ${noon}`,
    `hugGiven at ${noon}`,
    `hugReceived at ${noon}`,
    `hugReceived at ${noon}`,
    `kudosGiven at ${morning}`,
    `hugReceived at ${morning}`,
  ];

  test("sit in time order, below the kudos, level-up and found entries of their instant", async () => {
    await hugsOn();
    const asAlice = await aDayOfEverything();

    const { entries, cursor } = await activityOf(asAlice, { filter: "all" });

    expect(entries.map(seen)).toEqual(newestFirst);
    expect(cursor).toBeNull();
  });

  test("page across every cursor, repeating and skipping none, each with its own key", async () => {
    await hugsOn();
    const asAlice = await aDayOfEverything();

    for (const limit of [1, 2, 3, 4]) {
      const entries = await everyPage(asAlice, "all", limit);
      expect(entries.map(seen)).toEqual(newestFirst);
      expect(new Set(entries.map(keyOf))).toHaveProperty("size", newestFirst.length);
    }
  });

  test("a cursor from a page without hugs still reads once hugs are on", async () => {
    await hugsOn(false);
    const asAlice = await aDayOfEverything();
    const { cursor } = await activityOf(asAlice, { filter: "all", limit: 2 });

    await hugsOn();
    const { entries } = await activityOf(asAlice, { filter: "all", cursor, limit: 20 });

    expect(entries.map(seen)).toEqual(newestFirst.slice(newestFirst.indexOf(`levelUp at ${noon}`) + 1));
  });

  test("a cursor in the form main wrote before hugs reads the same position once hugs are on", async () => {
    await hugsOn();
    const asAlice = await aDayOfEverything();
    const writtenByMainBeforeHugs = "1791979200000_1_9999999999999";

    const { entries } = await activityOf(asAlice, { filter: "all", cursor: writtenByMainBeforeHugs, limit: 20 });

    expect(entries.map(seen)).toEqual(newestFirst.slice(newestFirst.indexOf(`kudosGiven at ${noon}`)));
  });
});

describe("SR11 SR24: a page of hugs stays within Convex's limits", () => {
  test("25 kudos given and 25 hugs given on kudos messages, each to 28 people with words that mention 40, share a page's recipients and stay within Convex's limits, skipping and repeating none", { timeout: 180_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await hugsOn(true, "activity", "xp-levels", "unlocks", "skill-tree");
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
          if (conversation === "C2") await ctx.db.insert("hugs", { workspace: "T1", conversation, message, giver: me, onKudos: true, emoji: "taco", at: when, day: "2026-10-14" });
        }
      }
    });

    const answers = await everyAnswer(await signedIn(alice), "all", 50);
    const entries = answers.flatMap((answer) => answer.entries);

    expect(answers.map((answer) => answer.entries.length)).toEqual([25, 25]);
    expect(entries.map(({ kind, at }) => `${kind} ${at - now.getTime()}`)).toEqual(Array.from({ length: 50 }, (_, index) => `${index % 2 === 0 ? "kudosGiven" : "hugGiven"} ${49 - index}`));
    expect(entries.map((entry) => (entry.kind === "kudosGiven" ? entry.recipients.length : entry.kind === "hugGiven" ? entry.people.length : 0))).toEqual(Array(50).fill(28));
  });

  test("a page of fifty hugs received, and fifty given, each on a kudos message whose words mention forty people, stays within Convex's limits", { timeout: 120_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await hugsOn(true, "activity", "xp-levels");
    const at = now.getTime();
    const [me, teammate] = await Promise.all([aMemberNamed(alice), aMemberNamed(bob)]);
    await t.run(async (ctx) => {
      for (let index = 0; index < 51; index++) {
        const message = `1760350${String(index).padStart(3, "0")}.000100`;
        const segments = Array.from({ length: 40 }, (_, mentioned) => ({ kind: "person" as const, user: `U_MENTIONED_${index}_${mentioned}` }));
        await ctx.db.insert("kudosTexts", { workspace: "T1", conversation: "C1", message, kind: "words", revision: 1n, author: bob.user, edited: false, segments, visibility: "public", gate: null });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver: teammate, recipient: me, kudos: 1, day: "2026-10-14", at: at - 1 });
        const received = await ctx.db.insert("hugs", { workspace: "T1", conversation: "C1", message, giver: teammate, onKudos: true, emoji: "taco", at: at + index, day: "2026-10-14" });
        await ctx.db.insert("hugPeople", { hug: received, member: me, at: at + index });
        await ctx.db.insert("hugsReceived", { member: me, workspace: "T1", conversation: "C1", message, onKudos: true, hugs: 1, emoji: "taco", at: at + index, givers: [{ giver: teammate, at: at + index }] });
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C2", message, giver: teammate, recipient: teammate, kudos: 1, day: "2026-10-14", at: at - 1 });
        await ctx.db.insert("hugs", { workspace: "T1", conversation: "C2", message, giver: me, onKudos: true, emoji: "taco", at: at + index, day: "2026-10-14" });
      }
    });

    const first = await activityOf(await signedIn(alice), { filter: "all", limit: 50 });
    const next = await activityOf(await signedIn(alice), { filter: "all", limit: 50, cursor: first.cursor });

    expect(first.entries.map(({ kind }) => kind)).toEqual(Array.from({ length: 25 }, () => ["hugGiven", "hugReceived"]).flat());
    expect(next.entries).toHaveLength(50);
  });
});

function aMemberNamed({ user, name }: Someone): Promise<MemberId> {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, name, kind: "member", asOf: 0 }));
}

async function aKudos(giver: MemberId, recipient: MemberId, message: string, at: number) {
  await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message, giver, recipient, kudos: 1, day: "2026-10-14", at }));
}

async function aHugGiven(giver: MemberId, author: MemberId, message: string, at: number) {
  await t.run((ctx) => ctx.db.insert("hugs", { workspace: "T1", conversation: "C1", message, giver, onKudos: false, author, emoji: "taco", at, day: "2026-10-14" }));
}

async function aHugReceived(giver: MemberId, author: MemberId, message: string, at: number) {
  await t.run(async (ctx) => {
    const hug = await ctx.db.insert("hugs", { workspace: "T1", conversation: "C1", message, giver, onKudos: false, author, emoji: "taco", at, day: "2026-10-14" });
    await ctx.db.insert("hugPeople", { hug, member: author, at });
    await ctx.db.insert("hugsReceived", { member: author, workspace: "T1", conversation: "C1", message, onKudos: false, hugs: 1, emoji: "taco", at, givers: [{ giver, at }] });
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
  if (entry?.kind !== "hugReceived" && entry?.kind !== "hugGiven") throw new Error(`expected a hug entry, got ${entry?.kind}`);
  return entry.on;
}

async function syncCustomEmoji() {
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}
