import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { switchGame } from "../convex/game";
import { mulberry32 } from "../convex/lib/random";
import { seedTeam, setupConvex, signInAs } from "./helpers";

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
type Op =
  | { kind: "give"; at: number; dayKey: string; giver: string; noteWords: number; rows: Row[]; on: boolean }
  | { kind: "revoke"; row: string }
  | { kind: "switchOn" };

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

/** One give, scored against the state as it stands (the spec's G3 table, written independently). */
function applyGive(s: State, g: Extract<Op, { kind: "give" }>, unsungOn: boolean) {
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
      if (qualifying) {
        const mine = [...s.lines.values()].filter((l) => l.giver === g.giver && l.receiver === row.receiver && l.qualifying);
        const today = mine.filter((l) => l.dayKey === g.dayKey).length;
        const days = new Set(mine.filter((l) => l.dayKey < g.dayKey && weekOf(l.dayKey) === weekOf(g.dayKey)).map((l) => l.dayKey)).size;
        raw = today === 0 ? Math.max(2, 10 - 2 * days) : today === 1 ? 2 : 0;
        if (raw > 0) {
          const before = alive.filter((k) => k.giver === g.giver && k.receiver === row.receiver && k.at < g.at).map((k) => k.at);
          if (before.length === 0) raw += 10;
          else if (g.at - Math.max(...before) >= 30 * DAY) raw += 5;
          const got = alive.filter((k) => k.receiver === row.receiver && k.at < g.at).map((k) => k.at);
          if (unsungOn && (got.length === 0 || g.at - Math.max(...got) >= 14 * DAY)) raw += 5;
          if (!storyPaid) {
            raw += 5;
            storyPaid = true;
          }
        }
      }
      const xp = Math.min(raw, Math.max(0, 50 - earned));
      earned += xp;
      // Hog coins (§G4): 1 per kudos given in a qualifying kudos, untouched by XP decay and caps.
      scored.push([row, { giver: g.giver, receiver: row.receiver, dayKey: g.dayKey, qualifying, xp, coins: qualifying ? row.amount : 0 }]);
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
  for (const op of ops) {
    if (op.kind === "give") {
      gives.push(op);
      applyGive(s, op, unsungOn);
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
        applyGive(s, g, unsungOn);
      }
      // A rebuild takes the level at the replay's peak; with only gives replayed that is the end.
    }
  }
  return s;
}

const PEOPLE = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE"];
const NOTES = ["", "thanks", "thanks for the review", "thanks for staying late to fix the release pipeline, it saved our whole demo today"];

async function run(seed: number, { revokes, visibility }: { revokes: boolean; visibility: "self" | "everyone" }) {
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
