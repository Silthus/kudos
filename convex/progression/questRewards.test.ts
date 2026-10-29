import { describe, expect, test } from "vitest";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { QuestFinishedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";

const at = new Date("2026-10-13T10:00:00Z").getTime();

describe("HH23 HH24: Progression pays a quest's XP from questFinished", () => {
  test("a member who left is paid nothing, and nothing throws", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB", "not-a-member");

    await t.mutation(internal.progression.questRewards.payQuestFinished, { event: mondayFinish(bob) });

    expect(await rewardsOf(t, bob)).toEqual([]);
  });

  test("a finish without a reward key, as the unlock path publishes it, pays nothing", async () => {
    const t = testBackend();
    const bob = await member(t, "U_BOB", "member");
    const { rewardKey: _, catalogueVersion: __, ...unlockPathFinish } = mondayFinish(bob);

    await t.mutation(internal.progression.questRewards.payQuestFinished, { event: unlockPathFinish });

    expect(await rewardsOf(t, bob)).toEqual([]);
  });
});

function mondayFinish(member: MemberId): QuestFinishedEvent {
  return { type: "questFinished", workspace: "T1", member, quest: { kind: "journey", step: "first-thanks" }, rewardKey: "journey:first-thanks", reward: { xp: 50, coins: 0 }, catalogueVersion: "monday-1", at };
}

function member(t: Backend, user: string, kind: "member" | "not-a-member") {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind }));
}

function rewardsOf(t: Backend, member: MemberId) {
  return t.run((ctx) =>
    ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member))
      .collect(),
  );
}
