import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import { catalogue, type Rarity } from "../album/hoggies/catalogue";
import { drawOf } from "../album/hoggies/draw";
import type { Drop } from "../album/hoggies/drops";
import type { Feature } from "../unlocks/feature";
import type { MemberId } from "../workspace/directory";
import type { CollectionAnswer } from "./collection";
import { seenKeyOf } from "./seen";

const now = new Date("2026-10-14T10:00:00Z");
const minuteMs = 60_000;
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const bookFlags = ["xp-levels", "unlocks", "achievements", "everyone-board", "skill-tree"];
const raritiesInOrder: Array<{ rarity: Rarity; chance: number; total: number }> = [
  { rarity: "common", chance: 50, total: 60 },
  { rarity: "uncommon", chance: 28, total: 40 },
  { rarity: "rare", chance: 14, total: 30 },
  { rarity: "epic", chance: 6, total: 15 },
  { rarity: "legendary", chance: 2, total: 6 },
];

type Caller = Pick<Backend, "query" | "mutation">;
type Found = { drop: Drop; at: number };

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

async function aMemberOfAShippedBook(...alsoOn: string[]) {
  await switchWebsite(t, postHog, true, ...bookFlags, ...alsoOn);
  await bookShippedBeforeAnyoneJoined(t);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  return { member, asSignedIn };
}

function collectionOf(caller: Caller) {
  return caller.query(api.website.collection.getCollection, {});
}

function bookOf(caller: Caller) {
  return caller.query(api.website.book.getBook, {});
}

async function opensOnTheWebsite(caller: Caller, feature: Feature): Promise<Found> {
  const at = Date.now();
  const answer = await caller.mutation(api.website.commands.openFeature, { feature });
  const drop = answer.kind === "opened" ? answer.drop : undefined;
  if (drop === undefined || drop === null) throw new Error(`expected ${feature} to open with a drop, got ${JSON.stringify(answer)}`);
  vi.setSystemTime(at + minuteMs);
  return { drop, at };
}

async function aSecretDrawingTheSameHoggieFor(member: MemberId, crates: string[]) {
  for (let attempt = 0; ; attempt++) {
    const secret = `secret-${attempt}`;
    const drawn = await Promise.all(crates.map((crate) => drawOf({ secret, member, crate, version: catalogue.version })));
    if (drawn.every(({ hoggie }) => hoggie === drawn[0]!.hoggie)) return secret;
  }
}

async function collectionHolding(member: MemberId, found: Found[]): Promise<CollectionAnswer> {
  const held = new Map<string, { count: number; firstAt: number }>();
  for (const { drop, at } of found) held.set(drop.hoggie, { count: (held.get(drop.hoggie)?.count ?? 0) + 1, firstAt: held.get(drop.hoggie)?.firstAt ?? at });
  const hoggies = await Promise.all(
    catalogue.hoggies.map(async ({ hoggie, name, rarity }) => {
      const tally = held.get(hoggie);
      const seen = tally === undefined ? null : await seenKeyOf(member, `hoggie:${hoggie}:${tally.firstAt}`);
      return { hoggie, name, rarity, art: { kind: "hoggie" as const, slug: hoggie }, count: tally?.count ?? 0, firstAt: tally?.firstAt ?? null, seen };
    }),
  );
  const ownedOf = (rarity: Rarity) => hoggies.filter((entry) => entry.rarity === rarity && entry.count > 0).length;
  return { kind: "collection", rarities: raritiesInOrder.map((entry) => ({ ...entry, owned: ownedOf(entry.rarity) })), hoggies, owned: held.size, total: 151 };
}

describe("CL15: getCollection answers the Book's hoggies", () => {
  test("a member who opened the Book before collection sees every catalogue hoggie, in catalogue order, none held, and each rarity's chance and total", async () => {
    const { member, asSignedIn } = await aMemberOfAShippedBook();
    await reachesLevel(t, member, 4);
    expect(await asSignedIn.mutation(api.website.commands.openFeature, { feature: "book" })).toEqual({ kind: "opened" });
    await switchWebsite(t, postHog, true, ...bookFlags, "collection");

    expect(await collectionOf(asSignedIn)).toEqual(await collectionHolding(member, []));
  });

  test("each held hoggie answers its count and the time it was first found, and a duplicate counts up without moving that time", async () => {
    const { member, asSignedIn } = await aMemberOfAShippedBook("collection");
    await reachesLevel(t, member, 5);
    vi.stubEnv("HOGGIE_DRAW_SECRET", await aSecretDrawingTheSameHoggieFor(member, ["unlock:book", "unlock:leaderboard"]));
    const found = [await opensOnTheWebsite(asSignedIn, "book"), await opensOnTheWebsite(asSignedIn, "leaderboard"), await opensOnTheWebsite(asSignedIn, "skillTree")];

    const answer = await collectionOf(asSignedIn);

    expect(answer).toEqual(await collectionHolding(member, found));
    expect(answer).toMatchObject({ owned: found[2]!.drop.hoggie === found[0]!.drop.hoggie ? 1 : 2, total: 151 });
    expect(found.map(({ drop }) => drop.copy)).toContain(2);
  });

  test("CL13: hoggies found before the Book opened wait there and show once it opens", async () => {
    const { member, asSignedIn } = await aMemberOfAShippedBook("collection");
    await reachesLevel(t, member, 2);
    const beforeTheBook = await opensOnTheWebsite(asSignedIn, "leaderboard");
    expect(await collectionOf(asSignedIn)).toEqual({ kind: "ready" });

    const theBook = await opensOnTheWebsite(asSignedIn, "book");

    expect(await collectionOf(asSignedIn)).toEqual(await collectionHolding(member, [beforeTheBook, theBook]));
  });

  test("while the Book isn't open it answers exactly getBook's locked and ready", async () => {
    await switchWebsite(t, postHog, true, ...bookFlags, "collection");
    await bookShippedBeforeAnyoneJoined(t);
    await aMember(t, juno.user);
    const { asSignedIn: notYetSignedIn } = await aSession(t, juno);
    const locked = await collectionOf(notYetSignedIn);
    const bookWhileLocked = await bookOf(notYetSignedIn);
    const { asSignedIn } = await aSignedInSession(t, juno);
    const ready = await collectionOf(asSignedIn);

    expect([locked, ready]).toEqual([{ kind: "locked", level: 1 }, { kind: "ready" }]);
    expect([locked, ready]).toEqual([bookWhileLocked, await bookOf(asSignedIn)]);
  });

  test("CL18: it answers not-found while collection is off for the member, with the Book open and hoggies held", async () => {
    const { member, asSignedIn } = await aMemberOfAShippedBook("collection");
    await reachesLevel(t, member, 4);
    await opensOnTheWebsite(asSignedIn, "book");
    await switchWebsite(t, postHog, true, ...bookFlags);

    expect(await collectionOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await bookOf(asSignedIn)).toMatchObject({ kind: "book" });
  });

  test("it answers not-found where getBook does: the Book's page off", async () => {
    await switchWebsite(t, postHog, true, "xp-levels", "collection");
    await aMember(t, juno.user);
    const { asSignedIn } = await aSignedInSession(t, juno);

    expect(await collectionOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await bookOf(asSignedIn)).toEqual({ kind: "not-found" });
  });
});

describe("website reads pass one guard", () => {
  test("getCollection reads closed while the website flag is off, even with collection on and the Book open", async () => {
    const { member, asSignedIn } = await aMemberOfAShippedBook("collection");
    await reachesLevel(t, member, 4);
    await opensOnTheWebsite(asSignedIn, "book");
    await switchWebsite(t, postHog, false, ...bookFlags, "collection");

    expect(await collectionOf(asSignedIn)).toEqual({ kind: "closed" });
  });

  test("getCollection reads signed out without a session", async () => {
    await aMemberOfAShippedBook("collection");

    expect(await t.query(api.website.collection.getCollection, {})).toEqual({ kind: "signed-out" });
  });

  test("getCollection reads not-a-member for a former member with a live session", async () => {
    await switchWebsite(t, postHog, true, ...bookFlags, "collection");
    await bookShippedBeforeAnyoneJoined(t);
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await collectionOf(asSignedIn)).toEqual({ kind: "not-a-member" });
  });

  test("getCollection rejects an argument that names another member", async () => {
    const { asSignedIn } = await aMemberOfAShippedBook("collection");
    const withAnotherMember = { user: "U_ROWAN" } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.collection.getCollection, withAnotherMember)).rejects.toThrow(/user/);
  });
});
