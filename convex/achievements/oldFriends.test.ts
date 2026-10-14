import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { unlocksLiveIn } from "../unlocks/launch";
import type { MemberId } from "../workspace/directory";
import { achievementsLiveIn } from "./flag";
import { ladders, type Ladder, type LadderId } from "./ladders";
import { thanksAnOldFriend } from "./oldFriends";

const now = new Date("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60_000;
const catalogue = ladders as unknown as { version: string; ladders: Ladder[] };
const shippedCatalogue = { version: catalogue.version, ladders: [...catalogue.ladders] };

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "achievements");
});

afterEach(() => {
  catalogue.ladders = [...shippedCatalogue.ladders];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P58 P59: Old Friends counts thanking someone again 30 or more of the giver's days after you last did", () => {
  test.each<{ case: string; lastThanked: DayKey | null; day: DayKey; counts: boolean }>([
    { case: "the first thanks to someone", lastThanked: null, day: "2026-10-13", counts: false },
    { case: "29 days apart", lastThanked: "2026-09-14", day: "2026-10-13", counts: false },
    { case: "30 days apart", lastThanked: "2026-09-13", day: "2026-10-13", counts: true },
    { case: "a year apart", lastThanked: "2025-10-13", day: "2026-10-13", counts: true },
    { case: "30 days across a year's end", lastThanked: "2025-12-15", day: "2026-01-14", counts: true },
    { case: "the same day", lastThanked: "2026-10-13", day: "2026-10-13", counts: false },
  ])("$case: $counts", ({ lastThanked, day, counts }) => {
    expect(thanksAnOldFriend(lastThanked, day)).toBe(counts);
  });

  test.each([
    { timeZone: "UTC", counts: true },
    { timeZone: "Pacific/Auckland", counts: false },
  ])("two kudos 29 days and 1 hour apart are 30 days apart in UTC and 29 in Auckland: in $timeZone they count $counts", ({ timeZone, counts }) => {
    const lastThanked = Date.parse("2026-09-13T23:30:00Z");
    const thanked = Date.parse("2026-10-13T00:30:00Z");

    expect(thanksAnOldFriend(allowanceDay(lastThanked, timeZone), allowanceDay(thanked, timeZone))).toBe(counts);
  });
});

describe("P62: Old Friends counts each pair's awards as their award order says", () => {
  test("the launch's replay earns the tiers each dated by the award that reached them, and the first thanks and a thanks 29 days on count nothing", async () => {
    const { t, alice, bob, carol } = await withMembers();
    await given(t, alice, bob, daysAgo(200));
    const remembered = await given(t, alice, bob, daysAgo(170));
    await given(t, alice, carol, daysAgo(160));
    await given(t, alice, carol, daysAgo(131));
    await given(t, alice, bob, daysAgo(140));
    const reachingOldFriends = await given(t, alice, carol, daysAgo(100));

    await launch(t);
    await settle(t);

    expect(await ladderOf(t, alice, "old-friends")).toEqual({ count: 3, earned: [{ tier: "bronze", earnedAt: remembered.at }, { tier: "silver", earnedAt: reachingOldFriends.at }] });
    expect(await ladderOf(t, bob, "old-friends")).toEqual({ count: 0, earned: [] });
  });

  test("two awards of one pair whose subscribers run in reverse order count as their award order says", async () => {
    const { t, alice, bob } = await withMembers();
    await launch(t);
    await settle(t);
    const first = await given(t, alice, bob, daysAgo(40));
    const again = await given(t, alice, bob, daysAgo(5));

    await count(t, again);
    await count(t, first);

    expect(await ladderOf(t, alice, "old-friends")).toEqual({ count: 1, earned: [{ tier: "bronze", earnedAt: again.at }] });
  });

  test("a delayed subscriber of an older award does not count against a newer one", async () => {
    const { t, alice, bob } = await withMembers();
    await launch(t);
    await settle(t);
    const first = await given(t, alice, bob, daysAgo(70));
    const second = await given(t, alice, bob, daysAgo(35));
    const third = await given(t, alice, bob, daysAgo(34));

    await count(t, third);
    await count(t, first);
    await count(t, second);

    expect(await ladderOf(t, alice, "old-friends")).toEqual({ count: 1, earned: [{ tier: "bronze", earnedAt: second.at }] });
  });

  test("added after the workspace launched, the ladder replays full history once and leaves the other ladders' tiers alone", async () => {
    withoutLadder("old-friends");
    const { t, alice, bob } = await withMembers();
    await given(t, alice, bob, daysAgo(60));
    await launch(t);
    await settle(t);
    const generosityBefore = await earnedRows(t, alice, "generosity");
    const remembered = await given(t, alice, bob, daysAgo(0));
    await count(t, remembered);
    expect((await ladderOf(t, alice, "old-friends")).count).toBe(0);

    shipped();
    await launch(t);
    await settle(t);
    await launch(t);
    await count(t, remembered);
    await settle(t);

    expect(await ladderOf(t, alice, "old-friends")).toEqual({ count: 1, earned: [{ tier: "bronze", earnedAt: remembered.at }] });
    expect(await earnedRows(t, alice, "generosity")).toEqual(generosityBefore);
    expect((await replaysIn(t)).filter(({ ladder }) => ladder === "old-friends")).toHaveLength(1);
  });
});

async function withMembers() {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => unlocksLiveIn(ctx, "T1"));
  const [alice, bob, carol] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob!, carol: carol! };
}

function launch(t: Backend) {
  return t.run((ctx) => achievementsLiveIn(ctx, "T1"));
}

function daysAgo(days: number) {
  return now.getTime() - days * dayMs;
}

async function given(t: Backend, giver: MemberId, recipient: MemberId, at: number): Promise<KudosGivenEvent> {
  return t.run(async (ctx) => {
    const row = { workspace: "T1", conversation: "C1", message: `${at}`, giver, recipient, kudos: 1, day: allowanceDay(at, "UTC"), at };
    const award = await ctx.db.insert("awards", row);
    const event = kudosGivenEvent(giver, recipient, { workspace: "T1", at, day: row.day, message: { workspace: "T1", conversation: row.conversation, message: row.message } });
    return { ...event, awards: [{ award, giver, recipient, kudos: 1 }] };
  });
}

async function count(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
}

async function ladderOf(t: Backend, member: MemberId, ladder: LadderId) {
  const count = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("ladderCounts")
      .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
      .unique();
    return row?.count ?? 0;
  });
  return { count, earned: (await earnedRows(t, member, ladder)).map(({ tier, earnedAt }) => ({ tier, earnedAt })) };
}

function earnedRows(t: Backend, member: MemberId, ladder: LadderId) {
  return t.run((ctx) =>
    ctx.db
      .query("earnedTiers")
      .withIndex("by_member_ladder_tier", (q) => q.eq("member", member).eq("ladder", ladder))
      .collect(),
  );
}

function replaysIn(t: Backend) {
  return t.run((ctx) =>
    ctx.db
      .query("bookReplays")
      .withIndex("by_workspace_ladder", (q) => q.eq("workspace", "T1"))
      .collect(),
  );
}

function withoutLadder(ladder: LadderId) {
  catalogue.ladders = shippedCatalogue.ladders.filter((entry) => entry.ladder !== ladder);
}

function shipped() {
  catalogue.ladders = [...shippedCatalogue.ladders];
}
