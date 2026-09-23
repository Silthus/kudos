import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { giveKudos, revokeKudosRow } from "../convex/engine";
import { leaderboard } from "../convex/leaderboard";
import { weekStanding } from "../convex/slackData";
import { markBackfilled, rebuildMemberYear, rebuildWorkspaceDay, rebuildWorkspacePeriod } from "../convex/lib/rebuild";
import { mulberry32 } from "../convex/lib/random";
import { addDays } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// The leaderboard and the Slack App Home read the rollups once a workspace is backfilled
// (`rollupsBackfilledAt` on its `all` workspaceStats row), and the legacy memberDays scan before.

let t: ReturnType<typeof setupConvex>;
let team: Team;

const PERIODS = ["week", "month", "quarter", "year", "all"] as const;
const SLACK_IDS = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE", "UFINN", "UGIA"];

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility: "everyone" });
  await t.run(async (ctx) => {
    for (const [slackUserId, name] of [["UDAN", "Dan"], ["UEVE", "Eve"], ["UFINN", "Finn"], ["UGIA", "Gia"]]) {
      await ctx.db.insert("members", {
        workspaceId: team.workspaceId,
        slackUserId,
        name,
        isAdmin: false,
        isBot: false,
        deactivated: false,
        totalGiven: 0,
        totalReceived: 0,
        totalMaxedDays: 0,
      });
    }
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Two months of seeded random giving through the engine, a few revokes and a teammate who left. */
async function history() {
  const rand = mulberry32(27);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  let ts = 1;
  for (let day = "2026-07-27"; day <= "2026-09-23"; day = addDays(day, 1)) {
    const gives = Math.floor(rand() * 4);
    for (let i = 0; i < gives; i++) {
      const giver = pick(SLACK_IDS.slice(0, day < "2026-09-01" ? 7 : 6)); // Gia stops giving in September
      const recipients = [...new Set([pick(SLACK_IDS), pick(SLACK_IDS)])].filter((r) => r !== giver);
      if (recipients.length === 0) continue;
      vi.setSystemTime(new Date(`${day}T${String(6 + Math.floor(rand() * 12)).padStart(2, "0")}:15:00Z`));
      await t.run(async (ctx) => {
        await giveKudos(ctx, {
          workspace: (await ctx.db.get(team.workspaceId))!,
          giverSlackId: giver,
          recipientSlackIds: recipients,
          amountEach: 1 + Math.floor(rand() * 3),
          channelId: "CGENERAL",
          channelName: "general",
          text: "thanks for the help",
          source: rand() < 0.3 ? "reaction" : "message",
          messageTs: `${ts++}.000`,
          now: Date.now(),
        });
      });
    }
  }
  await t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId))!;
    const rows = await ctx.db.query("kudos").collect();
    for (const row of [rows[3], rows[40], rows[rows.length - 2]]) await revokeKudosRow(ctx, workspace, row);
    const eve = await ctx.db.query("members").withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", team.workspaceId).eq("slackUserId", "UEVE")).unique();
    await ctx.db.patch(eve!._id, { deactivated: true });
  });
}

async function rebuild() {
  await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
}

/** Days after the last activity where the current bucket to date and in full hold the same rows. */
const TODAYS = ["2026-09-23", "2026-09-27", "2026-09-30", "2026-10-01"];

async function boards(viewer: Awaited<ReturnType<typeof signInAs>>) {
  const out: Record<string, unknown> = {};
  for (const today of TODAYS) {
    for (const period of PERIODS) {
      for (const metric of ["given", "received"] as const) {
        out[`${today} ${period} ${metric}`] = await viewer.query(api.leaderboard.get, { period, metric, today });
      }
    }
  }
  return out;
}

async function deleteSources() {
  await t.run(async (ctx) => {
    for (const table of ["memberDays", "kudos", "discoveries"] as const) {
      for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id);
    }
  });
}

describe("the leaderboard on rollups", () => {
  test("matches the legacy computation exactly, for every period and metric", { timeout: 120_000 }, async () => {
    await history();
    const ana = await signInAs(t, team.ana);
    const legacy = await boards(ana);
    const sample = legacy["2026-09-23 month given"] as { rows: unknown[]; highlights: { discoveries: number; prevTotal: number } };
    expect(sample.rows.length).toBeGreaterThan(3);
    expect(sample.highlights.discoveries).toBeGreaterThan(0);

    await rebuild();
    // With the sources gone, only the rollups (and members) can still produce the same boards.
    await deleteSources();
    expect(await boards(ana)).toEqual(legacy);
  });

  test("keeps computing from memberDays until the backfill marker is set", async () => {
    await history();
    const ana = await signInAs(t, team.ana);
    const board = () => ana.query(api.leaderboard.get, { period: "month", metric: "given", today: TODAY });
    const before = await board();
    // Live maintenance already wrote rollups, but they aren't trusted before the backfill.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("memberStats").collect()) await ctx.db.delete(row._id);
    });
    expect(await board()).toEqual(before);
    await rebuild();
    expect(await board()).toEqual(before);
  });

  test("never ranks received kudos unless everyone may see them", async () => {
    await history();
    await rebuild();
    for (const receivedVisibility of ["self", "hidden"] as const) {
      await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility }));
      const ana = await signInAs(t, team.ana);
      const given = await ana.query(api.leaderboard.get, { period: "month", metric: "given", today: TODAY });
      const received = await ana.query(api.leaderboard.get, { period: "month", metric: "received", today: TODAY });
      expect(received).toMatchObject({ metric: "given", receivedAllowed: false });
      expect(received).toEqual(given);
    }
  });
});

/**
 * Wraps `ctx.db` so every document a reader returns is counted per table (`get` under "get").
 * Only the reads the function under test makes through this context are counted.
 */
function countingDb<Db extends object>(db: Db) {
  const reads: Record<string, number> = {};
  const add = (table: string, n: number) => (reads[table] = (reads[table] ?? 0) + n);
  const wrap = (table: string, target: object): unknown =>
    new Proxy(target, {
      get(obj, prop) {
        const value = Reflect.get(obj, prop, obj);
        if (typeof value !== "function") return value;
        if (prop === "take" || prop === "collect")
          return async (...args: unknown[]) => {
            const rows = await value.apply(obj, args);
            add(table, rows.length);
            return rows;
          };
        if (prop === "first" || prop === "unique")
          return async (...args: unknown[]) => {
            const row = await value.apply(obj, args);
            add(table, row ? 1 : 0);
            return row;
          };
        if (prop === Symbol.asyncIterator)
          return () => {
            const it = value.apply(obj);
            return {
              next: async () => {
                const r = await it.next();
                if (!r.done) add(table, 1);
                return r;
              },
            };
          };
        if (prop === "paginate") throw new Error("paginate isn't counted");
        return (...args: unknown[]) => wrap(table, value.apply(obj, args));
      },
    });
  const counted = new Proxy(db, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop, obj);
      if (prop === "query") return (table: string) => wrap(table, value.call(obj, table));
      if (prop === "get")
        return async (...args: unknown[]) => {
          const doc = await value.apply(obj, args);
          add("get", doc ? 1 : 0);
          return doc;
        };
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
  return { db: counted, reads };
}

describe("a 500-member workspace", () => {
  const MEMBERS = 500;
  const range = [...Array(MEMBERS).keys()];

  beforeEach(async () => {
    await t.run(async (ctx) => {
      const workspaceId = team.workspaceId;
      // A giving day: the giver's memberDays row and the kudos row it came from (to Ana).
      const day = async (memberId: Id<"members">, dayKey: string, given: number) => {
        await ctx.db.insert("memberDays", { workspaceId, memberId, dayKey, given, received: 0, maxed: false });
        await ctx.db.insert("kudos", {
          workspaceId,
          batchId: `${memberId}:${dayKey}`,
          giverId: memberId,
          receiverId: team.ana,
          amount: given,
          dayKey,
          source: "message",
          channelId: "CGENERAL",
          text: "thanks",
          at: Date.parse(`${dayKey}T10:00:00Z`),
          hour: 12,
        });
      };
      for (const i of range) {
        const memberId = await ctx.db.insert("members", {
          workspaceId: team.workspaceId,
          slackUserId: `USCALE${i}`,
          name: `Scale ${String(i).padStart(3, "0")}`,
          isAdmin: false,
          isBot: false,
          deactivated: false,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
        // 11 giving days each this year: 5,500 rows, more than one capped memberDays read keeps …
        for (let m = 1; m <= 9; m++) await day(memberId, `2026-0${m}-${String(1 + (i % 20)).padStart(2, "0")}`, 1 + (i % 7));
        await day(memberId, `2026-09-${21 + (i % 3)}`, 1 + (i % 7));
        await day(memberId, `2026-01-${21 + (i % 9)}`, 1 + (i % 7));
        // … and one last year, for the rank changes.
        await day(memberId, addDays("2025-01-01", i % 300), 1 + (i % 5));
      }
    });
  });

  /** The rebuild units the backfill driver chains, run in one go (the scheduler is slow at this size). */
  async function rebuildInline() {
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const days = new Set((await ctx.db.query("memberDays").collect()).map((d) => d.dayKey));
      for (const day of days) await rebuildWorkspaceDay(ctx, workspace, day);
      for (const m of await ctx.db.query("members").collect()) {
        for (const year of [2025, 2026]) await rebuildMemberYear(ctx, workspace, m._id, year);
      }
      for (const bucket of ["y:2025", "y:2026"]) await rebuildWorkspacePeriod(ctx, workspace, bucket);
      await markBackfilled(ctx, workspace._id, Date.now());
    });
  }

  test("ranks every member exactly for the whole year, reading only members and rollups", { timeout: 300_000 }, async () => {
    const ana = await signInAs(t, team.ana);
    const exactTotal = range.reduce((s, i) => s + 11 * (1 + (i % 7)), 0);
    // Before the backfill, the legacy scan only keeps the newest 5,000 of the 5,500 days.
    const legacy = await ana.query(api.leaderboard.get, { period: "year", metric: "given", today: "2026-09-23" });
    expect(legacy.highlights.total).toBeLessThan(exactTotal);

    await rebuildInline();
    const board = await ana.query(api.leaderboard.get, { period: "year", metric: "given", today: "2026-09-23" });
    expect(board.rows).toHaveLength(MEMBERS);
    // Scale 007 gives 1 + 7 % 7 = 1 unit on 11 days this year, and 1 + 7 % 5 = 3 last year.
    expect(board.rows.find((r) => r.member.name === "Scale 007")).toMatchObject({ value: 11, prevValue: 3, delta: 8 });
    expect(board.highlights.total).toBe(exactTotal);
    expect(board.highlights.givers).toBe(MEMBERS);
    // 2025 to Sep 23 (day 265): everyone but those whose day came later.
    expect(board.highlights.prevTotal).toBe(range.filter((i) => i % 300 <= 265).reduce((s, i) => s + 1 + (i % 5), 0));

    const reads = await t.run(async (ctx) => {
      const { db, reads } = countingDb(ctx.db);
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const me = (await ctx.db.get(team.ana))!;
      await leaderboard({ ...ctx, db }, { workspace, member: me }, { period: "year", metric: "given", today: "2026-09-23" });
      return reads;
    });
    expect(Object.keys(reads).sort()).toEqual(["memberStats", "members", "workspaceStats"]);
    expect(reads.members).toBe(MEMBERS + 8); // with the 8 seeded teammates (the bot is filtered out after the read)
    expect(reads.memberStats).toBe(2 * MEMBERS);
    expect(reads.workspaceStats).toBeLessThanOrEqual(2 + 266); // the `all` and year rows, 2025's days to date
  });
});

describe("the Slack App Home and /kudos top on rollups", () => {
  const home = (slackUserId: string) => t.query(internal.slackData.homeData, { workspaceId: team.workspaceId, slackUserId });
  const topLines = async () => {
    const res = await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UANA", text: "top" });
    return res.blocks[1].text.text as string;
  };
  const week = ({ weekGiven, weekRank, top }: { weekGiven: number; weekRank: number | null; top: unknown[] }) => ({ weekGiven, weekRank, top });

  /** This week (Mon Sep 21 – today): Ana gives 3, Ben 2 and Cleo 2; Dan gave only last week. */
  async function thisWeek() {
    const give = (at: string, giverSlackId: string, recipient: string, amountEach: number) =>
      t.run(async (ctx) => {
        await giveKudos(ctx, {
          workspace: (await ctx.db.get(team.workspaceId))!,
          giverSlackId,
          recipientSlackIds: [recipient],
          amountEach,
          channelId: "CGENERAL",
          text: "thanks",
          source: "message",
          messageTs: `${Date.parse(at) / 1000}.${giverSlackId}`,
          now: Date.parse(at),
        });
      });
    await give("2026-09-18T09:00:00Z", "UDAN", "UANA", 4);
    await give("2026-09-21T09:00:00Z", "UANA", "UBEN", 3);
    await give("2026-09-22T09:00:00Z", "UBEN", "UCLEO", 2);
    await give("2026-09-23T08:00:00Z", "UCLEO", "UANA", 2);
  }

  test("ties share a week rank, and a teammate who hasn't given this week has none", async () => {
    await thisWeek();
    await rebuild();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    const ben = await home("UBEN");
    const cleo = await home("UCLEO");
    expect([ben.weekGiven, ben.weekRank, cleo.weekGiven, cleo.weekRank]).toEqual([2, 2, 2, 2]);
    expect(ben.top[0]).toEqual({ slackUserId: "UANA", given: 3 });
    expect(ben.top.map((r: { slackUserId: string }) => r.slackUserId).sort()).toEqual(["UANA", "UBEN", "UCLEO"]);
    expect(week(await home("UDAN"))).toMatchObject({ weekGiven: 0, weekRank: null });
  });

  test("reads the week from the rollups once backfilled, the same as from memberDays before", async () => {
    await thisWeek();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    const legacy = await Promise.all(["UANA", "UBEN", "UCLEO", "UDAN"].map(async (id) => week(await home(id))));
    const legacyTop = await topLines();
    await rebuild();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    await deleteSources();
    const sortTop = (w: ReturnType<typeof week>) => ({ ...w, top: [...w.top].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) });
    const rollups = await Promise.all(["UANA", "UBEN", "UCLEO", "UDAN"].map(async (id) => week(await home(id))));
    expect(rollups.map(sortTop)).toEqual(legacy.map(sortTop));
    expect((await topLines()).split("\n").map((l) => l.replace(/^\S+ /, "")).sort()).toEqual(
      legacyTop.split("\n").map((l) => l.replace(/^\S+ /, "")).sort(),
    );
  });

  test("reads about ten documents for the week standing", async () => {
    await thisWeek();
    await rebuild();
    const reads = await t.run(async (ctx) => {
      const { db, reads } = countingDb(ctx.db);
      const workspace = (await ctx.db.get(team.workspaceId))!;
      await weekStanding({ ...ctx, db }, workspace, Date.parse("2026-09-23T10:00:00Z"), team.cleo, 5);
      return reads;
    });
    // The `all` marker row; top 5 plus Cleo's own row plus the one giver ahead of her.
    expect(reads).toEqual({ workspaceStats: 1, memberStats: 3 + 1 + 1 });
  });
});
