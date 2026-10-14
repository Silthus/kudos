import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
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
  test("the backfill has written every page when it returns, so the read lists every earlier, unopened weekly crate once, oldest first, and drops a stale row of an opened crate", async () => {
    const { t, alice } = await workspace();
    await drawn(t, alice, twoWeeksAgo, ["say-why", "say-why-twice"]);
    await drawn(t, alice, lastWeek, ["say-why-three-times", "someone-new"]);
    await drawn(t, alice, thisWeek, ["say-why"]);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:0`, Date.parse("2026-10-06T10:00:00Z"));
    await finishedBeforeTheIndex(t, alice, `weekly:${twoWeeksAgo}:1`, Date.parse("2026-09-29T10:00:00Z"));
    await finishedBeforeTheIndex(t, alice, `weekly:${thisWeek}:0`, now);
    await finishedBeforeTheIndex(t, alice, "journey:first-thanks", now);
    await openedBeforeTheIndex(t, alice, lastWeek, 150);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:1`, Date.parse("2026-10-08T10:00:00Z"));
    await indexed(t, alice, `weekly:${twoWeeksAgo}:1`);
    await indexed(t, alice, `weekly:${lastWeek}:100`);

    await backfill(t);
    const waiting = await waitingFor(t, alice);

    expect(waiting).toEqual([
      { crate: { kind: "weekly", week: twoWeeksAgo, slot: 1 }, week: twoWeeksAgo, goal: "Thank someone and say why, 2 times.", reward, finishedAt: Date.parse("2026-09-29T10:00:00Z") },
      { crate: { kind: "weekly", week: lastWeek, slot: 0 }, week: lastWeek, goal: "Thank someone and say why, 3 times.", reward, finishedAt: Date.parse("2026-10-06T10:00:00Z") },
      { crate: { kind: "weekly", week: lastWeek, slot: 1 }, week: lastWeek, goal: "Thank someone you haven't thanked before.", reward, finishedAt: Date.parse("2026-10-08T10:00:00Z") },
    ]);
    expect(await t.run(async (ctx) => (await ctx.db.query("pendingCrates").collect()).map(({ key }) => key).sort())).toEqual([
      `weekly:${twoWeeksAgo}:1`,
      `weekly:${lastWeek}:0`,
      `weekly:${lastWeek}:1`,
      `weekly:${thisWeek}:0`,
    ]);
  });

  test("two earlier weeks that drew the same quest each list its crate with its own week", async () => {
    const { t, alice } = await workspace();
    await drawn(t, alice, twoWeeksAgo, ["say-why"]);
    await drawn(t, alice, lastWeek, ["say-why"]);
    await finishedWithTheIndex(t, alice, `weekly:${twoWeeksAgo}:0`, Date.parse("2026-09-29T10:00:00Z"));
    await finishedWithTheIndex(t, alice, `weekly:${lastWeek}:0`, Date.parse("2026-10-06T10:00:00Z"));

    expect((await waitingFor(t, alice)).map(({ goal, week }) => ({ goal, week }))).toEqual([
      { goal: "Thank someone and say why.", week: twoWeeksAgo },
      { goal: "Thank someone and say why.", week: lastWeek },
    ]);
  });

  test("the backfill runs once per deployment: once it finished, a later run reads no reward record and writes nothing", async () => {
    const { t, alice } = await workspace();
    await drawn(t, alice, lastWeek, ["say-why-three-times"]);
    await backfill(t);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:0`, Date.parse("2026-10-06T10:00:00Z"));

    await backfill(t);

    expect(await t.run((ctx) => ctx.db.query("pendingCrates").collect())).toEqual([]);
  });

  test("a restarted backfill scans again, so a crate finished or opened without the index since the last run is reconciled", async () => {
    const { t, alice } = await workspace();
    await drawn(t, alice, lastWeek, ["say-why-three-times", "someone-new"]);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:1`, Date.parse("2026-10-06T10:00:00Z"));
    await backfill(t);
    await finishedBeforeTheIndex(t, alice, `weekly:${lastWeek}:0`, Date.parse("2026-10-07T10:00:00Z"));
    await t.run((ctx) => ctx.db.insert("crateOpenings", { member: alice, key: `weekly:${lastWeek}:1`, at: now }));

    await t.action(internal.quests.pendingCrates.backfillPendingCrates, { restart: true });

    expect((await waitingFor(t, alice)).map(({ crate }) => crate)).toEqual([{ kind: "weekly", week: lastWeek, slot: 0 }]);
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

async function finishedWithTheIndex(t: Backend, member: MemberId, key: string, at: number) {
  await finishedBeforeTheIndex(t, member, key, at);
  await indexed(t, member, key);
}

function indexed(t: Backend, member: MemberId, key: string) {
  return t.run((ctx) => ctx.db.insert("pendingCrates", { member, key }));
}

async function backfill(t: Backend) {
  await t.action(internal.quests.pendingCrates.backfillPendingCrates, {});
}

function waitingFor(t: Backend, member: MemberId) {
  return t.run((ctx) => unopenedCratesOf(ctx, member, Date.now()));
}
