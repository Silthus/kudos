import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, type UserGroupOptions } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder as settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, userGroupEvent } from "../../testing/slackMessages";
import { everyoneHeldBy, seededGroups, seededMembers, type Person } from "../../testing/stickerBook";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import { awardsOfMessage } from "../engine/awards";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection", "sticker-book", "groups"];
const stickerJob = "stickers/stickers:recordStickers";
const checkJob = "stickers/completions:checkAlbums";
const alice = { user: "U_E", name: "Alice Archer" };
const bob = { user: "U_D", name: "Bob Brandt" };
const carol = { user: "U_C", name: "Carol Chen" };
const dan = { user: "U_B", name: "Dan Dorsey" };
const eve = { user: "U_A", name: "Eve Ekwueme" };
const zed = { user: "U_Z", name: "Zed Zimmer" };
const ants = "S_4";
const bees = "S_3";
const owls = "S_1";

type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];
type HeldJob = { name: string; args: Record<string, unknown> };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
const tsOfMessageAt = new Map<number, string>();

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol, dan, eve, zed]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function teamSpirit(on: boolean) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...(on ? ["team-spirit"] : []));
}

async function teamSpiritShipped(on: boolean) {
  await teamSpirit(on);
  await bookShippedBeforeAnyoneJoined(t);
}

async function joined(...people: Person[]) {
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, real_name: person.name });
    await settle(t);
  }
}

async function groupIs(group: string, name: string, people: Person[], options: UserGroupOptions = {}) {
  slack.withUserGroup(group, { name, users: people.map(({ user }) => user), ...options });
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", group)));
  await settle(t);
}

async function groupChanged(group: string, name: string, people: Person[], options: UserGroupOptions = {}) {
  slack.withUserGroup(group, { name, users: people.map(({ user }) => user), ...options });
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_updated", group)));
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_members_changed", group)));
  await settle(t);
}

async function given(giver: Person, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const at = Date.now();
  const ts = `${at / 1000}.${String(messages).padStart(6, "0")}`;
  tsOfMessageAt.set(at, ts);
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  return at;
}

async function thanks(giver: Person, ...recipients: Person[]) {
  const at = await given(giver, ...recipients);
  await settle(t);
  return at;
}

async function memberOf(person: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.user} is not in the directory`);
  return row._id;
}

async function withTheBookOpen(person: Person): Promise<Reader> {
  const member = await memberOf(person);
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
  return (await aSignedInSession(t, person)).asSignedIn;
}

async function albumsOf(reader: Reader) {
  const answer = await reader.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${JSON.stringify(answer)}`);
  return answer.albums ?? [];
}

async function albumNamed(reader: Reader, name: string) {
  const album = (await albumsOf(reader)).find((each) => each.name === name);
  if (album === undefined) throw new Error(`no album ${name}`);
  return album;
}

async function completionOf(reader: Reader, name: string) {
  const { held, total, complete, completedAt, seen } = await albumNamed(reader, name);
  return { held, total, complete, completedAt, seen };
}

async function groupIdOf(group: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("userGroups")
      .withIndex("by_group", (q) => q.eq("workspace", "T1").eq("group", group))
      .unique(),
  );
  if (row === null) throw new Error(`${group} is not in the user group copy`);
  return row._id;
}

async function recordedAt(owner: Person, group: string, at: number, held: number, total = held) {
  return { held, total, complete: true, completedAt: at, seen: await seenKeyOf(await memberOf(owner), `album:${await groupIdOf(group)}:${at}`) };
}

function unrecorded(held: number, total: number) {
  return { held, total, complete: held === total && total > 0, completedAt: null, seen: null };
}

async function analyticsIdOf(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => (await ctx.db.query("analyticsIds").collect()).find((row) => row.member === member)?.analyticsId);
}

async function albumsCompletedBy(person: Person) {
  const analyticsId = await analyticsIdOf(person);
  return postHog
    .productEvents()
    .filter(({ event, distinct_id }) => event === "album completed" && distinct_id === analyticsId)
    .map(({ properties }) => properties);
}

function albumCompleted(people: number, told: boolean) {
  return { environment: "sandbox", workspace_key: expect.any(String), taxonomy_version: 1, people, told };
}

function storedCompletions() {
  return t.run((ctx) => ctx.db.query("albumCompletions").collect());
}

async function heldBack(...names: string[]): Promise<HeldJob[]> {
  const held: HeldJob[] = [];
  for (let fired = 0; fired < 200; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    held.push(...(await cancelPending(names)));
    if (vi.getTimerCount() === 0) return held;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos never settled");
}

async function cancelPending(names: string[]): Promise<HeldJob[]> {
  return t.run(async (ctx) => {
    const pending = (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => names.includes(job.name) && job.state.kind === "pending");
    for (const job of pending) await ctx.scheduler.cancel(job._id);
    return pending.map((job) => ({ name: job.name, args: job.args[0] as Record<string, unknown> }));
  });
}

async function runs(job: HeldJob) {
  await t.mutation(makeFunctionReference<"mutation">(job.name), job.args);
}

describe("SB22 SB23: a member's first check records every album already complete, silently", { timeout: 60_000 }, () => {
  test("albums filled while team-spirit was off are recorded untold at the first new sticker after it turns on, and every later one is told", async () => {
    await teamSpiritShipped(false);
    await joined(alice, bob, carol, dan, eve);
    await groupIs(ants, "Ants", [alice, bob, carol]);
    await groupIs(bees, "Bees", [dan, eve]);
    await groupIs(owls, "Owls", [alice]);
    await thanks(alice, bob, carol);
    const reader = await withTheBookOpen(alice);

    await teamSpirit(true);
    expect(await completionOf(reader, "Ants"), "an album filled while team-spirit was off reads complete before it is recorded").toEqual(unrecorded(2, 2));
    const firstCheck = await thanks(alice, dan);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, firstCheck, 2));
    expect(await completionOf(reader, "Bees")).toEqual(unrecorded(1, 2));
    expect(await completionOf(reader, "Owls"), "an album with nobody else in it can't be complete").toEqual(unrecorded(0, 0));
    expect(await albumsCompletedBy(alice)).toEqual([albumCompleted(2, false)]);

    const later = await thanks(eve, alice);

    expect(await completionOf(reader, "Bees")).toEqual(await recordedAt(alice, bees, later, 2));
    expect(await albumsCompletedBy(alice)).toEqual([
      albumCompleted(2, false),
      albumCompleted(2, true),
    ]);
  });
});

describe("SB18 SB19: thanking the last missing person records the album under that award", { timeout: 60_000 }, () => {
  test("the album is recorded once, told, with the award that gave the last sticker", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol);
    await groupIs(ants, "Ants", [alice, bob, carol]);
    await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);
    expect(await completionOf(reader, "Ants")).toEqual(unrecorded(1, 2));

    const last = await thanks(alice, carol);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, last, 2));
    expect(await albumsCompletedBy(alice)).toEqual([albumCompleted(2, true)]);
    const [lastAward] = await t.run((ctx) => awardsOfMessage(ctx, { workspace: "T1", conversation: "C1", message: tsOfMessageAt.get(last)! }));
    expect((await storedCompletions()).map(({ award }) => award)).toEqual([lastAward!.award]);
  });
});

describe("a completed album stays complete", { timeout: 60_000 }, () => {
  test("someone joining a completed album keeps it complete, and later new stickers record it no second time", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol, dan);
    await groupIs(ants, "Ants", [alice, bob]);
    await thanks(alice, carol);
    const completed = await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);

    await groupChanged(ants, "Ants", [alice, bob, dan]);
    expect(await completionOf(reader, "Ants"), "a join un-completed the album").toEqual(await recordedAt(alice, ants, completed, 1, 2));

    await thanks(alice, dan);
    await groupChanged(ants, "Ants", [alice, bob, carol, dan, eve]);
    await joined(eve);
    await thanks(eve, alice);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, completed, 4, 4));
    expect(await albumsCompletedBy(alice), "a second completion was recorded").toEqual([albumCompleted(1, true)]);
    const member = await memberOf(alice);
    expect((await storedCompletions()).filter((completion) => completion.member === member)).toHaveLength(1);
  });

  test("a redelivered kudosGiven and a retried check record nothing twice", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol);
    await groupIs(ants, "Ants", [alice, bob, carol]);
    await thanks(alice, bob);
    const completed = await given(alice, carol);
    const [stickers] = await heldBack(stickerJob);
    await runs(stickers!);
    const checks = await heldBack(checkJob);
    for (const check of checks) await runs(check);
    await settle(t);
    const reader = await withTheBookOpen(alice);
    const recorded = await storedCompletions();

    await runs(stickers!);
    for (const check of checks) await runs(check);
    await settle(t);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, completed, 2));
    expect(await albumsCompletedBy(alice)).toEqual([albumCompleted(2, true)]);
    expect(await storedCompletions()).toEqual(recorded);
  });

  test("a recorded album of a group that stops counting leaves the Book, and is back complete when the group counts again", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol);
    await groupIs(ants, "Ants", [alice, bob]);
    await groupIs(bees, "Bees", [carol]);
    const completed = await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);

    await groupChanged(ants, "Ants", [alice, bob, carol], { disabled: true });
    expect((await albumsOf(reader)).map(({ name }) => name)).toEqual(["Bees"]);

    await groupChanged(ants, "Ants", [alice, bob, carol]);
    expect(await completionOf(reader, "Ants"), "the group counting again un-completed the album").toEqual(await recordedAt(alice, ants, completed, 1, 2));
  });
});

describe("SB19 SB24: an album whose last missing person left reads complete at once and is recorded at the next new sticker", { timeout: 60_000 }, () => {
  test("the departure shows complete with nothing recorded, and the member's next new sticker records it, told", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol, dan);
    await groupIs(ants, "Ants", [alice, bob, carol]);
    await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);

    await groupChanged(ants, "Ants", [alice, bob]);
    expect(await completionOf(reader, "Ants")).toEqual(unrecorded(1, 1));
    expect(await albumsCompletedBy(alice)).toEqual([]);

    const next = await thanks(dan, alice);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, next, 1));
    expect(await albumsCompletedBy(alice)).toEqual([albumCompleted(1, true)]);
  });
});

describe("G5 SB18: an album of a group that doesn't count can't be completed", { timeout: 60_000 }, () => {
  test("a check records only the counting group's album, and the other waits for a new sticker after it counts again", async () => {
    await teamSpiritShipped(true);
    await joined(alice, bob, carol);
    await groupIs(ants, "Ants", [alice, bob]);
    await groupIs(bees, "Bees", [alice, bob], { disabled: true });
    const completed = await thanks(alice, bob);
    const reader = await withTheBookOpen(alice);

    await groupChanged(bees, "Bees", [alice, bob]);

    expect(await completionOf(reader, "Ants")).toEqual(await recordedAt(alice, ants, completed, 1));
    expect(await completionOf(reader, "Bees")).toEqual(unrecorded(1, 1));
    expect(await albumsCompletedBy(alice)).toEqual([albumCompleted(1, false)]);

    const next = await thanks(carol, alice);
    expect(await completionOf(reader, "Bees")).toEqual(await recordedAt(alice, bees, next, 1));
  });
});

describe("SB25: with team-spirit off no check writes anything", { timeout: 60_000 }, () => {
  test("filling an album records no completion and no check, sends no album completed, and albums answer as stopping point 1", async () => {
    await teamSpiritShipped(false);
    await joined(alice, bob, carol);
    await groupIs(ants, "Ants", [alice, bob]);
    await thanks(alice, bob);
    await thanks(carol, alice);

    const [album] = await albumsOf(await withTheBookOpen(alice));
    expect(album).toMatchObject({ name: "Ants", held: 1, total: 1 });
    for (const field of ["complete", "completedAt", "seen"]) expect(album).not.toHaveProperty(field);
    expect(await storedCompletions()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("albumChecks").collect())).toEqual([]);
    expect(postHog.productEvents().filter(({ event }) => event === "album completed")).toEqual([]);
  });
});

describe("SB19: a member completing 60 albums at once stays inside Convex's limits", { timeout: 60_000 }, () => {
  test("the last missing person in 60 albums of the supported size records all 60, 25 per check mutation, told", { timeout: 600_000 }, async () => {
    t = testBackend({ transactionLimits: true });
    await teamSpiritShipped(true);
    await joined(alice, bob, zed);
    await thanks(alice, bob);
    const people = [alice, bob, zed, ...(await seededMembers(t, 1_997))];
    await seededGroups(t, people, { groups: 60, size: 100 });
    await zedIsInEveryGroup();
    const member = await memberOf(alice);
    await everyoneHeldBy(t, member, people, { except: [await memberOf(zed)] });

    const last = await thanks(alice, zed);

    const albums = await albumsOf(await withTheBookOpen(alice));
    expect(albums).toHaveLength(60);
    expect(albums.every(({ complete, completedAt }) => complete && completedAt === last)).toBe(true);
    expect(await albumsCompletedBy(alice)).toHaveLength(60);
    expect(await checksRun()).toEqual({ succeeded: 6, failed: 0 });
  });
});

async function zedIsInEveryGroup() {
  await t.run(async (ctx) => {
    for (const { group } of await ctx.db.query("userGroups").collect()) await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user: zed.user });
  });
}

async function checksRun() {
  const checks = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ name }) => name === checkJob));
  return { succeeded: checks.filter(({ state }) => state.kind === "success").length, failed: checks.filter(({ state }) => state.kind === "failed").length };
}
