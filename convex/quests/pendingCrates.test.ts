import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";
import { unopenedCratesOf } from "./weekly";

const now = Date.parse("2026-10-14T10:00:00Z");
const twoWeeksAgo = "2026-09-28";
const lastWeek = "2026-10-05";
const thisWeek = "2026-10-12";
const reward = { xp: 20, coins: 0, item: null };

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P85: the pending-crate index lists every crate still waiting, within Convex's limits", () => {
  test("the backfill lists every earlier, unopened weekly crate, oldest first, across pages, and a second run adds nothing", async () => {
    const { t, alice } = await workspace();
    await drawn(t, alice, twoWeeksAgo, ["say-why", "say-why-twice"]);
    await drawn(t, alice, lastWeek, ["say-why-three-times", "someone-new"]);
    await drawn(t, alice, thisWeek, ["say-why"]);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:0`, Date.parse("2026-10-06T10:00:00Z"));
    await finishedBeforeTheIndex(t, alice, `weekly:${twoWeeksAgo}:1`, Date.parse("2026-09-29T10:00:00Z"));
    await finishedBeforeTheIndex(t, alice, `weekly:${thisWeek}:0`, now);
    await finishedBeforeTheIndex(t, alice, "journey:first-thanks", now);
    await openedBeforeTheIndex(t, alice, lastWeek, 150);

    await backfill(t);
    await backfill(t);

    expect(await waitingFor(t, alice)).toEqual([
      { crate: { kind: "weekly", week: twoWeeksAgo, slot: 1 }, goal: "Thank someone and say why, 2 times.", reward, finishedAt: Date.parse("2026-09-29T10:00:00Z") },
      { crate: { kind: "weekly", week: lastWeek, slot: 0 }, goal: "Thank someone and say why, 3 times.", reward, finishedAt: Date.parse("2026-10-06T10:00:00Z") },
    ]);
    expect(await t.run(async (ctx) => (await ctx.db.query("pendingCrates").collect()).map(({ key }) => key).sort())).toEqual([
      `weekly:${twoWeeksAgo}:1`,
      `weekly:${lastWeek}:0`,
      `weekly:${thisWeek}:0`,
    ]);
  });
});

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const alice = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));
  return { t, alice };
}

function drawn(t: Backend, member: MemberId, week: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  return t.run((ctx) => ctx.db.insert("questDraws", { member, week, drawnAt: Date.parse(`${week}T00:00:00Z`), slots }));
}

function finishedBeforeTheIndex(t: Backend, member: MemberId, key: string, at: number) {
  return t.run((ctx) => ctx.db.insert("rewardRecords", { member, key, ...reward, catalogueVersion: "1", at }));
}

function openedBeforeTheIndex(t: Backend, member: MemberId, week: string, crates: number) {
  return t.run(async (ctx) => {
    for (let slot = 100; slot < 100 + crates; slot++) {
      const key = `weekly:${week}:${slot}`;
      await ctx.db.insert("rewardRecords", { member, key, ...reward, catalogueVersion: "1", at: now });
      await ctx.db.insert("crateOpenings", { member, key, at: now });
    }
  });
}

async function backfill(t: Backend) {
  await t.mutation(internal.quests.pendingCrates.backfillPendingCrates, {});
  await settle(t);
}

function waitingFor(t: Backend, member: MemberId) {
  return t.run((ctx) => unopenedCratesOf(ctx, member, Date.now()));
}
