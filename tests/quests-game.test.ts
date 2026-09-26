import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { DAILY_QUEST_BY_KEY, dailyQuestKey, type QuestKey } from "../convex/lib/quests";
import { earningsText } from "../convex/lib/xp";
import { all, claimAtTree, seedTeam, setupConvex, signInAs, type Team, TODAY } from "./helpers";

/**
 * Quests on the game ladder (#93, game spec #55 §G11): with the game on, the weekly board and the
 * daily quest open at level 5 and pay XP and Hog coins; below it they are visible but locked. With
 * the game off, quests behave as before under their own switch.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

afterEach(() => vi.useRealTimers());

/** NOW (Wed 2026-09-23) falls in the quest week starting Monday 2026-09-21. */
const WEEK = "2026-09-21";

async function setup(settings: Partial<Doc<"workspaces">>) {
  t = setupConvex();
  team = await seedTeam(t, settings);
}

let ts = 1000;
async function message(giver: string, text: string, channel = "general") {
  const result = await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: `C${channel.toUpperCase()}`,
    channelName: channel,
    messageTs: `${ts++}.0001`,
  });
  vi.setSystemTime(Date.now() + 60_000);
  return result;
}

const setBoard = (questKeys: QuestKey[], weekKey = WEEK) =>
  t.run((ctx) => ctx.db.insert("questBoards", { workspaceId: team.workspaceId, weekKey, questKeys }));

/** Makes a member a player at a level (the XP its floor), as if they had played for a while. */
const playerAt = (memberId: Id<"members">, level: number, xp: number) =>
  t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now() - 1000, xp, level, coins: 0 }));

/** A member's player row, once they have claimed the coins waiting for them at the tree (#157). */
async function player(memberId: Id<"members">) {
  await claimAtTree(t, memberId);
  return await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());
}
const questEvents = async (memberId: Id<"members">) => (await all(t, "gameEvents")).filter((e) => e.memberId === memberId && e.kind === "quest");
const completions = async (memberId: Id<"members">) => (await all(t, "questCompletions")).filter((c) => c.memberId === memberId);
const dailies = (memberId: Id<"members">) =>
  t.run(async (ctx) => (await ctx.db.query("dailyQuestCompletions").collect()).filter((c) => c.memberId === memberId));

async function mine(memberId: Id<"members">, today = TODAY) {
  return await (await signInAs(t, memberId)).query(api.quests.mine, { today });
}

/** A kudos that meets every daily quest at once: 12+ words, two people Ana never thanked. */
const EVERY_DAILY = "<@UBEN> <@UCLEO> :taco: thanks for staying late to fix the release pipeline, it saved our whole demo today";
/** One thoughtful kudos to Ben (New connection on a fresh board). */
const TO_BEN = "<@UBEN> :taco: thanks for the thorough review";

describe("with the game on, quests open at level 5", () => {
  test("below level 5 the board and the daily quest are visible but locked, and nothing progresses or pays", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", EVERY_DAILY);

    expect(await completions(team.ana)).toHaveLength(0);
    expect(await dailies(team.ana)).toHaveLength(0);
    expect(await questEvents(team.ana)).toHaveLength(0);
    const board = await mine(team.ana);
    expect(board).toMatchObject({ enabled: true, locked: { level: 5 }, completed: 0, sweep: false });
    if (!board.enabled) throw new Error("unreachable");
    expect(board.quests.map((q) => [q.key, q.status, q.progress])).toEqual([
      ["fresh", "active", 0],
      ["spread", "active", 0],
      ["channels", "active", 0],
    ]);
    const daily = DAILY_QUEST_BY_KEY[dailyQuestKey(team.workspaceId, TODAY)];
    expect(board.daily).toMatchObject({ key: daily.key, title: daily.title, status: "active", progress: 0 });
    expect(board.rewards).toEqual({ weekly: { xp: 20, coins: 5 }, daily: { xp: 10, coins: 2 }, sweep: { xp: 30, coins: 0 } });
  });

  test("at level 5 a weekly quest pays 20 XP and 5 Hog coins, shown in the earnings reply", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 400);
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");

    expect((await completions(team.ana)).map((c) => c.questKey)).toEqual(["fresh"]);
    const weekly = (await questEvents(team.ana)).filter((e) => e.quest?.scope === "weekly");
    expect(weekly).toMatchObject([{ xp: 20, coins: 5, quest: { scope: "weekly", key: "fresh" } }]);
    const reply = (await all(t, "notifications")).find((n) => n.category === "giver_success")!;
    expect(reply.earnings?.quests).toContainEqual({ scope: "weekly", title: "New connection", xp: 20, coins: 5 });
    expect(earningsText(reply.earnings!)).toContain("New connection done +20 XP +5 Hog coins");
    // The kudos' own XP (10 + new connection 10) plus the quest's, and its coin plus the quest's.
    const daily = (await questEvents(team.ana)).filter((e) => e.quest?.scope === "daily");
    const dailyXp = daily.reduce((s, e) => s + e.xp, 0);
    expect(await player(team.ana)).toMatchObject({ xp: 400 + 20 + 20 + dailyXp, coins: 1 + 5 + 2 * daily.length, questCoins: 5 + 2 * daily.length });
  });

  test("a level reached through quest pay is told in the same event's DM, not a second one (#99 gains)", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 575); // level 6 at 600: the kudos (+20) and New connection (+20) cross it
    await message("UANA", TO_BEN);
    expect(await player(team.ana)).toMatchObject({ level: 6 });
    const mine = (await all(t, "notifications")).filter((n) => n.memberId === team.ana);
    const told = mine.filter((n) => (n.gains ?? []).some((g) => g.kind === "level_up"));
    expect(told).toHaveLength(1);
    expect(mine.filter((n) => n.category === "gains")).toHaveLength(0);
  });

  test("the daily quest pays 10 XP and 2 Hog coins once a day, and says so in the reply", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["steady", "story", "fresh"]);
    await playerAt(team.ana, 5, 400);
    await message("UANA", EVERY_DAILY);
    await message("UANA", EVERY_DAILY);

    const key = dailyQuestKey(team.workspaceId, TODAY);
    expect(await dailies(team.ana)).toMatchObject([{ dayKey: TODAY, questKey: key }]);
    expect((await questEvents(team.ana)).filter((e) => e.quest?.scope === "daily")).toMatchObject([{ xp: 10, coins: 2, quest: { key } }]);
    const replies = (await all(t, "notifications")).filter((n) => n.category === "giver_success");
    expect(replies[0].earnings?.quests).toContainEqual({ scope: "daily", title: DAILY_QUEST_BY_KEY[key].title, xp: 10, coins: 2 });
    expect(replies[1].earnings?.quests ?? []).not.toContainEqual(expect.objectContaining({ scope: "daily" }));
    const board = await mine(team.ana);
    expect(board).toMatchObject({ enabled: true, locked: null, daily: { key, status: "done", progress: DAILY_QUEST_BY_KEY[key].goal } });
  });

  test("a clean sweep pays 30 XP more, and no coins", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]); // Spread the love is waived: only two teammates
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN, "general");
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing", "random");

    const events = await questEvents(team.ana);
    expect(events.filter((e) => e.quest?.scope === "weekly")).toHaveLength(2);
    expect(events.filter((e) => e.quest?.scope === "sweep")).toMatchObject([{ xp: 30, coins: 0, quest: { key: WEEK } }]);
    const last = (await all(t, "notifications")).filter((n) => n.category === "giver_success").at(-1)!;
    expect(last.earnings?.quests).toContainEqual({ scope: "sweep", title: "Clean sweep", xp: 30, coins: 0 });
  });

  test("revoking the kudos that completed quests takes back exactly their XP and coins", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN, "general");
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing", "random");
    expect((await questEvents(team.ana)).length).toBeGreaterThanOrEqual(3);

    const admin = await signInAs(t, team.ana);
    for (const k of await all(t, "kudos")) await admin.mutation(api.admin.revoke, { kudosId: k._id });

    expect(await completions(team.ana)).toHaveLength(0);
    expect(await dailies(team.ana)).toHaveLength(0);
    expect(await questEvents(team.ana)).toHaveLength(0);
    expect(await player(team.ana)).toMatchObject({ xp: 400, level: 5, coins: 0, questCoins: 0 });
  });

  test("revoking a kudos that other giving still covers keeps the quest and its pay", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["steady", "story", "fresh"]);
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN);
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing");
    const before = await player(team.ana);
    const first = (await all(t, "kudos"))[0];
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: first._id });

    // New connection still holds through Cleo; the daily quest may or may not (it depends on the draw).
    expect((await completions(team.ana)).map((c) => c.questKey)).toEqual(["fresh"]);
    expect((await questEvents(team.ana)).filter((e) => e.quest?.scope === "weekly")).toMatchObject([{ quest: { key: "fresh" } }]);
    // The player's XP and coins are exactly what their surviving events add up to.
    const events = (await all(t, "gameEvents")).filter((e) => e.memberId === team.ana);
    const after = (await player(team.ana))!;
    expect(after.xp).toBe(400 + events.reduce((s, e) => s + e.xp, 0));
    expect(after.coins).toBe(events.reduce((s, e) => s + (e.coins ?? 0), 0));
    expect(after.coins).toBeLessThan(before!.coins!);
  });
});

describe("quest coins in the Store (#91)", () => {
  test("spend like any coins; a revoke takes them back, the balance can go negative and blocks the next purchase", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 400);
    // The level-up coins are already spent, so everything left comes from this one kudos.
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsSpent: 40 }));
    await message("UANA", EVERY_DAILY);
    await claimAtTree(t, team.ana); // the kudos' coins, offered at the tree (#157)
    const ana = await signInAs(t, team.ana);
    const shop = async () => {
      const s = await ana.query(api.store.shop, { today: TODAY });
      if (s.access !== "open") throw new Error(`the shop is ${s.access}`);
      return s;
    };
    const wallet = async () => (await ana.query(api.game.mine, {})).wallet!;

    // 2 coins for the kudos, 5 for New connection, 2 for the daily quest: quests paid most of it.
    expect(await wallet()).toMatchObject({ fromKudos: 2, fromQuests: 7, balance: 9 });
    expect((await shop()).balance).toBe(9);
    expect(await ana.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 })).toEqual({ balance: 1 });

    // The message thanked two people: revoking both takes back the kudos and every quest it completed.
    for (const k of await all(t, "kudos")) await ana.mutation(api.admin.revoke, { kudosId: k._id });
    expect(await wallet()).toMatchObject({ fromKudos: 0, fromQuests: 0, spent: 48, balance: -8 });
    expect((await shop()).balance).toBe(-8);
    await expect(ana.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 })).rejects.toThrow();
    const coins = await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UANA", text: "coins" });
    expect(coins.text).toBe("You have -8 Hog coins.");
    expect(JSON.stringify(coins.blocks)).toContain("A revoked kudos took back coins it had earned.");
  });
});

describe("a clean sweep's pay only goes back with a revoke (review of #93)", () => {
  const sweeps = async () => (await questEvents(team.ana)).filter((e) => e.quest?.scope === "sweep");
  const newTeammate = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );

  test("a board that reopens because teammates joined keeps its sweep's 30 XP", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]); // Spread the love is waived: only two teammates
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN, "general");
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing", "random");
    expect(await sweeps()).toHaveLength(1);
    const before = (await player(team.ana))!;

    // Two new hires make Spread the love possible again; nothing is revoked.
    await newTeammate("UDAN", "Dan");
    await newTeammate("UEVE", "Eve");
    await message("UANA", "<@UBEN> :taco: thanks again for the help today", "general");
    expect(await sweeps()).toHaveLength(1);
    expect((await player(team.ana))!.xp).toBeGreaterThanOrEqual(before.xp);
  });

  test("a revoke never pays a sweep, even one that leaves the board swept, and never while the game is off", async () => {
    await setup({ gameEnabled: true });
    const dan = await newTeammate("UDAN", "Dan");
    await setBoard(["fresh", "spread", "channels"]); // three teammates: Spread the love is open
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN, "general");
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing", "random");
    await message("UANA", "<@UBEN> :taco: thanks again for everything today", "general");
    expect(await sweeps()).toHaveLength(0);

    // Dan leaves, so Spread the love is waived and the board counts as swept; then the game goes off.
    await t.run(async (ctx) => {
      await ctx.db.patch(dan, { deactivated: true });
      await ctx.db.patch(team.workspaceId, { gameEnabled: false, gamePauses: [{ from: Date.now() }] });
    });
    const before = (await player(team.ana))!;
    const questXp = async () => (await questEvents(team.ana)).reduce((s, e) => s + e.xp, 0);
    const questXpBefore = await questXp();
    const last = (await all(t, "kudos")).at(-1)!;
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: last._id });
    expect(await sweeps()).toHaveLength(0);
    // Only the revoked kudos' own XP went back; no quest pay was added.
    expect(await questXp()).toBe(questXpBefore);
    const events = (await all(t, "gameEvents")).filter((e) => e.memberId === team.ana);
    expect((await player(team.ana))!.xp).toBe(400 + events.reduce((s, e) => s + e.xp, 0));
    expect((await player(team.ana))!.xp).toBeLessThan(before.xp);
  });

  test("the sweep's pay goes back with the completion it was paid on, and survives revokes the board doesn't feel", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]); // Spread the love waived
    await playerAt(team.ana, 5, 400);
    await message("UANA", TO_BEN, "general");
    await message("UANA", "<@UCLEO> :taco: thanks for the design pairing", "random"); // Channel hopper: the sweep
    await message("UANA", "<@UCLEO> :taco: and thanks for the second look", "random");
    expect(await sweeps()).toHaveLength(1);
    const admin = await signInAs(t, team.ana);
    const kudos = await all(t, "kudos");
    // The third kudos isn't needed by any quest: the sweep stays paid.
    await admin.mutation(api.admin.revoke, { kudosId: kudos[2]._id });
    expect(await sweeps()).toHaveLength(1);
    // Without the second, Channel hopper is no longer met: its completion and the sweep go back.
    await admin.mutation(api.admin.revoke, { kudosId: kudos[1]._id });
    expect((await completions(team.ana)).map((c) => c.questKey)).toEqual(["fresh"]);
    expect(await sweeps()).toHaveLength(0);
    const events = (await all(t, "gameEvents")).filter((e) => e.memberId === team.ana);
    expect((await player(team.ana))!.xp).toBe(400 + events.reduce((s, e) => s + e.xp, 0));
  });
});

describe("the game on/off × quests on/off matrix", () => {
  test("game off, quests on: quests behave as before, at any level, and pay nothing", async () => {
    await setup({ gameEnabled: false, questsEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", EVERY_DAILY);

    expect((await completions(team.ana)).map((c) => c.questKey)).toEqual(["fresh"]);
    expect(await dailies(team.ana)).toHaveLength(0);
    expect(await all(t, "gameEvents")).toHaveLength(0);
    const board = await mine(team.ana);
    expect(board).toMatchObject({ enabled: true, locked: null, daily: null, rewards: null, completed: 1 });
    // The Quest message is still collected and sent.
    expect((await all(t, "notifications")).filter((n) => n.category === "quest_complete")).toHaveLength(1);
  });

  test("game on, quests off: no board, no daily quest, nothing pays", async () => {
    await setup({ gameEnabled: true, questsEnabled: false });
    await playerAt(team.ana, 5, 400);
    await message("UANA", EVERY_DAILY);

    expect(await completions(team.ana)).toHaveLength(0);
    expect(await dailies(team.ana)).toHaveLength(0);
    expect(await questEvents(team.ana)).toHaveLength(0);
    expect(await mine(team.ana)).toEqual({ enabled: false });
  });

  test("game off, quests off: nothing at all", async () => {
    await setup({ gameEnabled: false, questsEnabled: false });
    await message("UANA", EVERY_DAILY);
    expect(await completions(team.ana)).toHaveLength(0);
    expect(await dailies(team.ana)).toHaveLength(0);
    expect(await all(t, "gameEvents")).toHaveLength(0);
    expect(await mine(team.ana)).toEqual({ enabled: false });
  });

  test("game on, quests on, at level 5: both the board and the daily quest play", async () => {
    await setup({ gameEnabled: true, questsEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 400);
    await message("UANA", EVERY_DAILY);
    expect(await completions(team.ana)).toHaveLength(1);
    expect(await dailies(team.ana)).toHaveLength(1);
  });
});

describe("hiding the game", () => {
  test("quests keep paying silently, but their surfaces and Quest message DMs go away with the rest of the game", async () => {
    await setup({ gameEnabled: true });
    await setBoard(["fresh", "spread", "channels"]);
    await playerAt(team.ana, 5, 400);
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await message("UANA", TO_BEN);

    expect(await completions(team.ana)).toHaveLength(1);
    expect((await questEvents(team.ana)).length).toBeGreaterThan(0);
    expect(await mine(team.ana)).toEqual({ enabled: false, hidden: true });
    const quest = (await all(t, "notifications")).find((n) => n.category === "quest_complete")!;
    expect(quest.delivery).toBe("skipped");
  });
});

describe("the rebuild pays quests from the stored completions", () => {
  test("switching the game on pays completions made at level 5 or above, and none made below", async () => {
    await setup({ gameEnabled: false });
    await setBoard(["fresh", "spread", "channels"]);
    await message("UANA", TO_BEN); // level 1 when the game replays it: stays unpaid
    await t.run(async (ctx) => {
      const ws = (await ctx.db.get(team.workspaceId))!;
      await ctx.db.patch(ws._id, { gameEnabled: true });
    });
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect(await questEvents(team.ana)).toHaveLength(0);
    expect(await completions(team.ana)).toHaveLength(1);
  });

  test("a replay pays what was completed once its kudos had reached level 5, and a clean sweep with it", async () => {
    await setup({ gameEnabled: true });
    const DAY = 86_400_000;
    const start = Date.now() - 20 * DAY;
    // Ten days of three thoughtful kudos to people Ana never thanked: 50 XP a day (the cap).
    const people = await t.run(async (ctx) => {
      const ids: Id<"members">[] = [];
      for (let i = 0; i < 30; i++) {
        ids.push(
          await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `UP${i}`, name: `P${i}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
        );
      }
      for (let d = 0; d < 10; d++) {
        for (let j = 0; j < 3; j++) {
          const at = start + d * DAY + j * 60_000;
          const dayKey = new Date(at).toISOString().slice(0, 10);
          await ctx.db.insert("kudos", {
            workspaceId: team.workspaceId,
            batchId: `b${d}:${j}`,
            giverId: team.ana,
            receiverId: ids[d * 3 + j],
            amount: 1,
            dayKey,
            source: "message",
            channelId: "C1",
            text: "thanks for staying late to fix the release pipeline, it saved our whole demo today",
            at,
            hour: 10,
            noteWords: 16,
          });
        }
      }
      return ids;
    });
    const early = start + 60_000; // day 1: level 1 in the replay
    const late = start + 9 * DAY + 3 * 60_000; // day 10: 450 XP, level 5
    const lateDay = new Date(late).toISOString().slice(0, 10);
    const ids = await t.run(async (ctx) => ({
      early: await ctx.db.insert("questCompletions", { workspaceId: team.workspaceId, memberId: team.ana, weekKey: "2026-08-31", questKey: "fresh", completedAt: early, sweep: false }),
      late: await ctx.db.insert("questCompletions", { workspaceId: team.workspaceId, memberId: team.ana, weekKey: "2026-09-07", questKey: "story", completedAt: late, sweep: true }),
      daily: await ctx.db.insert("dailyQuestCompletions", { workspaceId: team.workspaceId, memberId: team.ana, dayKey: lateDay, questKey: "thoughtful", completedAt: late }),
    }));
    expect(people).toHaveLength(30);

    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    const paid = (await questEvents(team.ana)).map((e) => [e.quest?.scope, e.completionId ?? e.quest?.key, e.xp, e.coins]);
    expect(paid.sort()).toEqual(
      [
        ["daily", ids.daily, 10, 2],
        ["sweep", ids.late, 30, 0],
        ["weekly", ids.late, 20, 5],
      ].sort(),
    );
    const kudosXp = (await all(t, "gameEvents")).filter((e) => e.memberId === team.ana && e.kind === "give").reduce((s, e) => s + e.xp, 0);
    expect(kudosXp).toBe(500);
    expect(await player(team.ana)).toMatchObject({ xp: 500 + 60, questCoins: 7, coins: 30 + 7 });
  });
});
