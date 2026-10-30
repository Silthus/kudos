import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsOnForEveryone, offForEveryone, onForEveryone, testBackendServing } from "../../testing/flags";
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

describe("HH32 HH33: Progression pays the first-hug bonuses from the hug facts", () => {
  test("a rewarded hugGiven pays the giver 10 XP in all once, the day bonus under the giver's day, however often it is delivered", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB");

    await deliverTwice(t, () => t.mutation(internal.progression.hugRewards.payHugGiven, { event: hugGiven(bob, { rewards: true }) }));

    expect(await xpOf(t, bob)).toBe(10);
    expect(await rewardsOf(t, bob)).toEqual([
      { key: "hug-day:2026-10-13", xp: 9, coins: 0, item: null, catalogueVersion: "hugs-1", at },
      { key: "hug-given:C1:1760349600.000100", xp: 1, coins: 0, item: null, catalogueVersion: "hugs-1", at },
    ]);
  });

  test("a rewarded hugReceived pays the person 5 XP in all once, the week bonus under the person's week, however often it is delivered", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB");
    const carol = await member(t, "U_CAROL");

    await deliverTwice(t, () => t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(bob, carol, { rewards: true }) }));

    expect(await xpOf(t, carol)).toBe(5);
    expect(await rewardsOf(t, carol)).toContainEqual({ key: "hug-week:2026-10-12", xp: 4, coins: 0, item: null, catalogueVersion: "hugs-1", at });
  });
});

describe("HH34: the bonuses pay what the hug decided, whatever hug-rewards says at delivery", () => {
  test("facts decided with rewards pay the bonuses after hug-rewards turned off", async () => {
    const t = await backendWith(offForEveryone("hug-rewards"));
    const bob = await member(t, "U_BOB");
    const carol = await member(t, "U_CAROL");

    await t.mutation(internal.progression.hugRewards.payHugGiven, { event: hugGiven(bob, { rewards: true }) });
    await t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(bob, carol, { rewards: true }) });

    expect({ bob: await xpOf(t, bob), carol: await xpOf(t, carol) }).toEqual({ bob: 10, carol: 5 });
  });

  test("facts decided without rewards, or from before the flag, pay no bonus after hug-rewards turned on", async () => {
    const t = await backendWith(onForEveryone("hug-rewards"));
    const bob = await member(t, "U_BOB");
    const carol = await member(t, "U_CAROL");
    const dana = await member(t, "U_DANA");

    await t.mutation(internal.progression.hugRewards.payHugGiven, { event: hugGiven(bob, { rewards: false }) });
    await t.mutation(internal.progression.hugRewards.payHugGiven, { event: { ...hugGiven(dana), message: { ...message, message: "1760349700.000100" } } });
    await t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(bob, carol, { rewards: false }) });
    await t.mutation(internal.progression.hugRewards.payHugReceived, { event: hugReceived(dana, carol) });

    expect({ bob: await xpOf(t, bob), carol: await xpOf(t, carol), dana: await xpOf(t, dana) }).toEqual({ bob: 1, carol: 2, dana: 1 });
  });
});

function backendWith(flag: FlagDefinition) {
  return testBackendServing(flagsOnForEveryone(new FakeSlack().fetch), flag);
}

function hugGiven(giver: MemberId, rewarded: Pick<HugGivenEvent, "rewards"> = {}): HugGivenEvent {
  return { type: "hugGiven", workspace: "T1", giver, message, onKudos: true, at, day: "2026-10-13", first: false, reaction: "taco", ...rewarded };
}

function hugReceived(giver: MemberId, person: MemberId, rewarded: Pick<HugReceivedEvent, "rewards"> = {}): HugReceivedEvent {
  return { type: "hugReceived", workspace: "T1", giver, person, message, at, week: "2026-10-12", ...rewarded };
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
