import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { dailyQuestKey } from "../convex/lib/quests";
import { mulberry32 } from "../convex/lib/random";
import { seedTeam, setupConvex, signInAs } from "./helpers";

/**
 * Quest pay property test (#93): random histories of thoughtful, thin and thank-back kudos over three
 * quest weeks, with revokes, go through the real Slack path with the game and quests on and every
 * member already at level 5. Afterwards the ledger must match an independent recompute from what
 * survived, written from the spec (§G3, G4, G11) rather than from the code:
 *
 * - every surviving weekly completion paid 20 XP + 5 Hog coins, every daily one 10 XP + 2 coins, and
 *   every week still swept 30 XP, exactly once, and nothing else was paid;
 * - each player's XP and coins are their starting XP plus their events, and the wallet's quest
 *   coins are 5 per weekly and 2 per daily completion;
 * - a daily completion only stands while that day's surviving kudos still meet its goal, and
 *   without revokes, exactly on the days they do.
 */

afterEach(() => vi.useRealTimers());

const HOUR = 3_600_000;
const START_XP = 350; // level 5
const PEOPLE = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE"];
const NOTES = ["", "thanks", "thanks for the review", "thanks for staying late to fix the release pipeline, it saved our whole demo today"];

async function run(seed: number, revokes: boolean) {
  const random = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const t = setupConvex();
  const team = await seedTeam(t, { gameEnabled: true, questsEnabled: true, receivedVisibility: "everyone" });
  const extra = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
  const ids: Record<string, Id<"members">> = { UANA: team.ana, UBEN: team.ben, UCLEO: team.cleo, UDAN: await extra("UDAN", "Dan"), UEVE: await extra("UEVE", "Eve") };
  for (const id of Object.values(ids)) {
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: id, since: Date.now() - 1000, xp: START_XP, level: 5, coins: 0 }));
  }
  const admin = await signInAs(t, team.ana);
  let ts = 1;
  for (let i = 0; i < 45; i++) {
    vi.setSystemTime(Date.now() + (random() < 0.7 ? random() * 4 * HOUR : random() * 30 * HOUR));
    if (revokes && random() < 0.15) {
      const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
      if (rows.length > 0) await admin.mutation(api.admin.revoke, { kudosId: pick(rows)._id });
      continue;
    }
    const giver = pick(PEOPLE);
    const others = PEOPLE.filter((p) => p !== giver);
    const recipients = random() < 0.3 ? [pick(others), pick(others)] : [pick(others)];
    await t.mutation(internal.kudos.ingestMessage, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      giverSlackId: giver,
      text: `${[...new Set(recipients)].map((p) => `<@${p}>`).join(" ")} :taco: ${pick(NOTES)}`,
      channelId: pick(["C1", "C2", "C3"]),
      messageTs: `${ts++}.0001`,
    });
  }
  const state = await t.run(async (ctx) => ({
    kudos: await ctx.db.query("kudos").collect(),
    weekly: await ctx.db.query("questCompletions").collect(),
    daily: await ctx.db.query("dailyQuestCompletions").collect(),
    events: (await ctx.db.query("gameEvents").collect()).filter((e) => e.kind === "quest"),
    allEvents: await ctx.db.query("gameEvents").collect(),
    players: await ctx.db.query("players").collect(),
  }));
  return { t, team, ids, ...state };
}

/** Whether a member's surviving kudos on a day meet a daily quest, from the spec's wording. */
function dailyMet(key: string, member: Id<"members">, dayKey: string, kudos: Doc<"kudos">[]) {
  const qualifying = kudos.filter(
    (k) =>
      k.giverId === member &&
      k.dayKey === dayKey &&
      (k.noteWords ?? 0) >= 3 &&
      // not a thank-back: the receiver gave them kudos in the 72 h before
      !kudos.some((b) => b.giverId === k.receiverId && b.receiverId === member && b.at < k.at && b.at > k.at - 72 * HOUR),
  );
  switch (key) {
    case "thoughtful":
      return qualifying.length >= 1;
    case "detail":
      return qualifying.some((k) => (k.noteWords ?? 0) >= 12);
    case "wider":
      return qualifying.some((k) => {
        const before = kudos.filter((b) => b.giverId === member && b.receiverId === k.receiverId && b.at < k.at).map((b) => b.at);
        return before.length === 0 || k.at - Math.max(...before) >= 30 * 24 * HOUR;
      });
    case "two":
      return new Set(qualifying.map((k) => k.receiverId)).size >= 2;
  }
  throw new Error(`unknown daily quest ${key}`);
}

async function check(seed: number, revokes: boolean) {
  const { team, weekly, daily, events, allEvents, players, kudos } = await run(seed, revokes);
  // Every quest payment matches exactly one surviving completion, and the other way round.
  const paidWeekly = events.filter((e) => e.quest?.scope === "weekly").map((e) => e.completionId).sort();
  const paidDaily = events.filter((e) => e.quest?.scope === "daily").map((e) => e.completionId).sort();
  expect(paidWeekly).toEqual(weekly.map((c) => c._id).sort());
  expect(paidDaily).toEqual(daily.map((c) => c._id).sort());
  // A clean sweep is paid at most once a week, on a surviving, paid completion of that week; without
  // revokes, exactly for the weeks that are swept.
  const sweepPay = events.filter((e) => e.quest?.scope === "sweep");
  const paidWeeks = sweepPay.map((e) => `${e.memberId}:${e.quest!.key}`);
  expect(new Set(paidWeeks).size).toBe(paidWeeks.length);
  for (const e of sweepPay) {
    const holder = weekly.find((c) => c._id === e.completionId);
    expect(holder && `${holder.memberId}:${holder.weekKey}`).toBe(`${e.memberId}:${e.quest!.key}`);
  }
  const sweptWeeks = weekly.filter((c) => c.sweep).map((c) => `${c.memberId}:${c.weekKey}`).sort();
  if (!revokes) expect([...paidWeeks].sort()).toEqual(sweptWeeks);
  for (const e of events) {
    const pay = { weekly: [20, 5], daily: [10, 2], sweep: [30, 0] }[e.quest!.scope];
    expect([e.xp, e.coins]).toEqual(pay);
  }

  for (const p of players) {
    const mine = allEvents.filter((e) => e.memberId === p.memberId);
    const w = weekly.filter((c) => c.memberId === p.memberId).length;
    const d = daily.filter((c) => c.memberId === p.memberId).length;
    const s = sweepPay.filter((e) => e.memberId === p.memberId).length;
    const questXp = 20 * w + 10 * d + 30 * s;
    const kudosXp = mine.filter((e) => e.kind !== "quest").reduce((sum, e) => sum + e.xp, 0);
    expect(p.xp).toBe(START_XP + kudosXp + questXp);
    expect(p.questCoins ?? 0).toBe(5 * w + 2 * d);
    expect(p.coins).toBe(mine.reduce((sum, e) => sum + (e.coins ?? 0), 0));
  }

  // Daily quests stand only where the day's surviving kudos meet them; without revokes, everywhere they do.
  for (const c of daily) {
    expect(c.questKey).toBe(dailyQuestKey(team.workspaceId, c.dayKey));
    expect(dailyMet(c.questKey, c.memberId, c.dayKey, kudos)).toBe(true);
  }
  if (!revokes) {
    const days = new Set(kudos.map((k) => `${k.giverId}|${k.dayKey}`));
    for (const md of days) {
      const [member, dayKey] = md.split("|") as [Id<"members">, string];
      const met = dailyMet(dailyQuestKey(team.workspaceId, dayKey), member, dayKey, kudos);
      expect(daily.some((c) => c.memberId === member && c.dayKey === dayKey)).toBe(met);
    }
  }
  return { weekly: weekly.length, daily: daily.length, sweeps: sweptWeeks.length };
}

describe("quest XP and Hog coins match an independent recompute", () => {
  for (let seed = 1; seed <= 8; seed++) {
    test(`random history with revokes #${seed}`, async () => {
      const seen = await check(seed, true);
      expect(seen.weekly + seen.daily).toBeGreaterThan(0);
    });
  }
  for (let seed = 101; seed <= 104; seed++) {
    test(`random history without revokes #${seed}`, async () => {
      await check(seed, false);
    });
  }
});

/**
 * Members climbing from level 1 through level 5 on real history (the level gate at work): a rebuild
 * of every member writes exactly the ledger the live path wrote, quest payments included.
 */
describe("a rebuild writes exactly what the live path wrote, climbing through level 5", () => {
  for (const seed of [7, 11, 23]) {
    test(`random history #${seed}`, async () => {
      const random = mulberry32(seed);
      const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
      const t = setupConvex();
      const team = await seedTeam(t, { gameEnabled: true, questsEnabled: true, receivedVisibility: "everyone" });
      const people = ["UANA", "UBEN", "UCLEO"];
      for (let i = 0; i < 5; i++) {
        people.push(`UX${i}`);
        await t.run((ctx) =>
          ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `UX${i}`, name: `X${i}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
        );
      }
      let ts = 1;
      for (let i = 0; i < 260; i++) {
        vi.setSystemTime(Date.now() + random() * 6 * HOUR);
        const giver = random() < 0.5 ? "UANA" : pick(people);
        const others = people.filter((p) => p !== giver);
        const recipients = [...new Set(random() < 0.3 ? [pick(others), pick(others)] : [pick(others)])];
        await t.mutation(internal.kudos.ingestMessage, {
          workspaceId: team.workspaceId,
          botUserId: "UBOT",
          giverSlackId: giver,
          text: `${recipients.map((p) => `<@${p}>`).join(" ")} :taco: ${pick(NOTES.slice(1).concat(NOTES))}`,
          channelId: pick(["C1", "C2", "C3"]),
          messageTs: `${ts++}.0001`,
        });
      }
      const norm = (e: Doc<"gameEvents">) =>
        JSON.stringify([e.memberId, e.kind, e.batchId, e.dayKey, e.at, e.xp, e.coins ?? 0, e.quest ?? null, e.completionId ?? null]);
      const snapshot = async () => ({
        events: (await t.run((ctx) => ctx.db.query("gameEvents").collect())).map(norm).sort(),
        players: (await t.run((ctx) => ctx.db.query("players").collect())).map((p) => [p.memberId, p.xp, p.level, p.coins ?? 0, p.questCoins ?? 0]).sort(),
      });
      const live = await snapshot();
      expect(live.events.filter((e) => e.includes('"quest"')).length).toBeGreaterThan(0);
      for (const m of await t.run((ctx) => ctx.db.query("members").collect())) {
        if (!m.isBot) await t.mutation(internal.game.rebuildMember, { memberId: m._id });
      }
      expect(await snapshot()).toEqual(live);
    });
  }
});
