import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import type { Infer } from "convex/values";
import { api, internal } from "../_generated/api";
import type { kudosGivenEventValidator } from "../bus/events";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "./album";
import type { ArrivalAnswer } from "./lastVisit";
import type { Denial } from "./memberQuery";
import type { XpMoment, XpMomentAnswer, XpMomentEndReply } from "./xpMoment";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs", "xp-levels", "unlocks", "hugs"];
const everyFlagOfTheMoment = [...albumOpen, "hidden-items", "xp-moments"];

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;

const alice = person("Alice", "Marchetti");
const bob = person("Bob", "Okonkwo");
const carol = person("Carol", "Lindqvist");
const everyone = [alice, bob, carol];

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { real_name: name, profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...everyFlagOfTheMoment);
  for (const { user, name } of everyone) await memberChanged(t, "team_join", { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } });
  await settle(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP27 LP28: getXpMoment plays what happened since the last visit", { timeout: 60_000 }, () => {
  test("answers none with the last visit to arrive from before the member's first last visit and when nothing was decided since it", async () => {
    const asAlice = await signedIn(alice);
    await thanks(bob, alice);

    expect(await momentOf(asAlice)).toEqual({ kind: "none", lastVisit: null });
    const arrived = await arrive(asAlice, null);
    expect(await momentOf(asAlice)).toEqual({ kind: "none", lastVisit: (arrived as { lastVisit: number }).lastVisit });
  });

  test("a busy return answers each kind since the last visit oldest first with its XP, the climb from the standing before the moment's XP to now, and the waiting items", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    await thanks(alice, carol);
    await hug(bob, alice, aMessageNow());
    await hug(alice, carol, aMessageNow());

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, xp])).toEqual([
      ["kudosReceived", 5],
      ["kudosGiven", 10],
      ["levelUp", 0],
      ["hugReceived", 1],
      ["hugGiven", 1],
    ]);
    expect(moment.fold).toBeNull();
    expect(moment.moments).toBe(4);
    expect([moment.climb.from.level, moment.climb.to.level]).toEqual([1, 2]);
    expect(moment.xp).toBe(17);
    const { level, board } = await albumOf(asAlice);
    expect(moment.climb.to).toEqual(level);
    expect(moment.climb.to.xp - moment.climb.from.xp).toBe(17);
    expect(moment.waiting).toBe(board!.items.length);
    expect(moment.excerpts[0]!.entry).toMatchObject({ kind: "kudosReceived", giver: { name: bob.name } });
  });

  test("past five, the newest five show oldest first and the rest fold into one line with their XP", async () => {
    const asAlice = await aReturningMember(alice);
    const received: number[] = [];
    for (let kudos = 0; kudos < 7; kudos += 1) received.push((await thanks(kudos % 2 === 0 ? bob : carol, alice)).at);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["levelUp", "kudosReceived", "kudosReceived", "kudosReceived", "kudosReceived"]);
    expect(moment.excerpts.slice(1).map(({ entry }) => entry.at)).toEqual(received.slice(3));
    expect(moment.fold).toEqual({ count: 3, xp: 15 });
    expect(moment.moments).toBe(7);
    expect(moment.xp).toBe(35);
  });

  test("a level crossed is always among the excerpts, however many newer kudos came in", async () => {
    const asCarol = await aReturningMember(carol);
    await thanks(carol, alice, bob);
    for (let kudos = 0; kudos < 6; kudos += 1) await thanks(kudos % 2 === 0 ? bob : alice, carol);

    const moment = await theMomentOf(asCarol);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["levelUp", "kudosReceived", "kudosReceived", "kudosReceived", "kudosReceived"]);
    expect(moment.excerpts[0]!.entry).toMatchObject({ kind: "levelUp", level: 2 });
    expect(moment.fold).toEqual({ count: 3, xp: 30 });
    expect(moment.climb.from.level).toBe(1);
    expect(moment.climb.to.level).toBe(2);
  });

  test("hugs on the member's message count only those since the last visit", async () => {
    const message = aMessageNow();
    await hug(bob, alice, message);
    const asAlice = await signedIn(alice);
    await arrive(asAlice, null);
    later();
    await hug(carol, alice, message);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry, xp }) => [entry.kind, "hugs" in entry ? entry.hugs : null, xp])).toEqual([["hugReceived", 1, 1]]);
  });

  test("a kudos whose XP progression hasn't recorded yet waits out of the moment, with everything after it, and plays with its XP once recorded", async () => {
    const asAlice = await aReturningMember(alice);
    const recorded = await thanks(bob, alice);
    const held = await thanksWhileItsXpWaits(carol, alice);
    const after = await thanks(bob, alice);

    const moment = await theMomentOf(asAlice);
    expect(moment.excerpts.map(({ entry }) => entry.at), "the moment while the XP waits").toEqual([recorded.at]);
    await endOf(asAlice, moment);
    await held.record();

    const next = await theMomentOf(asAlice);
    expect(next.excerpts.filter(({ entry }) => entry.kind === "kudosReceived").map(({ entry, xp }) => [entry.at, xp]), "the next moment").toEqual([
      [held.at, 5],
      [after.at, 5],
    ]);
  });

  test("a kudos whose XP progression never records stops holding the moment ten minutes after it was decided", async () => {
    const asAlice = await aReturningMember(alice);
    const held = await thanksWhileItsXpWaits(carol, alice);
    expect(await momentOf(asAlice), "while the XP waits").toMatchObject({ kind: "none" });

    vi.setSystemTime(Date.now() + 10 * minuteMs);

    expect((await theMomentOf(asAlice)).excerpts.map(({ entry }) => entry.at), "ten minutes on").toEqual([held.at]);
  });

  test("LP40 LP41: the moment carries this week's thoughtful givers where xp-moments is on, with teasers off, and none below three", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(alice, bob);
    expect((await theMomentOf(asAlice)).thoughtfulGivers).toBeNull();

    await thanks(carol, bob);

    expect((await theMomentOf(asAlice)).thoughtfulGivers).toBe(3);
  });

  test("with xp-moments off, getXpMoment answers off and the arrival moves the last visit as it did before", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    await thanks(bob, alice);
    const receivedAt = await newestKudosDecidedFor(alice);
    const asAlice = await signedIn(alice);
    await thanks(alice, carol);

    expect(await momentOf(asAlice)).toEqual({ kind: "off" });
    expect(await arrive(asAlice, null)).toEqual({ kind: "arrived", lastVisit: receivedAt });
  });

  test("with xp-moments on and hidden-items off, the last visit is still kept so the moment can play", async () => {
    await switchWebsite(t, postHog, true, ...albumOpen, "xp-moments");
    const asAlice = await signedIn(alice);
    await thanks(bob, alice);
    expect(await arrive(asAlice, null)).toMatchObject({ kind: "arrived", lastVisit: expect.any(Number) });
    later();
    await thanks(bob, alice);

    const moment = await theMomentOf(asAlice);

    expect(moment.excerpts.map(({ entry }) => entry.kind)).toEqual(["kudosReceived"]);
    expect(moment.waiting).toBe(0);
  });
});

describe("LP26 LP35: endXpMoment moves the last visit to the newest instant the moment read", { timeout: 60_000 }, () => {
  test("ending moves the last visit to the newest instant read, never the clock, so what was decided while it played waits for the next moment", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    const whilePlaying = await thanks(carol, alice);
    later();

    expect(await endOf(asAlice, moment)).toEqual({ kind: "arrived", lastVisit: moment.until });

    const next = await theMomentOf(asAlice);
    expect(next.since).toBe(moment.until);
    expect(next.excerpts.map(({ entry }) => entry.at)).toEqual([whilePlaying.at]);
  });

  test("an arrival after a read that answered none moves nothing past a kudos decided since that read, so the next read plays it", async () => {
    const asAlice = await aReturningMember(alice);
    const read = await momentOf(asAlice);
    expect(read).toMatchObject({ kind: "none" });
    const lastVisit = (read as { lastVisit: number }).lastVisit;
    const sinceTheRead = await thanks(bob, alice);

    expect(await arrive(asAlice, lastVisit), "the arrival after the read").toEqual({ kind: "arrived", lastVisit });

    const next = await theMomentOf(asAlice);
    expect(next.excerpts.map(({ entry }) => entry.at), "the next read").toEqual([sinceTheRead.at]);
  });

  test("a second tab reads the same moment until one ends it, and ending the older moment moves nothing", async () => {
    const tab = await aReturningMember(alice);
    const otherTab = await signedIn(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(tab);
    expect(await theMomentOf(otherTab)).toEqual(moment);
    await endOf(tab, moment);
    await thanks(carol, alice);
    const before = await everythingWritten();

    expect(await endOf(otherTab, moment)).toEqual({ kind: "arrived", lastVisit: moment.until });
    expect(await everythingWritten()).toEqual(before);
  });

  test("an instant no moment read moves nothing", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    const before = await everythingWritten();

    expect(await endOf(asAlice, { ...moment, until: moment.until + minuteMs })).toEqual({ kind: "arrived", lastVisit: moment.since });
    expect(await everythingWritten()).toEqual(before);
  });

  test("LP36: ending records xp moment ended with skipped, excerpts_shown and folded, a crossed level among the excerpts shown", async () => {
    const asAlice = await aReturningMember(alice);
    for (let kudos = 0; kudos < 6; kudos += 1) await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);

    await endOf(asAlice, moment, { skipped: true });
    await settle(t);

    expect(postHog.productEvents().filter(({ event }) => event === "xp moment ended").map(({ properties }) => properties)).toEqual([expect.objectContaining({ skipped: true, excerpts_shown: 5, folded: 2 })]);
  });

  test("with xp-moments off, ending answers refused and writes nothing at all", async () => {
    const asAlice = await aReturningMember(alice);
    await thanks(bob, alice);
    const moment = await theMomentOf(asAlice);
    await switchWebsite(t, postHog, true, ...albumOpen, "hidden-items");
    const before = await everythingWritten();

    expect(await endOf(asAlice, moment)).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("website reads pass one guard", { timeout: 60_000 }, () => {
  test("WS61: getXpMoment answers closed with the website off, and signed-out without a session", async () => {
    const asAlice = await signedIn(alice);
    expect(await t.query(api.website.xpMoment.getXpMoment, {})).toEqual({ kind: "signed-out" });
    await switchWebsite(t, postHog, false, ...everyFlagOfTheMoment);
    expect(await asAlice.query(api.website.xpMoment.getXpMoment, {})).toEqual({ kind: "closed" });
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: ending answers closed with the website off and signed-out without a session, writing nothing at all", async () => {
    const asAlice = await signedIn(alice);
    const ending = { from: 1, until: 2, skipped: false };
    const before = await everythingWritten();

    expect(await t.mutation(api.website.xpMoment.endXpMoment, ending)).toEqual({ kind: "signed-out" });
    await switchWebsite(t, postHog, false, ...everyFlagOfTheMoment);
    const closed = await everythingWritten();
    expect(await asAlice.mutation(api.website.xpMoment.endXpMoment, ending)).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(closed);
    expect(closed.tables.lastVisits).toEqual(before.tables.lastVisits);
  });

  test("WS61: the moment's instants are the only arguments, so no call names a member", async () => {
    const asAlice = await signedIn(alice);

    await expect(asAlice.mutation(api.website.xpMoment.endXpMoment, { from: 1, until: 2, skipped: false, member: "someone" } as never)).rejects.toThrow(/member/);
  });
});

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function later() {
  vi.setSystemTime(Date.now() + minuteMs);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  messages += 1;
  later();
  const at = Date.now();
  const ts = `${Math.floor(at / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return { at: Number(ts.split(".")[0]) * 1000, ts };
}

async function thanksWhileItsXpWaits(giver: Person, ...recipients: Person[]) {
  messages += 1;
  later();
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  const heldBack = await settleHoldingBack(progressionRecord);
  return { at: Number(ts.split(".")[0]) * 1000, record: async () => {
    for (const args of heldBack) await t.mutation(internal.progression.progression.recordEffects, args);
    await settle(t);
  } };
}

const progressionRecord = "progression/progression:recordEffects";

async function settleHoldingBack(name: string) {
  const heldBack: { event: Infer<typeof kudosGivenEventValidator> }[] = [];
  for (let round = 0; round < 200; round += 1) {
    heldBack.push(...(await cancelled(name)));
    if ((await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).some(({ state }) => state.kind === "pending" || state.kind === "inProgress"))) === false) return heldBack;
    vi.advanceTimersToNextTimer();
    await t.finishInProgressScheduledFunctions();
  }
  throw new Error("the jobs never settled");
}

function cancelled(name: string) {
  return t.run(async (ctx) => {
    const jobs = (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name === name && job.state.kind === "pending");
    for (const job of jobs) await ctx.scheduler.cancel(job._id);
    return jobs.map(({ args }) => args[0] as { event: Infer<typeof kudosGivenEventValidator> });
  });
}

function aMessageNow() {
  messages += 1;
  return `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
}

async function hug(giver: Person, author: Person, ts: string) {
  later();
  await react(t, { user: giver.user, itemUser: author.user, ts, eventTs: `${Math.floor(Date.now() / 1000)}.000200`, reaction: "taco" });
  await settle(t);
}

async function newestKudosDecidedFor(recipient: Person) {
  return t.run(async (ctx) => {
    const member = (await ctx.db.query("members").take(20)).find(({ user }) => user === recipient.user)!._id;
    const award = await ctx.db
      .query("awards")
      .withIndex("by_recipient_decided", (q) => q.eq("recipient", member))
      .order("desc")
      .first();
    return award!._creationTime;
  });
}

async function aReturningMember(someone: Person): Promise<Reader> {
  const reader = await signedIn(someone);
  await thanks(everyone.find((other) => other !== someone)!, someone);
  expect(await arrive(reader, null)).toMatchObject({ kind: "arrived", lastVisit: expect.any(Number) });
  later();
  return reader;
}

function arrive(reader: Reader, from: number | null): Promise<ArrivalAnswer | Denial> {
  return reader.mutation(api.website.lastVisit.arrive, { from });
}

function momentOf(reader: Reader): Promise<XpMomentAnswer | Denial> {
  return reader.query(api.website.xpMoment.getXpMoment, {});
}

async function theMomentOf(reader: Reader): Promise<XpMoment> {
  const moment = await momentOf(reader);
  if (moment.kind !== "moment") throw new Error(`expected a moment, got ${JSON.stringify(moment)}`);
  return moment;
}

function endOf(reader: Reader, { since, until }: Pick<XpMoment, "since" | "until">, { skipped = false } = {}): Promise<XpMomentEndReply | Denial> {
  return reader.mutation(api.website.xpMoment.endXpMoment, { from: since, until, skipped });
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function everythingWritten() {
  const tables = await t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  return { tables, scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}
