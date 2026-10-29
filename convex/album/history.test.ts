import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { HugGivenEvent, KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const theWeek = "2026-10-12";
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const erin = { user: "U_ERIN", name: "Erin Castellanos" };
const frank = { user: "U_FRANK", name: "Frank Adeyemi" };
const gus = { user: "U_GUS", name: "Gus Halvorsen" };
const cast = [alice, bob, carol, dana, erin, frank, gus];
const why = "Thanks for untangling the flaky migration";
const longerWhy = "Thanks for untangling the flaky migration and writing up every step of the rollback";

type Person = { user: string; name: string };

const theAlbum = vi.hoisted(() => ({ tallying: true, held: [] as unknown[] }));

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  const heldWhileNotTallying = <E,>(subscriptions: unknown[]) =>
    subscriptions.map((subscription) => {
      if (typeof subscription === "object" && subscription !== null && "subscriber" in subscription) return subscription;
      const name = getFunctionName(subscription as never);
      if (name === "album/packs:grantThoughtfulPacks") return { subscriber: subscription, only: () => theAlbum.tallying };
      if (!name.startsWith("album/tallies")) return subscription;
      return {
        subscriber: subscription,
        only: (event: E) => {
          if (!theAlbum.tallying) theAlbum.held.push(event);
          return theAlbum.tallying;
        },
      };
    });
  actual.subscribers.kudosGiven = heldWhileNotTallying(actual.subscribers.kudosGiven) as typeof actual.subscribers.kudosGiven;
  actual.subscribers.hugGiven = heldWhileNotTallying(actual.subscribers.hugGiven) as typeof actual.subscribers.hugGiven;
  return actual;
});

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
let clock = tuesday.getTime();

beforeEach(async () => {
  await aFreshBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("people join the album only by giving", { timeout: 60_000 }, () => {
  test("a member who gave kudos before the history began finds those people in their album, and five people who only thanked them are not there", async () => {
    await beforeTheAlbum(async () => {
      await thanks(alice, why, bob);
      await thanks(alice, "ty", carol);
      for (const person of [dana, erin, frank, gus, bob]) await thanks(person, "ty", alice);
    });

    await runTheHistory();

    expect(await peopleOf(alice), "alice's album holds only the people she gave to").toEqual([bob.name, carol.name]);
    expect(await peopleOf(bob), "bob gave to alice").toEqual([alice.name]);
    expect(await peopleOf(carol), "carol only received").toEqual([]);
  });

  test("a thoughtful kudos given after the history began earns a pack, not a place in the album, and a second run changes nothing", async () => {
    await beforeTheAlbum(() => thanks(alice, "ty", bob));
    await runTheHistory();

    await thanks(alice, why, carol);
    await runTheHistory();

    expect(await peopleOf(alice)).toEqual([bob.name]);
    expect(await waitingPacksOf(alice)).toEqual([carol.name]);
  });

  test("a kudos given after the history began but before its page ran collects only through its pack", async () => {
    await beforeTheAlbum(async () => {
      await thanks(alice, "ty", bob);
      await thanks(carol, "ty", bob);
    });
    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });

    await post(t, [section(text(`${why} `), mention(carol.user), emoji("taco"))], { user: alice.user, ts: nextTs() });
    expect(await historyDone(), "the award exists before the history's first page").toBe(false);
    await settle(t);

    expect(await historyDone()).toBe(true);
    expect(await peopleOf(alice)).toEqual([bob.name]);
    expect(await waitingPacksOf(alice)).toEqual([carol.name]);
  });

  test("the history run twice over a pair a pack already put in records each pair once", async () => {
    await beforeTheAlbum(async () => {
      await thanks(alice, why, bob, carol);
      await thanks(alice, "Thanks again for pairing on the rollback", bob);
    });
    await anAlbumStickerAsPuttingInWillRecordIt(alice, bob);

    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    await t.mutation(internal.album.history.recordAlbumHistory, { workspace: "T1" });
    await settle(t);

    expect(await peopleOf(alice)).toEqual([bob.name, carol.name]);
  });

  test("the history pages a workspace's awards, 50 a mutation, within Convex's limits", async () => {
    const crowd = aCrowdOf(60);
    await beforeTheAlbum(() => thanks(alice, why, ...crowd));

    await runTheHistory();

    expect((await peopleOf(alice)).toSorted()).toEqual(crowd.map(({ name }) => name).toSorted());
  });
});

describe("AL40: getAlbum's people stay within Convex's limits", { timeout: 60_000 }, () => {
  test("a member holding 501 people sees the first 500 and morePeople", async () => {
    await thanks(alice, "ty", bob);
    const [member, crowd] = [await memberOf(alice), await Promise.all(Array.from({ length: 501 }, (_, index) => aMember(t, `U_HELD_${index}`)))];
    await t.run(async (ctx) => {
      for (const person of crowd) await ctx.db.insert("albumStickers", { member, person, from: "history", at: Date.now() });
    });

    const { people, morePeople } = await albumOf(alice);

    expect(people).toHaveLength(500);
    expect(morePeople).toBe(true);
  });
});

describe("the album's tallies count each award and hug once", { timeout: 120_000 }, () => {
  test("the history fills the pair and week tallies the live subscribers keep, from awards and hugs in both directions, and a second run changes nothing", async () => {
    await aWalkOfKudosAndHugs();
    const kept = await everyTally();

    await aFreshBackend();
    await beforeTheAlbum(aWalkOfKudosAndHugs);
    expect(nothingIn(await everyTally()), "nothing is tallied before the album").toBe(true);
    await runTheHistory();
    const filled = await everyTally();
    await runTheHistory();

    expect(filled).toEqual(kept);
    expect(await everyTally()).toEqual(kept);
  });

  test("a redelivered kudosGiven and hugGiven, and the history racing the live tallies, count each award and hug once", async () => {
    await aWalkOfKudosAndHugs();
    const kept = await everyTally();

    await aFreshBackend();
    const held = await heldTalliesOf(aWalkOfKudosAndHugs);
    for (const event of [...held, ...held.toReversed()]) await tally(event);
    await runTheHistory();
    await settle(t);

    expect(await everyTally()).toEqual(kept);
  });

  test("the history is done only once every hug's people are tallied, a hug on a kudos to 60 people included", async () => {
    const crowd = aCrowdOf(60);
    await beforeTheAlbum(async () => {
      const toTheCrowd = await thanks(alice, why, ...crowd);
      await hugs(dana, alice, toTheCrowd);
      await hugs(bob, alice, nextTs());
    });

    await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
    for (let page = 0; !(await historyDone()) && page < 20; page += 1) await t.mutation(internal.album.history.recordAlbumHistory, { workspace: "T1" });

    expect(await historyDone()).toBe(true);
    expect((await pairTally(dana, crowd[59]!))?.hugsGiven, "the hug's last person").toBe(1);
    expect((await weekTally(dana))?.hugged).toMatchObject({ more: 48 });
    expect((await pairTally(alice, bob))?.hugsReceived).toBe(1);
  });

  test("a message to 120 people is tallied in pages within Convex's limits", async () => {
    const crowd = aCrowdOf(120);

    await thanks(alice, why, ...crowd);

    const first = await pairTally(alice, crowd[0]!);
    const last = await pairTally(alice, crowd[119]!);
    expect([first?.kudosGiven, last?.kudosGiven, (await pairTally(crowd[119]!, alice))?.kudosReceived]).toEqual([1, 1, 1]);
    expect((await weekTally(alice))?.thanked).toMatchObject({ more: 108 });
  });
});

describe("AL46 AL48: the pair and week tallies", { timeout: 60_000 }, () => {
  test("HH6: a pair tally holds when you first thanked them, kudos and hugs both ways, and your best message: the kudos you gave them with the most words, a short one when it's all you gave, ties to the newest", async () => {
    const bobsShortThanks = await thanks(bob, "ty", alice);
    const firstThanks = clock + minuteMs;
    await thanks(alice, why, bob);
    const best = await thanks(alice, longerWhy, bob);
    const tiedButNewer = await thanks(alice, longerWhy, bob);
    await thanks(alice, "ty", bob);
    await hugs(alice, bob, nextTs());
    await hugs(bob, alice, nextTs());

    expect(best).not.toBe(tiedButNewer);
    expect(await pairTally(alice, bob)).toEqual({
      firstThankedAt: firstThanks,
      kudosGiven: 4,
      kudosReceived: 1,
      hugsGiven: 1,
      hugsReceived: 1,
      best: { message: aMessage(tiedButNewer), words: expect.any(Number), at: Number(tiedButNewer.split(".")[0]) * 1000 },
    });
    expect(await pairTally(bob, alice)).toMatchObject({ firstThankedAt: tuesday.getTime() + minuteMs, kudosGiven: 1, kudosReceived: 4, hugsGiven: 1, hugsReceived: 1, best: { message: aMessage(bobsShortThanks) } });
  });

  test("HH6: a week tally counts the week, its thoughtful awards from every kudos, keeps 12 people a list with the rest counted, picks the kudos of the week by hugs then words, and counts each day", async () => {
    const crowd = aCrowdOf(14);
    const wordy = await thanks(alice, longerWhy, ...crowd);
    const hugged = await thanks(alice, why, bob);
    await thanks(carol, "ty", alice);
    await hugs(dana, alice, hugged);
    laterBy(dayMs);
    await hugs(erin, alice, nextTs());

    expect(await weekTally(alice)).toEqual({
      kudosGiven: 15,
      kudosReceived: 1,
      thoughtfulGiven: 15,
      thoughtfulReceived: 1,
      hugsGiven: 0,
      hugsReceived: 1,
      thanked: { people: expect.any(Array), more: 3 },
      thankedBy: { people: [await memberOf(carol)], more: 0 },
      hugged: { people: [], more: 0 },
      huggedBy: { people: [await memberOf(erin)], more: 0 },
      kudosOfWeek: { message: aMessage(hugged), hugs: 1, words: expect.any(Number), at: expect.any(Number) },
      days: [0, 16, 1, 0, 0, 0, 0],
    });
    expect((await weekTally(alice))?.thanked.people).toHaveLength(12);
    expect((await weekTally(crowd[0]!))?.kudosOfWeek?.message).toEqual(aMessage(wordy));
    expect((await weekTally(bob))?.kudosOfWeek?.message).toEqual(aMessage(hugged));
    expect(await weekTally(dana)).toMatchObject({ hugsGiven: 1, hugged: { people: [await memberOf(bob)], more: 0 }, days: [0, 1, 0, 0, 0, 0, 0] });
  });
});

async function aFreshBackend() {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  messages = 0;
  clock = tuesday.getTime();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of cast) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  theAlbum.tallying = true;
  theAlbum.held = [];
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 500, hugBudget: 50 }));
  await switchWebsite(t, postHog, true, "album", "hugs");
}

async function aWalkOfKudosAndHugs() {
  clock = tuesday.getTime();
  const first = await thanks(alice, why, bob, carol);
  await thanks(bob, "ty", alice);
  await thanks(dana, longerWhy, alice, bob);
  await hugs(dana, alice, first);
  await hugs(bob, alice, nextTs());
  laterBy(7 * dayMs);
  const nextWeek = await thanks(alice, longerWhy, bob);
  await hugs(dana, alice, nextWeek);
  await hugs(alice, dana, nextTs());
}

function aCrowdOf(size: number): Person[] {
  const crowd = Array.from({ length: size }, (_, index) => ({ user: `U_CROWD_${index}`, name: `Crowd Person ${index}` }));
  for (const person of crowd) slack.withMember(person.user, { real_name: person.name });
  return crowd;
}

function laterBy(ms: number) {
  clock += ms;
  vi.setSystemTime(Math.max(Date.now(), clock));
}

function nextTs() {
  messages += 1;
  laterBy(minuteMs);
  return `${clock / 1000}.${String(messages).padStart(6, "0")}`;
}

function aMessage(ts: string) {
  return { workspace: "T1", conversation: "C1", message: ts };
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function hugs(giver: Person, author: Person, ts: string) {
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${nextTs()}` });
  await settle(t);
}

async function beforeTheAlbum(walk: () => Promise<unknown>) {
  await heldTalliesOf(walk);
}

async function heldTalliesOf(walk: () => Promise<unknown>): Promise<Array<KudosGivenEvent | HugGivenEvent>> {
  theAlbum.tallying = false;
  await walk();
  theAlbum.tallying = true;
  return theAlbum.held.splice(0) as Array<KudosGivenEvent | HugGivenEvent>;
}

async function tally(event: KudosGivenEvent | HugGivenEvent) {
  if (event.type === "kudosGiven") await t.mutation(internal.album.tallies.tallyKudosGiven, { event });
  else await t.mutation(internal.album.tallies.tallyHugGiven, { event });
  await settle(t);
}

async function historyDone() {
  return (await t.query(internal.album.history.albumHistoryOf, { workspace: "T1" }))?.done === true;
}

async function runTheHistory() {
  await t.mutation(internal.album.history.startAlbumHistory, { workspace: "T1" });
  await settle(t);
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function memberOf(person: Person): Promise<MemberId> {
  return (await memberOrNullOf(person))!;
}

async function memberOrNullOf(person: Person): Promise<MemberId | null> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row?._id ?? null;
}

async function albumOf(person: Person) {
  const album = await (await signedIn(person)).query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album;
}

async function peopleOf(person: Person) {
  const { people } = await albumOf(person);
  expect(people.every(({ held }) => held)).toBe(true);
  return people.map(({ name }) => name).toSorted();
}

async function waitingPacksOf(person: Person) {
  const { packs } = await albumOf(person);
  const names = new Map<string, string>();
  for (const someone of cast) names.set((await memberOrNullOf(someone)) ?? someone.user, someone.name);
  return packs.map(({ person: packed }) => names.get(packed) ?? packed);
}

async function anAlbumStickerAsPuttingInWillRecordIt(member: Person, person: Person) {
  const [memberId, personId] = [await memberOf(member), await memberOf(person)];
  await t.run((ctx) => ctx.db.insert("albumStickers", { member: memberId, person: personId, from: "pack", at: Date.now() }));
}

async function pairTally(member: Person, person: Person) {
  return t.query(internal.album.tallies.pairTallyOf, { member: await memberOf(member), person: await memberOf(person) });
}

async function weekTally(member: Person, week = theWeek) {
  return t.query(internal.album.tallies.weekTallyOf, { member: await memberOf(member), week });
}

async function everyTally() {
  const named = new Map<string, string>();
  for (const someone of cast) {
    const id = await memberOrNullOf(someone);
    if (id !== null) named.set(id, someone.name);
  }
  const withNames = (value: unknown) => JSON.parse([...named].reduce((json, [id, name]) => json.replaceAll(`"${id}"`, `"${name}"`), JSON.stringify(value ?? null)));
  const pairs: Record<string, unknown> = {};
  const weeks: Record<string, unknown> = {};
  for (const member of cast.slice(0, 4)) {
    if ((await memberOrNullOf(member)) === null) continue;
    for (const person of cast.slice(0, 4)) if (person !== member && (await memberOrNullOf(person)) !== null) pairs[`${member.name} with ${person.name}`] = withNames(await pairTally(member, person));
    for (const week of [theWeek, "2026-10-19"]) weeks[`${member.name} in ${week}`] = withNames(await weekTally(member, week));
  }
  return { pairs, weeks };
}

function nothingIn({ pairs, weeks }: { pairs: Record<string, unknown>; weeks: Record<string, unknown> }) {
  return [...Object.values(pairs), ...Object.values(weeks)].every((tally) => tally === null);
}
