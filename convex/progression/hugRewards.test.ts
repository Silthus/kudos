import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { HugGivenEvent, HugReceivedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { standingOf } from "./progression";

const at = new Date("2026-10-13T10:00:00Z").getTime();
const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };

beforeEach(() => {
  vi.useFakeTimers({ now: at });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HH23: Progression pays the hug XP from the hug facts", () => {
  test("the giver of a hug is paid the hug XP once under the hug's key, however often hugGiven is delivered", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB");

    await deliverTwice(t, () => t.mutation(internal.progression.hugRewards.payHugGiven, { event: hugGiven(bob) }));

    expect(await xpOf(t, bob)).toBe(1);
    expect(await rewardsOf(t, bob)).toEqual([{ key: "hug-given:C1:1760349600.000100", xp: 1, coins: 0, item: null, catalogueVersion: "hugs-1", at }]);
  });

  test("a hugged person is paid the hug XP once under the giver's and the message's key, however often hugReceived is delivered", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB");
    const carol = await member(t, "U_CAROL");

    await deliverTwice(t, () => t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(bob, carol) }));

    expect(await xpOf(t, carol)).toBe(1);
    expect(await rewardsOf(t, carol)).toEqual([{ key: `hug:${bob}:C1:1760349600.000100`, xp: 1, coins: 0, item: null, catalogueVersion: "hugs-1", at }]);
    expect(await xpOf(t, bob)).toBe(0);
  });

  test("a member who left is paid nothing, and nothing throws", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB");
    const carol = await member(t, "U_CAROL");
    await t.run((ctx) => ctx.db.patch(bob, { kind: "not-a-member" }));
    await t.run((ctx) => ctx.db.patch(carol, { kind: "not-a-member" }));

    await t.mutation(internal.progression.hugRewards.payHugGiven, { event: hugGiven(bob) });
    await t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(bob, carol) });

    expect([...(await rewardsOf(t, bob)), ...(await rewardsOf(t, carol))]).toEqual([]);
  });
});

function hugGiven(giver: MemberId): HugGivenEvent {
  return { type: "hugGiven", workspace: "T1", giver, message, onKudos: true, at, day: "2026-10-13", first: false, reaction: "taco" };
}

function hugReceived(giver: MemberId, person: MemberId): HugReceivedEvent {
  return { type: "hugReceived", workspace: "T1", giver, person, message, at, week: "2026-10-12" };
}

async function deliverTwice(t: Backend, deliver: () => Promise<unknown>) {
  await deliver();
  await deliver();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

function member(t: Backend, user: string) {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function xpOf(t: Backend, member: MemberId) {
  return (await t.run((ctx) => standingOf(ctx, member))).xp;
}

async function rewardsOf(t: Backend, member: MemberId) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member))
      .collect(),
  );
  return rows.map(({ key, xp, coins, item, catalogueVersion, at }) => ({ key, xp, coins, item, catalogueVersion, at }));
}
