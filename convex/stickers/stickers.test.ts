import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { convexStops, memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { CollectionAnswer } from "../website/collection";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-16T10:00:00Z");
const minuteMs = 60_000;
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree", "collection"];
const stickerJob = "stickers/stickers:recordStickers";
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query">;
type HeldJob = { name: string; args: Record<string, unknown> };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function stickerBookOn(backend = t) {
  await switchWebsite(backend, postHog, true, ...bookFlags, "sticker-book");
  await bookShippedBeforeAnyoneJoined(backend);
}

let messages = 0;

function nextTs() {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  return { ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`, at: Date.now() };
}

async function thanks(giver: Person, ...recipients: Person[]) {
  const { ts, at } = nextTs();
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  return at;
}

async function memberOf(person: Person, backend = t): Promise<MemberId> {
  const row = await backend.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  if (row === null) throw new Error(`${person.user} is not in the directory`);
  return row._id;
}

async function withTheBookOpen(person: Person, backend = t): Promise<Reader> {
  const member = await memberOf(person, backend);
  await reachesLevel(backend, member, 4);
  await opens(backend, member, "book");
  const { asSignedIn } = await aSignedInSession(backend, person);
  return asSignedIn;
}

async function collectionOf(reader: Reader): Promise<Extract<CollectionAnswer, { kind: "collection" }>> {
  const answer = await reader.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${JSON.stringify(answer)}`);
  return answer;
}

async function stickersOf(reader: Reader) {
  return (await collectionOf(reader)).stickers;
}

async function stickerOf(owner: Person, person: Person, firstAt: number, { former = false, backend = t } = {}) {
  const me = await memberOf(owner, backend);
  const them = await memberOf(person, backend);
  const name = former ? "A teammate" : person.name;
  const initials = former ? "?" : person.name.split(" ").map((word) => word[0]).join("");
  return {
    name,
    face: { kind: "initials", initials },
    former,
    key: await seenKeyOf(me, `sticker:${them}`),
    firstAt,
    seen: await seenKeyOf(me, `sticker:${them}:${firstAt}`),
  };
}

async function heldBackStickerJobs(backend = t): Promise<HeldJob[]> {
  const held: HeldJob[] = [];
  for (let fired = 0; fired < 200; fired += 1) {
    await backend.finishInProgressScheduledFunctions();
    held.push(...(await cancelPending(backend, stickerJob)));
    if (vi.getTimerCount() === 0) return held;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos never settled");
}

async function cancelPending(backend: Backend, name: string): Promise<HeldJob[]> {
  return backend.run(async (ctx) => {
    const pending = (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name === name && job.state.kind === "pending");
    for (const job of pending) await ctx.scheduler.cancel(job._id);
    return pending.map((job) => ({ name: job.name, args: job.args[0] as Record<string, unknown> }));
  });
}

async function runs(job: HeldJob, backend = t) {
  await backend.mutation(makeFunctionReference<"mutation">(job.name), job.args);
}

async function givenBeforeStickersShipped(giver: Person, ...recipients: Person[]) {
  const at = await thanks(giver, ...recipients);
  await heldBackStickerJobs();
  await settle(t);
  return at;
}

describe("SB1 SB2 SB4: every kudos gives stickers of the people in it", () => {
  test("a kudos gives the giver a sticker of each recipient and each recipient a sticker of the giver", async () => {
    await stickerBookOn();
    const at = await thanks(alice, bob, carol);
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(alice))).toEqual([await stickerOf(alice, carol, at), await stickerOf(alice, bob, at)]);
    expect(await stickersOf(await withTheBookOpen(bob))).toEqual([await stickerOf(bob, alice, at)]);
    expect(await stickersOf(await withTheBookOpen(carol))).toEqual([await stickerOf(carol, alice, at)]);
  });

  test("SB14: recording a sticker tells nobody", async () => {
    await stickerBookOn();
    await thanks(alice, bob);
    const [job] = await heldBackStickerJobs();
    await settle(t);
    const callsBefore = slack.calls.length;
    const eventsBefore = postHog.events().length;

    await runs(job!);
    await settle(t);

    expect(slack.calls.slice(callsBefore)).toEqual([]);
    expect(postHog.events().slice(eventsBefore)).toEqual([]);
    expect(await stickersOf(await withTheBookOpen(bob))).toHaveLength(1);
  });
});

describe("a sticker is recorded once with its pair's earliest award", { timeout: 60_000 }, () => {
  test("the newest sticker comes first, and a second kudos between the same two adds none and keeps its time", async () => {
    await stickerBookOn();
    const first = await thanks(alice, bob);
    const second = await thanks(alice, carol);
    await thanks(alice, bob);
    await thanks(bob, alice);
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(alice))).toEqual([await stickerOf(alice, carol, second), await stickerOf(alice, bob, first)]);
    expect(await stickersOf(await withTheBookOpen(bob))).toEqual([await stickerOf(bob, alice, first)]);
  });

  test("two messages whose subscribers run in reverse order both record the first message's award", async () => {
    await stickerBookOn();
    const first = await thanks(alice, bob);
    await thanks(alice, bob, carol);
    const [firstJob, secondJob] = await heldBackStickerJobs();

    await runs(secondJob!);
    await runs(firstJob!);
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(bob))).toEqual([await stickerOf(bob, alice, first)]);
    expect((await stickersOf(await withTheBookOpen(alice)))?.[1]).toEqual(await stickerOf(alice, bob, first));
  });

  test("a thanks back the other way, recorded first, records the earlier thanks", async () => {
    await stickerBookOn();
    const first = await thanks(alice, bob);
    await thanks(bob, alice);
    const [aliceThanksBob, bobThanksAlice] = await heldBackStickerJobs();

    await runs(bobThanksAlice!);
    await runs(aliceThanksBob!);
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(alice))).toEqual([await stickerOf(alice, bob, first)]);
    expect(await stickersOf(await withTheBookOpen(bob))).toEqual([await stickerOf(bob, alice, first)]);
  });

  test("one person named twice in a message gives one sticker each way", async () => {
    await stickerBookOn();
    const at = await thanks(alice, bob, bob);
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(alice))).toEqual([await stickerOf(alice, bob, at)]);
    expect(await stickersOf(await withTheBookOpen(bob))).toEqual([await stickerOf(bob, alice, at)]);
  });

  test("a redelivered kudosGiven and a rerun backfill write nothing new", async () => {
    await stickerBookOn();
    const first = await thanks(alice, bob);
    const [job] = await heldBackStickerJobs();
    await runs(job!);
    await settle(t);
    const readers = { alice: await withTheBookOpen(alice), bob: await withTheBookOpen(bob) };

    await runs(job!);
    await t.mutation(internal.stickers.backfill.startStickerBackfill, { workspace: "T1" });
    await settle(t);
    await t.mutation(internal.stickers.backfill.startStickerBackfill, { workspace: "T1" });
    await settle(t);

    expect(await stickersOf(readers.alice)).toEqual([await stickerOf(alice, bob, first)]);
    expect(await stickersOf(readers.bob)).toEqual([await stickerOf(bob, alice, first)]);
    expect(await t.run((ctx) => ctx.db.query("stickers").collect())).toHaveLength(2);
  });

  test("the ship's backfill gives the stickers of every kudos before it, in award order", async () => {
    await stickerBookOn();
    const first = await givenBeforeStickersShipped(alice, bob);
    const second = await givenBeforeStickersShipped(carol, alice);
    await givenBeforeStickersShipped(bob, alice);
    const reader = await withTheBookOpen(alice);
    expect(await stickersOf(reader)).toEqual([]);

    await t.mutation(internal.stickers.backfill.startStickerBackfill, { workspace: "T1" });
    await settle(t);

    expect(await stickersOf(reader)).toEqual([await stickerOf(alice, carol, second), await stickerOf(alice, bob, first)]);
  });

  test("the first kudos in a workspace without a backfill starts it, and kudos given while it runs count too", async () => {
    await stickerBookOn();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 60 }));
    const recipients = Array.from({ length: 60 }, (_, index) => ({ user: `U_NEW${String(index).padStart(2, "0")}`, name: `New Person${index}` }));
    for (const person of recipients) slack.withMember(person.user, { real_name: person.name });
    const earlier = await givenBeforeStickersShipped(alice, ...recipients);
    const thanksBack = await givenBeforeStickersShipped(bob, alice);

    const during = await thanks(carol, alice);
    await settle(t);

    const stickers = await stickersOf(await withTheBookOpen(alice));
    expect(stickers?.slice(0, 2)).toEqual([await stickerOf(alice, carol, during), await stickerOf(alice, bob, thanksBack)]);
    expect(stickers?.slice(2).map(({ firstAt }) => firstAt)).toEqual(recipients.map(() => earlier));
    expect(stickers).toHaveLength(62);
  });
});

describe("SB4 SB5: a kudos to 300 members and the backfill of it stay inside Convex's limits", () => {
  test("every recipient and the giver get their stickers, live and again from the backfill, with no mutation refused", { timeout: 300_000 }, async () => {
    const limited = testBackend({ transactionLimits: true });
    await stickerBookOn(limited);
    await limited.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 300 }));
    const recipients = Array.from({ length: 300 }, (_, index) => ({ user: `U_MANY${String(index).padStart(3, "0")}`, name: `Many Person${index}` }));
    for (const person of recipients) slack.withMember(person.user, { real_name: person.name });
    const { ts, at } = nextTs();

    await post(limited, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: alice.user, ts });
    await settle(limited);
    await limited.mutation(internal.stickers.backfill.startStickerBackfill, { workspace: "T1" });
    await settle(limited);

    const stickers = await stickersOf(await withTheBookOpen(alice, limited));
    expect(stickers).toHaveLength(300);
    expect(new Set(stickers?.map(({ firstAt }) => firstAt))).toEqual(new Set([at]));
    expect(await stickersOf(await withTheBookOpen(recipients[299]!, limited))).toEqual([await stickerOf(recipients[299]!, alice, at, { backend: limited })]);
  });
});

describe("SB1 SB11: a sticker shows the person as the directory has them now", () => {
  test("a person who left keeps their sticker as a former teammate", async () => {
    await stickerBookOn();
    const at = await thanks(alice, bob);
    await settle(t);

    await memberChanged(t, "user_change", { id: bob.user, team_id: "T1", deleted: true });
    await settle(t);

    expect(await stickersOf(await withTheBookOpen(alice))).toEqual([await stickerOf(alice, bob, at, { former: true })]);
  });
});

describe("the sticker book is private", () => {
  test("a member's call answers only their own stickers and takes no member to read another's", async () => {
    await stickerBookOn();
    const at = await thanks(alice, bob);
    await thanks(carol, alice);
    await settle(t);
    const asBob = await withTheBookOpen(bob);

    expect(await stickersOf(asBob)).toEqual([await stickerOf(bob, alice, at)]);
    await expect(asBob.query(api.website.collection.getCollection, { member: await memberOf(alice) } as never)).rejects.toThrow();
  });
});

describe("SB6 SB10 SB11 SB15: stickers show only where sticker-book is on", () => {
  test("with sticker-book off the collection has no stickers field, and stickers recorded meanwhile show once it is on", async () => {
    await switchWebsite(t, postHog, true, ...bookFlags);
    await bookShippedBeforeAnyoneJoined(t);
    const at = await thanks(alice, bob);
    await settle(t);
    const reader = await withTheBookOpen(alice);

    const off = await collectionOf(reader);
    expect(off).not.toHaveProperty("stickers");

    await switchWebsite(t, postHog, true, ...bookFlags, "sticker-book");
    expect(await collectionOf(reader)).toEqual({ ...off, stickers: [await stickerOf(alice, bob, at)] });
  });
});
