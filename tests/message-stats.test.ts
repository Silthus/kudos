import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { allowanceCheck, giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { CATALOG } from "../convex/lib/messages";
import { MESSAGE_KEYS } from "../convex/lib/rebuild";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * `messageStats` (#86): how many members found each message, and anything at all. Property: after
 * every transaction of any history of gives, revokes, bot messages, quest completions, member
 * removals and rebuilds, the rollup equals an independent recount of the discoveries, and so does
 * the gallery built from it.
 */

type T = ReturnType<typeof setupConvex>;
let t: T;
let team: Team;
let other: Team;

beforeEach(async () => {
  t = setupConvex();
  // An empty workspace is trivially backfilled: the gallery reads the rollup from the start.
  team = await seedTeam(t, { rollupsBackfilledAt: Date.parse("2026-09-01T00:00:00Z") });
  other = await seedTeam(t, { rollupsBackfilledAt: Date.parse("2026-09-01T00:00:00Z") }, "T2");
});
afterEach(() => vi.useRealTimers());

/** Deterministic PRNG so a failing seed can be replayed. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type GiveOptions = Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] };

async function give(workspaceId: Id<"workspaces">, opts: GiveOptions) {
  return await t.run(async (ctx) =>
    giveKudos(ctx, {
      workspace: (await ctx.db.get(workspaceId))!,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      ...opts,
    }),
  );
}

/** The oracle: distinct finders per message key and of anything, from the discoveries alone. */
function recount(discoveries: Doc<"discoveries">[], workspaceId: Id<"workspaces">) {
  const byKey = new Map<string, Set<string>>();
  const anyone = new Set<string>();
  for (const d of discoveries) {
    if (d.workspaceId !== workspaceId) continue;
    byKey.set(d.templateKey, (byKey.get(d.templateKey) ?? new Set()).add(d.memberId));
    anyone.add(d.memberId);
  }
  return { byKey: new Map([...byKey].map(([k, s]) => [k, s.size])), collectors: anyone.size };
}

const sorted = (xs: string[]) => [...xs].sort();

async function expectExact(step: string, viewer?: Awaited<ReturnType<typeof signInAs>>) {
  const { discoveries, stats } = await t.run(async (ctx) => ({
    discoveries: await ctx.db.query("discoveries").collect(),
    stats: await ctx.db.query("messageStats").collect(),
  }));
  for (const workspaceId of [team.workspaceId, other.workspaceId]) {
    const expected = recount(discoveries, workspaceId);
    const lines = [...expected.byKey].map(([k, n]) => `${k} ${n}`);
    if (expected.collectors > 0) lines.push(`* ${expected.collectors}`);
    const stored = stats.filter((s) => s.workspaceId === workspaceId).map((s) => `${s.templateKey} ${s.finders}`);
    expect(sorted(stored), `${step}: messageStats of ${workspaceId}`).toEqual(sorted(lines));
    if (workspaceId === team.workspaceId && viewer) {
      const g = await viewer.query(api.discoveries.gallery, {});
      expect(g.collectors, `${step}: collectors`).toBe(expected.collectors);
      expect(
        Object.fromEntries(g.items.map((i) => [i.key, i.foundBy])),
        `${step}: gallery`,
      ).toEqual(Object.fromEntries(CATALOG.map((c) => [c.key, expected.byKey.get(c.key) ?? 0])));
    }
  }
}

/** Run scheduled functions one transaction at a time, checking the rollup after each. */
async function drainChecking(step: string) {
  for (let i = 0; i < 5000; i++) {
    const pending = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
    );
    if (pending.length === 0) return;
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    await expectExact(`${step} (scheduled ${pending.map((f) => f.name).join(", ")})`);
  }
  throw new Error(`${step}: scheduled functions never finished`);
}

const DAYS = ["2026-09-21", "2026-09-23", "2026-09-30", "2026-10-01", "2026-12-31", "2027-01-04"];
const PEOPLE = ["UANA", "UBEN", "UCLEO", "UDAN", "UEVE"];
const NOTES = [
  { text: "thanks", noteWords: 1 },
  { text: "thanks for the thorough review today", noteWords: 6 },
  { text: "great pairing session on that nasty bug", noteWords: 7 },
];

describe("messageStats equals a recount of the discoveries", () => {
  const SEEDS = Array.from({ length: 6 }, (_, i) => i + 1);

  test.each(SEEDS)("after every transaction of a random history (seed %i)", { timeout: 120_000 }, async (seed) => {
    const random = mulberry32(seed);
    const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { notifyGiver: true, notifyReceiver: true });
      for (const [slackUserId, name] of [["UDAN", "Dan"], ["UEVE", "Eve"]]) {
        await ctx.db.insert("members", {
          workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false,
          deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
        });
      }
    });
    const ana = await signInAs(t, team.ana);
    let newcomers = 0;
    const someone = () => (random() < 0.1 ? `UNEW${newcomers++}` : pick(PEOPLE));
    const at = () => {
      const [y, m, d] = pick(DAYS).split("-").map(Number);
      return Date.UTC(y, m - 1, d, 6 + Math.floor(random() * 12), Math.floor(random() * 60));
    };

    for (let i = 0; i < 40; i++) {
      const roll = random();
      let step = `seed ${seed} step ${i}`;
      if (roll < 0.55) {
        vi.setSystemTime(at());
        const giver = pick(PEOPLE);
        const recipients = [...new Set(Array.from({ length: 1 + Math.floor(random() * 3) }, someone))];
        const workspaceId = random() < 0.1 ? other.workspaceId : team.workspaceId;
        const r = await give(workspaceId, {
          giverSlackId: workspaceId === team.workspaceId ? giver : "UBEN",
          recipientSlackIds: workspaceId === team.workspaceId ? recipients : ["UANA"],
          messageTs: `${Date.now() / 1000}`,
          ...pick(NOTES),
        });
        step += `: ${giver} → ${recipients.join(",")} ${r.status}`;
      } else if (roll < 0.75) {
        const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
        if (rows.length === 0) continue;
        const row = pick(rows);
        await t.run(async (ctx) => revokeKudosRow(ctx, (await ctx.db.get(row.workspaceId))!, row));
        step += `: revoke`;
      } else if (roll < 0.85) {
        const now = at();
        const r = random();
        await t.run(async (ctx) => {
          const members = (await ctx.db.query("members").collect()).filter((m) => m.workspaceId === team.workspaceId && !m.isBot);
          await allowanceCheck(ctx, (await ctx.db.get(team.workspaceId))!, members[Math.floor(r * members.length)], now);
        });
        step += `: allowance check`;
      } else if (roll < 0.95) {
        const slackUserId = pick(["UBEN", "UCLEO", "UDAN", "UEVE", "UNEW0"]);
        const r = await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId });
        step += `: remove ${slackUserId} ${r.status}`;
        await drainChecking(step);
      } else {
        await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
        step += `: rebuild`;
        await drainChecking(step);
      }
      await expectExact(step, ana);
    }
  });

  test("first finds landing between the rebuild's message steps stay counted", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: true, notifyReceiver: true }));
    await give(team.workspaceId, { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    const pendingCursor = async () => {
      const [next] = await t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
      );
      const args = next?.args[0] as { phase?: string; cursor?: string } | undefined;
      return next ? `${args?.phase}:${args?.cursor}` : null;
    };
    const lands = new Set([`messages:0`, `messages:${MESSAGE_KEYS.length - 1}`]); // the first message, the collectors
    let newcomers = 0;
    for (let cursor = await pendingCursor(); cursor !== null; cursor = await pendingCursor()) {
      if (lands.has(cursor)) {
        // Someone's first ever find, and a find of a message somebody already has.
        const r = await give(team.workspaceId, { giverSlackId: "UCLEO", recipientSlackIds: [`UNEW${newcomers++}`], messageTs: cursor });
        expect(r.status).toBe("given");
      }
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
    }
    expect(newcomers).toBe(2);
    await expectExact("after the rebuild", await signInAs(t, team.ana));
  });

  test("quest messages count, and a removed member leaves the collectors with their last find", async () => {
    const discoveries = async () => await t.run((ctx) => ctx.db.query("discoveries").collect());
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: true, notifyReceiver: true }));
    vi.setSystemTime(Date.parse("2026-09-21T09:00:00Z"));
    for (const to of ["UBEN", "UCLEO"]) {
      await give(team.workspaceId, { giverSlackId: "UANA", recipientSlackIds: [to], ...NOTES[1], messageTs: `${Date.now() / 1000}.${to}` });
    }
    const before = await discoveries();
    expect(before.some((d) => d.category === "quest_complete")).toBe(true); // Ana's "New connection"
    expect(before.filter((d) => d.memberId === team.cleo).length).toBeGreaterThan(0);
    const ana = await signInAs(t, team.ana);
    await expectExact("before removing Cleo", ana);
    const collectors = (await ana.query(api.discoveries.gallery, {})).collectors;
    expect(collectors).toBe(3);

    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UCLEO" });
    await drainChecking("remove Cleo");
    await expectExact("after removing Cleo", ana);
    expect((await ana.query(api.discoveries.gallery, {})).collectors).toBe(2);
  });
});
