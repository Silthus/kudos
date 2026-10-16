import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { LadderFacts } from "../achievements/achievements";
import { ladders, type Ladder } from "../achievements/ladders";
import { allowanceDay } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import type { BookAnswer, LadderCard } from "./book";

const now = new Date("2026-10-14T10:00:00Z");
const minuteMs = 60_000;
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const bookFlags = ["xp-levels", "unlocks", "achievements"];
const catalogue = ladders as unknown as { version: string; ladders: Ladder[] };
const shippedLadders = [...catalogue.ladders];

let postHog: FakePostHog;
let t: Backend;
let sent = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  catalogue.ladders = [...shippedLadders];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys);
}

async function bookShipped() {
  await flagsOn(...bookFlags);
  await bookShippedBeforeAnyoneJoined(t);
}

async function signedIn(person = juno, timeZone?: string) {
  const member = await aMember(t, person.user, "member", "T1", timeZone);
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  return { member, asSignedIn };
}

async function bookOpenFor(member: MemberId) {
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
}

async function thanks(giver: MemberId, recipient: MemberId, kudos: number, at = Date.now()) {
  const event = await t.run(async (ctx) => {
    const message = { workspace: "T1", conversation: "C1", message: `kudos-${++sent}` };
    const award = await ctx.db.insert("awards", { ...message, giver, recipient, kudos, day: allowanceDay(at, undefined), at });
    return kudosGivenEvent(giver, recipient, { message, awards: [{ award, giver, recipient, kudos }], day: allowanceDay(at, undefined), at });
  });
  await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
}

async function bookOf(asSignedIn: Pick<Backend, "query">): Promise<BookAnswer> {
  const answer = await asSignedIn.query(api.website.book.getBook, {});
  if (["closed", "signed-out", "verifying", "unverified", "not-a-member"].includes(answer.kind)) throw new Error(`expected an answer, got ${answer.kind}`);
  return answer as BookAnswer;
}

async function openBook(asSignedIn: Pick<Backend, "query">) {
  const answer = await bookOf(asSignedIn);
  if (answer.kind !== "book") throw new Error(`expected the book, got ${answer.kind}`);
  return answer;
}

async function domainFactsOf(member: MemberId) {
  const facts = await t.query(internal.achievements.achievements.achievementsOf, { member });
  if (facts === null) throw new Error("expected achievementsOf to answer");
  return facts.ladders;
}

function ladderIn({ ladders }: { ladders: LadderCard[] }, ladder: string) {
  return ladders.find((entry) => entry.ladder === ladder);
}

function asWebsiteReadsIt({ ladder, name, counts, count, tiers, next }: LadderFacts) {
  const nextTier = tiers.find(({ tier }) => tier === next);
  return {
    ladder,
    name,
    counts,
    count,
    tiers: tiers.map(({ tier, name, count, earnedAt }) => ({ tier, name, at: count, earnedAt, seen: earnedAt === null ? null : expect.any(String), rewards: [] })),
    next: nextTier === undefined ? null : { tier: nextTier.tier, at: nextTier.count },
  };
}

describe("website reads pass one guard", () => {
  test("getBook reads closed while the website flag is off, even with achievements on", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);
    await switchWebsite(t, postHog, false, ...bookFlags);

    expect(await asSignedIn.query(api.website.book.getBook, {})).toEqual({ kind: "closed" });
  });

  test("getBook reads signed out without a session", async () => {
    await bookShipped();

    expect(await t.query(api.website.book.getBook, {})).toEqual({ kind: "signed-out" });
  });

  test("getBook reads not-a-member for a former member with a live session", async () => {
    await bookShipped();
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await asSignedIn.query(api.website.book.getBook, {})).toEqual({ kind: "not-a-member" });
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await bookShipped();
    const { asSignedIn } = await signedIn();
    const withAnotherMember = { user: rowan.user } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.book.getBook, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("WS80 WS90: getBook follows the Book's unlock", () => {
  test("P78 WS96: with achievements off, a member past level 4 reads not-found, whatever they earned", async () => {
    await flagsOn(...bookFlags);
    await bookShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 25);
    await flagsOn("xp-levels", "unlocks");

    expect(await bookOf(asSignedIn)).toEqual({ kind: "not-found" });
  });

  test("WS55: with every flag on and nothing launched, getBook answers not-found and records neither launch", async () => {
    await flagsOn(...bookFlags);
    const { asSignedIn } = await signedIn();

    expect(await bookOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await t.run((ctx) => ctx.db.query("unlockLaunches").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("bookLaunches").collect())).toEqual([]);
  });

  test("a member at level 1 whom nothing in Slack has shown unlocks signs in and reads the Book ready, with no achievement fact", async () => {
    await bookShipped();
    await aMember(t, juno.user);
    const { asSignedIn } = await aSignedInSession(t, juno);

    expect(await bookOf(asSignedIn)).toEqual({ kind: "ready" });
  });

  test("a member at level 4 who hasn't opened the Book reads it ready, with no achievement fact", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await reachesLevel(t, member, 4);

    expect(await bookOf(asSignedIn)).toEqual({ kind: "ready" });
  });

  test("once the member opens the Book, getBook answers their ladders", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await reachesLevel(t, member, 4);

    await opens(t, member, "book");

    expect(await bookOf(asSignedIn)).toMatchObject({ kind: "book" });
  });
});

describe("WS90: getBook reads achievementsOf's facts", () => {
  test("P60: a member with nothing earned reads every shipped ladder in catalogue order, each tier unearned and the next its bronze", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);

    const book = await openBook(asSignedIn);

    expect(book.ladders.map(({ ladder }) => ladder)).toEqual(shippedLadders.map(({ ladder }) => ladder));
    expect(ladderIn(book, "generosity")).toEqual({
      ladder: "generosity",
      name: "Generosity",
      counts: "kudos given",
      count: 0,
      tiers: [
        { tier: "bronze", name: "First Thanks", at: 1, earnedAt: null, seen: null, rewards: [] },
        { tier: "silver", name: "Generous Soul", at: 25, earnedAt: null, seen: null, rewards: [] },
        { tier: "gold", name: "Heart of the Team", at: 100, earnedAt: null, seen: null, rewards: [] },
        { tier: "diamond", name: "Patron of Praise", at: 500, earnedAt: null, seen: null, rewards: [] },
      ],
      next: { tier: "bronze", at: 1 },
    });
  });

  test("P59: earned tiers carry the dates they were earned, and next is the first tier not earned", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    const first = now.getTime();
    const reaching = first + minuteMs;
    await thanks(member, teammate, 24, first);
    await thanks(member, teammate, 1, reaching);

    const generosity = ladderIn(await openBook(asSignedIn), "generosity");

    expect(generosity).toMatchObject({
      count: 25,
      tiers: [
        { tier: "bronze", earnedAt: first },
        { tier: "silver", earnedAt: reaching },
        { tier: "gold", earnedAt: null },
        { tier: "diamond", earnedAt: null },
      ],
      next: { tier: "gold", at: 100 },
    });
  });

  test("with all four tiers earned, next is null", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 500);

    const generosity = ladderIn(await openBook(asSignedIn), "generosity");

    expect(generosity?.tiers.map(({ earnedAt }) => earnedAt)).toEqual([now.getTime(), now.getTime(), now.getTime(), now.getTime()]);
    expect(generosity?.next).toBeNull();
  });

  test("every ladder's value is achievementsOf's fact read directly", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 30);
    await thanks(teammate, member, 2, now.getTime() + minuteMs);

    const book = await openBook(asSignedIn);

    expect(book.ladders).toEqual((await domainFactsOf(member)).map(asWebsiteReadsIt));
  });

  test("timeZone is the member's zone from the directory", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn(juno, "Europe/Berlin");
    await bookOpenFor(member);

    expect((await openBook(asSignedIn)).timeZone).toBe("Europe/Berlin");
  });

  test("a member the directory knows no zone for reads UTC, the zone their days count in", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);

    expect((await openBook(asSignedIn)).timeZone).toBe("UTC");
  });
});

describe("the Book names nothing unshipped", () => {
  test("WS90 WS91 P78: with only Generosity and Recognition shipped, getBook holds exactly those ladders and no reward", async () => {
    catalogue.ladders = shippedLadders.filter(({ ladder }) => ladder === "generosity" || ladder === "recognition");
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 500);
    await thanks(teammate, member, 500);

    const book = await openBook(asSignedIn);

    expect(book.ladders.map(({ ladder }) => ladder)).toEqual(["generosity", "recognition"]);
    expect(book.ladders.flatMap(({ tiers }) => tiers.flatMap(({ rewards }) => rewards))).toEqual([]);
    expect(JSON.stringify(book)).not.toMatch(/coins|kudosEmoji|hedgehog|catalogueVersion/i);
  });

  async function coinsOpenFor(member: MemberId, ...alsoOn: string[]) {
    await flagsOn(...bookFlags, "coins", ...alsoOn);
    await reachesLevel(t, member, 6);
    await opens(t, member, "coins");
  }

  test("WS347 CO29: with Coins open, every tier carries its coin reward, earned or not, and only the coins", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await coinsOpenFor(member);
    await thanks(member, teammate, 1);

    const generosity = ladderIn(await openBook(asSignedIn), "generosity");

    expect(generosity?.tiers.map(({ tier, earnedAt, rewards }) => ({ tier, earned: earnedAt !== null, rewards }))).toEqual([
      { tier: "bronze", earned: true, rewards: [{ kind: "coins", coins: 10 }] },
      { tier: "silver", earned: false, rewards: [] },
      { tier: "gold", earned: false, rewards: [] },
      { tier: "diamond", earned: false, rewards: [{ kind: "coins", coins: 100 }] },
    ]);
  });

  test("WS347 ST20: with the store shown and Coins open, the silver tier carries its kudos emoji with its name and art, earned or not", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);
    await coinsOpenFor(member, "store");

    const book = await openBook(asSignedIn);

    expect(ladderIn(book, "generosity")?.tiers.map(({ tier, rewards }) => ({ tier, rewards }))).toEqual([
      { tier: "bronze", rewards: [{ kind: "coins", coins: 10 }] },
      { tier: "silver", rewards: [{ kind: "kudosEmoji", name: "Ribbon", art: { kind: "unicode", glyph: "🎀" } }] },
      { tier: "gold", rewards: [] },
      { tier: "diamond", rewards: [{ kind: "coins", coins: 100 }] },
    ]);
    expect(JSON.stringify(book)).not.toMatch(/hedgehog|catalogueVersion|recordedAt|kudos-emoji-/);
  });

  test("ST20: with Coins open but the store off, no tier carries a kudos emoji", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);
    await coinsOpenFor(member);

    const book = await openBook(asSignedIn);

    expect(book.ladders.flatMap(({ tiers }) => tiers.flatMap(({ rewards }) => rewards.map(({ kind }) => kind)))).not.toContain("kudosEmoji");
  });

  test("CO26: with the coins flag on but Coins not open yet, no tier carries a reward", async () => {
    await bookShipped();
    await flagsOn(...bookFlags, "coins");
    const { member, asSignedIn } = await signedIn();
    await bookOpenFor(member);

    const book = await openBook(asSignedIn);

    expect(book.ladders.flatMap(({ tiers }) => tiers.flatMap(({ rewards }) => rewards))).toEqual([]);
  });
});

describe("WS347: an earned tier's seen key", () => {
  test("each earned tier has its own seen key, the same on every read; an unearned tier has none", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 25);

    const keysOf = async () => ladderIn(await openBook(asSignedIn), "generosity")?.tiers.map(({ seen }) => seen);
    const [bronze, silver, gold, diamond] = (await keysOf()) ?? [];

    expect(bronze).toMatch(/^[0-9a-f]{32}$/);
    expect(silver).toMatch(/^[0-9a-f]{32}$/);
    expect(bronze).not.toBe(silver);
    expect([gold, diamond]).toEqual([null, null]);
    expect(await keysOf()).toEqual([bronze, silver, null, null]);
  });

  test("the same tier earned by a teammate has another key, so a shared browser shows each member's page once", async () => {
    await bookShipped();
    const juno_ = await signedIn(juno);
    const rowan_ = await signedIn(rowan);
    await bookOpenFor(juno_.member);
    await bookOpenFor(rowan_.member);
    await thanks(juno_.member, rowan_.member, 1);
    await thanks(rowan_.member, juno_.member, 1);

    const bronzeKeyOf = async (asSignedIn: Pick<Backend, "query">) => ladderIn(await openBook(asSignedIn), "generosity")?.tiers[0]?.seen;

    expect(await bronzeKeyOf(juno_.asSignedIn)).not.toBe(await bronzeKeyOf(rowan_.asSignedIn));
  });
});

describe("WS93: your own Book only", () => {
  test("a member reads their own counts and tiers, never a teammate's", async () => {
    await bookShipped();
    const { member, asSignedIn } = await signedIn();
    const teammate = await aMember(t, rowan.user);
    await bookOpenFor(member);
    await thanks(member, teammate, 3);
    await thanks(teammate, await aMember(t, "U_SKY"), 40);

    const book = await openBook(asSignedIn);

    expect(ladderIn(book, "generosity")).toMatchObject({ count: 3, next: { tier: "silver", at: 25 } });
    expect(ladderIn(book, "recognition")).toMatchObject({ count: 0, next: { tier: "bronze", at: 1 } });
    expect(book.ladders).toEqual((await domainFactsOf(member)).map(asWebsiteReadsIt));
  });
});
