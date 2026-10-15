import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { everythingStored, testBackend, type Backend } from "../../testing/slackBackend";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";
import { applyHeldReward, recordReward, standingOf } from "./progression";
import type { RewardRecord } from "./rewards";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const finishedAt = new Date("2026-10-13T10:00:00Z").getTime();
const openedAt = finishedAt + 60_000;

beforeEach(() => {
  vi.useFakeTimers({ now: finishedAt });
  vi.mocked(publish).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CR2 CR3: a held reward counts only from its open", () => {
  test("recording a held reward writes only its record: no XP, level, skill point or coin, no event and no job", async () => {
    const { t, alice } = await withAlice();
    const before = await everythingStored(t, { except: ["rewardRecords"] });

    expect(await t.run((ctx) => recordReward(ctx, "T1", heldReward(alice)))).toBe("recorded");

    expect(await everythingStored(t, { except: ["rewardRecords"] })).toEqual(before);
    expect(await rewardRecordsOf(t)).toEqual([expect.objectContaining({ ...heldReward(alice) })]);
    expect(await standingAndBalanceOf(t, alice)).toEqual({ xp: 0, level: 1, skillPoints: 0, balance: 0 });
    expect(published()).toEqual([]);
    expect(await scheduledJobs(t)).toEqual([]);
  });

  test("applying it adds its XP and coins and publishes xpRecorded and one levelReached for the highest level crossed, without a kudos message", async () => {
    const { t, alice } = await withAlice();
    await t.run((ctx) => recordReward(ctx, "T1", heldReward(alice)));

    const applied = await t.run((ctx) => applyHeldReward(ctx, "T1", heldReward(alice), openedAt));

    expect(applied).toEqual({ xp: 300, coins: 10, from: { xp: 0, level: 1, coins: 0, skillPoints: 0 }, to: { xp: 300, level: 4, coins: 10, skillPoints: 0 } });
    expect(await standingAndBalanceOf(t, alice)).toEqual({ xp: 300, level: 4, skillPoints: 0, balance: 10 });
    expect(published()).toEqual([
      { type: "xpRecorded", workspace: "T1", member: alice, at: openedAt },
      { type: "levelReached", workspace: "T1", member: alice, level: 4, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 300, at: openedAt },
    ]);
  });

  test.each([
    ["a fraction of a coin", 0.5],
    ["negative coins", -1],
  ])("a held reward of %s is refused before its record is written", async (_, coins) => {
    const { t, alice } = await withAlice();
    const before = await everythingStored(t);

    await expect(t.run((ctx) => recordReward(ctx, "T1", { ...heldReward(alice), coins }))).rejects.toThrow("not a whole number of coins");

    expect(await everythingStored(t)).toEqual(before);
  });
});

async function withAlice() {
  const t = testBackend();
  const alice = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));
  return { t, alice };
}

function heldReward(member: MemberId): RewardRecord {
  return { member, key: "weekly:2026-10-12:0", xp: 300, coins: 10, item: null, catalogueVersion: "1", at: finishedAt, held: true };
}

function rewardRecordsOf(t: Backend) {
  return t.run((ctx) => ctx.db.query("rewardRecords").collect());
}

function standingAndBalanceOf(t: Backend, member: MemberId) {
  return t.run(async (ctx) => ({ ...(await standingOf(ctx, member)), balance: await balanceOf(ctx, member) }));
}

function scheduledJobs(t: Backend) {
  return t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

function published(): DomainEvent[] {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}
