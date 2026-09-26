import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { startBonusDay } from "../convex/boosts";
import { switchGame } from "../convex/game";
import { BOOST_KINDS, type BoostKind } from "../convex/lib/boosts";
import { mulberry32 } from "../convex/lib/random";
import { addDays, dayKeyFor } from "../convex/lib/time";
import { claimAtTree, seedTeam, setupConvex, signInAs } from "./helpers";

/**
 * XP and Hog coins property test: random histories (thoughtful, thin and thank-back kudos, one or
 * two kudos per person, same-day and same-week repeats, several recipients, daily caps, revokes,
 * the game switched off and on) go through the real Slack path, and every player's XP, level, coins
 * and wallet balance must match an independent recompute written straight from the spec's G3 and
 * G4 tables. Without revokes, a rebuild must write exactly what the live path wrote.
 */

afterEach(() => vi.useRealTimers());

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Total XP per level, straight from the spec (#55 §G3). */
const CURVE = [0, 0, 30, 75, 175, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3750, 4400, 5100, 5850, 6650, 7500, 8400, 9350, 10350, 11400, 12500, 13650, 14850];
const levelOf = (xp: number) => {
  let l = 1;
  while (l < 25 && xp >= CURVE[l + 1]) l++;
  return l;
};

type Row = { id: string; giver: string; receiver: string; at: number; dayKey: string; amount: number };
type BoostOp = { kind: "boost"; dayKey: string; from: number; boost: BoostKind };
type Op =
  | { kind: "give"; at: number; dayKey: string; giver: string; noteWords: number; rows: Row[]; on: boolean }
  | { kind: "revoke"; row: string }
  | { kind: "switchOn" }
  | BoostOp;

/** Monday of a YYYY-MM-DD day. */
function weekOf(dayKey: string) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

type Line = { giver: string; receiver: string; dayKey: string; qualifying: boolean; xp: number; coins: number };
type Recv = { giver: string; receiver: string; dayKey: string; xp: number };
type State = {
  alive: Map<string, Row & { noteWords: number }>;
  lines: Map<string, Line>;
  recv: Map<string, Recv>;
  since: Map<string, number>;
  level: Map<string, number>;
};

const xpOf = (s: State, m: string) =>
  [...s.lines.values()].filter((l) => l.giver === m).reduce((a, l) => a + l.xp, 0) +
  [...s.recv.values()].filter((r) => r.receiver === m).reduce((a, r) => a + r.xp, 0);

/**
 * One give, scored against the state as it stands (the spec's G3 table, written independently).
 * A bonus day (§G9) doubles a qualifying kudos' XP before the daily cap and its coins; a
 * conditional booster (§G10) only when the kudos is a new connection, a rekindle or unsung.
 */
function applyGive(s: State, g: Extract<Op, { kind: "give" }>, unsungOn: boolean, boosts: BoostOp[] = []) {
  const boost = boosts.find((b) => b.dayKey === g.dayKey && b.from <= g.at)?.boost;
  if (g.on) {
    if (!s.since.has(g.giver)) s.since.set(g.giver, g.at);
    const alive = [...s.alive.values()];
    let earned = [...s.lines.values()].filter((l) => l.giver === g.giver && l.dayKey === g.dayKey).reduce((a, l) => a + l.xp, 0);
    let storyPaid = g.noteWords < 12;
    const scored: [Row, Line][] = [];
    for (const row of g.rows) {
      const thankBack = alive.some((k) => k.giver === row.receiver && k.receiver === g.giver && k.at > g.at - 72 * HOUR && k.at < g.at);
      const qualifying = g.noteWords >= 3 && !thankBack;
      let raw = 2;
      const about = new Set<BoostKind>(["double"]);
      if (qualifying) {
        const mine = [...s.lines.values()].filter((l) => l.giver === g.giver && l.receiver === row.receiver && l.qualifying);
        const today = mine.filter((l) => l.dayKey === g.dayKey).length;
        const days = new Set(mine.filter((l) => l.dayKey < g.dayKey && weekOf(l.dayKey) === weekOf(g.dayKey)).map((l) => l.dayKey)).size;
        raw = today === 0 ? Math.max(2, 10 - 2 * days) : today === 1 ? 2 : 0;
        if (raw > 0) {
          const before = alive.filter((k) => k.giver === g.giver && k.receiver === row.receiver && k.at < g.at).map((k) => k.at);
          if (before.length === 0) (raw += 10), about.add("new_connection");
          else if (g.at - Math.max(...before) >= 30 * DAY) (raw += 5), about.add("rekindle");
          const got = alive.filter((k) => k.receiver === row.receiver && k.at < g.at).map((k) => k.at);
          if (unsungOn && (got.length === 0 || g.at - Math.max(...got) >= 14 * DAY)) (raw += 5), about.add("unsung");
          if (!storyPaid) {
            raw += 5;
            storyPaid = true;
          }
        }
      }
      const doubled = qualifying && boost !== undefined && about.has(boost) ? 2 : 1;
      const xp = Math.min(raw * doubled, Math.max(0, 50 - earned));
      earned += xp;
      // Hog coins (§G4): 1 per kudos given in a qualifying kudos, untouched by XP decay and caps.
      scored.push([row, { giver: g.giver, receiver: row.receiver, dayKey: g.dayKey, qualifying, xp, coins: qualifying ? row.amount * doubled : 0 }]);
    }
    for (const [row, line] of scored) {
      s.lines.set(row.id, line);
      const since = s.since.get(row.receiver);
      if (!line.qualifying || since === undefined || since > g.at) continue;
      const today = [...s.recv.values()].filter((r) => r.receiver === row.receiver && r.dayKey === g.dayKey);
      if (today.some((r) => r.giver === g.giver)) continue;
      const xp = Math.min(5, 15 - today.reduce((a, r) => a + r.xp, 0));
      if (xp > 0) s.recv.set(row.id, { giver: g.giver, receiver: row.receiver, dayKey: g.dayKey, xp });
    }
  }
  for (const row of g.rows) s.alive.set(row.id, { ...row, noteWords: g.noteWords });
  for (const m of new Set([g.giver, ...g.rows.map((r) => r.receiver)])) {
    if (s.since.has(m)) s.level.set(m, Math.max(s.level.get(m) ?? 1, levelOf(xpOf(s, m))));
  }
}

/** The expected ledger after `ops`. Switching the game on replays the surviving history. */
function recompute(ops: Op[], unsungOn: boolean): State {
  let s: State = { alive: new Map(), lines: new Map(), recv: new Map(), since: new Map(), level: new Map() };
  const gives: Extract<Op, { kind: "give" }>[] = [];
  const revoked = new Set<string>();
  // Boosts are stored for good: a replay sees every one, and each only counts from its start.
  const boosts = ops.filter((op): op is BoostOp => op.kind === "boost");
  for (const op of ops) {
    if (op.kind === "boost") continue;
    if (op.kind === "give") {
      gives.push(op);
      applyGive(s, op, unsungOn, boosts);
    } else if (op.kind === "revoke") {
      revoked.add(op.row);
      s.alive.delete(op.row);
      s.lines.delete(op.row);
      s.recv.delete(op.row);
    } else {
      // A replay of what survives, in time order, keeping who is a player and the levels reached.
      const kept = { since: s.since, level: s.level };
      s = { alive: new Map(), lines: new Map(), recv: new Map(), since: new Map(kept.since), level: new Map(kept.level) };
      const replay = gives.map((g) => ({ ...g, rows: g.rows.filter((r) => !revoked.has(r.id)) })).filter((g) => g.rows.length > 0);
      for (const g of replay) if (!s.since.has(g.giver) && g.on) s.since.set(g.giver, g.at);
      // Receiving needs to know who becomes a player when, before scoring anything.
      const sinceAll = new Map(s.since);
      for (const g of replay) {
        s.since = sinceAll;
        applyGive(s, g, unsungOn, boosts);
      }
      // A rebuild takes the level at the replay's peak; with only gives replayed that is the end.
    }
  }
  return s;
}

const PEOPLE = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE"];
const NOTES = ["", "thanks", "thanks for the review", "thanks for staying late to fix the release pipeline, it saved our whole demo today"];

async function run(seed: number, { revokes, visibility, boosts = false }: { revokes: boolean; visibility: "self" | "everyone"; boosts?: boolean }) {
  const random = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const t = setupConvex();
  const team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, receivedVisibility: visibility });
  const extra = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
  // Five people, so one of them can hear from four givers in a day (the receiving cap is three).
  const ids: Record<string, Id<"members">> = { UANA: team.ana, UBEN: team.ben, UCLEO: team.cleo, UDAN: await extra("UDAN", "Dan"), UEVE: await extra("UEVE", "Eve") };
  const admin = await signInAs(t, team.ana);
  const ops: Op[] = [];
  let on = true;
  let burst: string[] = [];
  let ts = 1;
  for (let i = 0; i < 50; i++) {
    const r = random();
    vi.setSystemTime(Date.now() + (burst.length > 0 ? 60_000 : r < 0.6 ? random() * 3 * HOUR : r < 0.9 ? random() * 30 * HOUR : random() * 40 * DAY));
    const action = random();
    if (action < 0.05) {
      const ws = (await t.run((ctx) => ctx.db.get(team.workspaceId)))!;
      await t.run((ctx) => ctx.db.patch(team.workspaceId, switchGame(ws, !on, Date.now())));
      on = !on;
      if (on) {
        // What switching on does: a rebuild of every member.
        await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
        await t.finishAllScheduledFunctions(vi.runAllTimers);
        vi.unstubAllGlobals();
        ops.push({ kind: "switchOn" });
      }
      continue;
    }
    if (revokes && action < 0.15) {
      const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
      if (rows.length === 0) continue;
      const row = pick(rows);
      await admin.mutation(api.admin.revoke, { kudosId: row._id });
      ops.push({ kind: "revoke", row: row._id });
      continue;
    }
    // A bonus day or booster (#97): today from now on, or scheduled for one of the next days. The
    // first is a bonus day starting at once, so every such history has boosted kudos.
    const first = boosts && !ops.some((op) => op.kind === "boost");
    if (boosts && (first || (action >= 0.15 && action < 0.27))) {
      // Bonus days come up most; the conditional boosters need their kind of kudos to show.
      const kind = first ? "double" : pick<BoostKind>(["double", "double", ...BOOST_KINDS]);
      const ahead = first ? 0 : pick([0, 0, 1, 2]);
      const boost = await t.run(async (ctx) => {
        const workspace = (await ctx.db.get(team.workspaceId))!;
        const day = addDays(dayKeyFor(Date.now(), workspace.timezone), ahead);
        const id = await startBonusDay(ctx, workspace, day, ahead === 0 ? "booster" : "schedule", { kind, by: team.ana });
        return id && (await ctx.db.get(id));
      });
      if (boost) ops.push({ kind: "boost", dayKey: boost.dayKey, from: boost.from, boost: boost.kind });
      continue;
    }
    // Now and then everyone thanks Ben within minutes: the receiving cap (3 givers a day) kicks in.
    if (burst.length === 0 && random() < 0.08) burst = ["UANA", "UCLEO", "UDAN", "UEVE"];
    const inBurst = burst.length > 0;
    const giver = inBurst ? burst.shift()! : pick(PEOPLE);
    const others = PEOPLE.filter((p) => p !== giver);
    // Ben is popular: repeats, thank-backs and caps come up often.
    const favourite = () => (giver !== "UBEN" && random() < 0.4 ? "UBEN" : pick(others));
    const recipients = inBurst ? ["UBEN"] : random() < 0.25 ? [favourite(), pick(others)] : [favourite()];
    const tacos = !inBurst && random() < 0.3 ? ":taco::taco:" : ":taco:";
    const note = inBurst ? NOTES[2] : pick(NOTES);
    const before = new Set((await t.run((ctx) => ctx.db.query("kudos").collect())).map((k) => k._id));
    const result = await t.mutation(internal.kudos.ingestMessage, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      giverSlackId: giver,
      text: `${[...new Set(recipients)].map((p) => `<@${p}>`).join(" ")} ${tacos} ${note}`,
      channelId: "C1",
      messageTs: `${ts++}.0001`,
    });
    if (result?.status !== "given") continue;
    const rows = (await t.run((ctx) => ctx.db.query("kudos").collect())).filter((k) => !before.has(k._id));
    const byId = Object.fromEntries(Object.entries(ids).map(([slack, id]) => [id, slack]));
    ops.push({
      kind: "give",
      at: rows[0].at,
      dayKey: rows[0].dayKey,
      giver,
      noteWords: rows[0].noteWords ?? 0,
      on,
      rows: rows.map((k) => ({ id: k._id, giver, receiver: byId[k.receiverId], at: k.at, dayKey: k.dayKey, amount: k.amount })),
    });
  }
  return { t, team, ids, ops };
}

async function playersOf(t: ReturnType<typeof setupConvex>, ids: Record<string, Id<"members">>) {
  const out: Record<string, { xp: number; level: number; coins: number; balance: number } | null> = {};
  for (const [slack, id] of Object.entries(ids)) {
    await claimAtTree(t, id); // a give's coins are the giver's once offered at the tree (#157)
    const p = await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", id)).unique());
    const wallet = p && p.level >= 3 ? (await (await signInAs(t, id)).query(api.game.mine, {})).wallet : null;
    out[slack] = p && { xp: p.xp, level: p.level, coins: p.coins ?? 0, balance: wallet?.balance ?? coinsOf(p.coins ?? 0, p.level) };
  }
  return out;
}

/** The wallet: coins from kudos plus 10 per level reached (§G4); nothing is spent in these histories. */
const coinsOf = (fromKudos: number, level: number) => fromKudos + 10 * (level - 1);

function expected(state: State) {
  return Object.fromEntries(
    PEOPLE.map((m) => {
      if (!state.since.has(m)) return [m, null];
      const level = state.level.get(m) ?? 1;
      const coins = [...state.lines.values()].filter((l) => l.giver === m).reduce((a, l) => a + l.coins, 0);
      return [m, { xp: xpOf(state, m), level, coins, balance: coinsOf(coins, level) }];
    }),
  );
}

describe("XP matches an independent recompute", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const visibility = seed % 2 === 0 ? ("everyone" as const) : ("self" as const);
    test(`random history with revokes #${seed} (${visibility})`, async () => {
      const { t, ids, ops } = await run(seed, { revokes: true, visibility });
      expect(await playersOf(t, ids)).toEqual(expected(recompute(ops, visibility === "everyone")));
    });
  }

  for (let seed = 101; seed <= 108; seed++) {
    test(`without revokes a rebuild writes what the live path wrote #${seed}`, async () => {
      const visibility = seed % 2 === 0 ? ("everyone" as const) : ("self" as const);
      const { t, team, ids, ops } = await run(seed, { revokes: false, visibility });
      const live = await playersOf(t, ids);
      expect(live).toEqual(expected(recompute(ops, visibility === "everyone")));
      const events = async () =>
        (await t.run((ctx) => ctx.db.query("gameEvents").collect()))
          .map(({ _id, _creationTime, ...e }) => e)
          .sort((a, b) => a.at - b.at || a.memberId.localeCompare(b.memberId) || a.kind.localeCompare(b.kind));
      const before = await events();
      await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await playersOf(t, ids)).toEqual(live);
      expect(await events()).toEqual(before);
    });
  }
});

/** The doubling stays exact (#97): through revokes, switch-offs and the replays a switch-on starts. */
describe("bonus days and boosters double exactly", () => {
  let boostedLines = 0;
  for (let seed = 201; seed <= 210; seed++) {
    const visibility = seed % 2 === 0 ? ("everyone" as const) : ("self" as const);
    test(`random history with boosts and revokes #${seed} (${visibility})`, async () => {
      const { t, ids, ops } = await run(seed, { revokes: true, visibility, boosts: true });
      expect(ops.some((op) => op.kind === "boost")).toBe(true);
      expect(await playersOf(t, ids)).toEqual(expected(recompute(ops, visibility === "everyone")));
      for (const id of Object.values(ids)) {
        const v = await t.query(internal.game.verifyMember, { memberId: id });
        expect([v.stored, v.coins]).toEqual([v.events, v.eventCoins]);
      }
    });
  }

  for (let seed = 301; seed <= 306; seed++) {
    test(`without revokes a rebuild replays every boost as it was #${seed}`, async () => {
      const visibility = seed % 2 === 0 ? ("everyone" as const) : ("self" as const);
      const { t, team, ids, ops } = await run(seed, { revokes: false, visibility, boosts: true });
      const live = await playersOf(t, ids);
      expect(live).toEqual(expected(recompute(ops, visibility === "everyone")));
      const events = async () =>
        (await t.run((ctx) => ctx.db.query("gameEvents").collect()))
          .map(({ _id, _creationTime, ...e }) => e)
          .sort((a, b) => a.at - b.at || a.memberId.localeCompare(b.memberId) || a.kind.localeCompare(b.kind));
      const before = await events();
      boostedLines += before.flatMap((e) => e.lines ?? []).filter((l) => l.boosted).length;
      await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await playersOf(t, ids)).toEqual(live);
      expect(await events()).toEqual(before);
    });
  }

  test("those replays had boosted kudos to replay", () => {
    expect(boostedLines).toBeGreaterThan(5);
  });
});
