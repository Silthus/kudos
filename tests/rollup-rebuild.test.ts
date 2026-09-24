import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { ANY_MESSAGE } from "../convex/lib/rollups";
import { seedTeam, setupConvex, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type GiveOptions = Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] };

async function give(opts: GiveOptions) {
  return await t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId))!;
    return await giveKudos(ctx, {
      workspace,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      ...opts,
    });
  });
}

async function giveAt(iso: string, opts: GiveOptions) {
  vi.setSystemTime(new Date(iso));
  const result = await give({ messageTs: `${Date.parse(iso) / 1000}`, ...opts });
  expect(result.status, `${iso} ${opts.giverSlackId}`).toBe("given");
}

const ROLLUP_TABLES = ["workspaceStats", "memberStats", "pairStats", "channelStats", "messageStats"] as const;

/** Every rollup row as a comparable line: ids, creation times and the backfill marker left out. */
async function rollupLines() {
  return await t.run(async (ctx) => {
    const lines: string[] = [];
    for (const table of ROLLUP_TABLES) {
      for (const row of await ctx.db.query(table).collect()) {
        const { _id, _creationTime, ...rest } = row as Doc<"workspaceStats">;
        delete (rest as { rollupsBackfilledAt?: number }).rollupsBackfilledAt;
        lines.push(`${table} ${JSON.stringify(Object.fromEntries(Object.entries(rest).sort()))}`);
      }
    }
    return lines.sort();
  });
}

async function rebuild() {
  await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
}

/** A few weeks of giving around a month, quarter and ISO-year boundary, with a revoke. */
async function history() {
  await giveAt("2026-09-21T08:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], amountEach: 2 });
  await giveAt("2026-09-23T15:30:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"], source: "reaction" });
  await giveAt("2026-09-30T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA"], amountEach: 5 });
  await giveAt("2026-10-01T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UCLEO"], channelId: "CSECRET", channelName: "secret", channelPrivate: true });
  await giveAt("2026-12-31T22:30:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"], amountEach: 3 }); // 2027-01-01 in Berlin
  await giveAt("2027-01-04T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("kudos").collect()).find((k) => k.dayKey === "2026-09-23")!;
    await revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row);
  });
}

describe("rebuilding a workspace's rollups from the source tables", () => {
  test("overwrites corrupted, missing and stray rollup rows with the exact values", async () => {
    await history();
    const maintained = await rollupLines();
    expect(maintained.length).toBeGreaterThan(50);

    await t.run(async (ctx) => {
      const ws = await ctx.db.query("workspaceStats").collect();
      const day = ws.find((w) => w.bucket === "d:2026-09-21")!;
      await ctx.db.patch(day._id, { given: 999, givers: 7, heat: new Array(24).fill(1) });
      await ctx.db.delete(ws.find((w) => w.bucket === "m:2026-10")!._id);
      await ctx.db.patch(ws.find((w) => w.bucket === "all")!._id, { messages: 0, receivers: 42 });
      const [member] = await ctx.db.query("memberStats").collect();
      await ctx.db.patch(member._id, { given: member.given + 10, activeDays: 30 });
      await ctx.db.insert("memberStats", {
        workspaceId: team.workspaceId, memberId: team.ben, bucket: "w:2026-W50", given: 3, received: 0, maxedDays: 0, activeDays: 1,
      });
      const [pair] = await ctx.db.query("pairStats").collect();
      await ctx.db.delete(pair._id);
      await ctx.db.insert("pairStats", { workspaceId: team.workspaceId, bucket: "y:2026", giverId: team.cleo, receiverId: team.ben, amount: 8 });
      const [channel] = await ctx.db.query("channelStats").collect();
      await ctx.db.patch(channel._id, { amount: 123 });
      await ctx.db.insert("channelStats", { workspaceId: team.workspaceId, bucket: "q:2026-Q4", channel: "ghost", amount: 2 });
      // The second year of history.
      const anaNextYear = (await ctx.db.query("memberStats").collect()).find((m) => m.memberId === team.ana && m.bucket === "y:2027")!;
      await ctx.db.patch(anaNextYear._id, { given: 50 });
      const pairNextYear = (await ctx.db.query("pairStats").collect()).find((p) => p.bucket === "m:2027-01")!;
      await ctx.db.delete(pairNextYear._id);
      // A duplicate bucket row, and stray rows well outside the history.
      const { _id, _creationTime, ...copy } = day;
      await ctx.db.insert("workspaceStats", copy);
      const stray = { workspaceId: team.workspaceId, bucket: "y:2025" };
      const { _id: _all, _creationTime: _t, rollupsBackfilledAt: _m, ...allRow } = ws.find((w) => w.bucket === "all")!;
      await ctx.db.insert("workspaceStats", { ...allRow, ...stray });
      await ctx.db.insert("pairStats", { ...stray, giverId: team.ana, receiverId: team.cleo, amount: 9 });
      await ctx.db.insert("channelStats", { ...stray, channel: "ghost", amount: 5 });
      await ctx.db.insert("memberStats", { ...stray, bucket: "m:2025-05", memberId: team.cleo, given: 1, received: 1, maxedDays: 0, activeDays: 1 });
      // Message finders: wrong, missing, duplicated, and a message nobody found (or that left the catalog).
      const messages = await ctx.db.query("messageStats").collect();
      const collectors = messages.find((m) => m.templateKey === ANY_MESSAGE)!;
      const found = messages.filter((m) => m !== collectors);
      expect(found.length).toBeGreaterThan(2);
      await ctx.db.patch(found[0]._id, { finders: found[0].finders + 4 });
      await ctx.db.delete(found[1]._id);
      await ctx.db.delete(collectors._id);
      const { _id: _dupId, _creationTime: _dupTime, ...dup } = found[2];
      await ctx.db.insert("messageStats", dup);
      await ctx.db.insert("messageStats", { workspaceId: team.workspaceId, templateKey: "retired.legendary.1", finders: 2 });
    });
    expect(await rollupLines()).not.toEqual(maintained);

    await rebuild();
    expect(await rollupLines()).toEqual(maintained);
  }, 20_000); // the stray rows widen the span to a year and a half of days

  test("records rollupsBackfilledAt on the all row, and a return to zero keeps it", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false, notifyReceiver: false }));
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    await rebuild();
    const marker = async () =>
      (await t.run((ctx) => ctx.db.query("workspaceStats").collect())).find((w) => w.bucket === "all")?.rollupsBackfilledAt;
    expect(await marker()).toBe(Date.parse("2026-09-23T10:00:00Z"));

    await give({ giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      for (const row of await ctx.db.query("kudos").collect()) await revokeKudosRow(ctx, workspace, row);
    });
    expect(await marker()).toBe(Date.parse("2026-09-23T10:00:00Z"));
    const [all] = await t.run((ctx) => ctx.db.query("workspaceStats").collect());
    expect(all).toMatchObject({ bucket: "all", given: 0, givers: 0, messages: 0 });
  });

  test("stays exact while live gives and revokes land between its steps", async () => {
    // A twin backend runs the same history and live traffic with transactional maintenance only.
    const ops = liveOps(mulberry32(7), 60);
    // Both twins roll the same bot messages, so they discover the same templates.
    vi.spyOn(Math, "random").mockImplementation(mulberry32(99));
    await history();
    for (const op of ops) await applyLiveOp(op);
    const maintained = await rollupLines();

    t = setupConvex();
    team = await seedTeam(t);
    vi.spyOn(Math, "random").mockImplementation(mulberry32(99));
    await history();
    // Rollups as a workspace has them before its first backfill: partly missing, partly wrong.
    const random = mulberry32(11);
    await t.run(async (ctx) => {
      for (const table of ROLLUP_TABLES) {
        for (const row of await ctx.db.query(table).collect()) if (random() < 0.5) await ctx.db.delete(row._id);
      }
      for (const row of await ctx.db.query("memberStats").collect()) await ctx.db.patch(row._id, { given: row.given + 2 });
    });
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    let steps = 0;
    for (const op of ops) {
      if (await runScheduledStep()) steps += 1;
      await applyLiveOp(op);
    }
    expect(steps).toBeGreaterThan(20); // the traffic really interleaved with the backfill
    while (await runScheduledStep()) steps += 1;

    expect(await rollupLines()).toEqual(maintained);
  });
});

describe("rebuilding history written before rollups existed", () => {
  test("uses the fallbacks live maintenance uses, pins them, and keeps received-only members without a profile", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { dailyLimit: 3 });
      // Legacy rows: no kudos.hour, no memberDays.capped (Berlin: 09:30 UTC is 11:30 local).
      const at = Date.parse("2026-09-21T09:30:00Z");
      for (const receiverId of [team.ben, team.cleo]) {
        await ctx.db.insert("kudos", {
          workspaceId: team.workspaceId, batchId: "CGENERAL:1.0:ana", giverId: team.ana, receiverId, amount: 2, dayKey: "2026-09-21",
          source: "message", channelId: "CGENERAL", channelName: "general", messageTs: "1.0", text: "legacy", at,
        });
      }
      await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: team.ana, dayKey: "2026-09-21", given: 4, received: 0, maxed: true });
      for (const memberId of [team.ben, team.cleo]) {
        await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey: "2026-09-21", given: 0, received: 2, maxed: false });
      }
      await ctx.db.patch(team.ana, { totalGiven: 4, totalMaxedDays: 1 });
      await ctx.db.patch(team.ben, { totalReceived: 2 });
      await ctx.db.patch(team.cleo, { totalReceived: 2 });
    });
    await rebuild();

    const ws = await t.run((ctx) => ctx.db.query("workspaceStats").collect());
    expect(ws.find((w) => w.bucket === "d:2026-09-21")).toMatchObject({
      given: 4, kudosRows: 2, messages: 1, givers: 1, receivers: 2, giverDays: 1, cappedGiven: 3, maxedDays: 1,
      heat: Array.from({ length: 24 }, (_, h) => (h === 11 ? 4 : 0)),
    });
    expect(ws.find((w) => w.bucket === "all")).toMatchObject({ given: 4, givers: 1, receivers: 2, cappedGiven: 3 });
    expect((await t.run((ctx) => ctx.db.query("kudos").collect())).map((k) => k.hour)).toEqual([11, 11]);
    expect((await t.run((ctx) => ctx.db.query("memberDays").collect())).map((d) => d.capped)).toEqual([3, 0, 0]);
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    expect(members.find((m) => m._id === team.ana)).toMatchObject({ currentStreak: 1, longestStreak: 1, lastActiveDay: "2026-09-21", givenByWeekday: [4, 0, 0, 0, 0, 0, 0] });
    expect(members.find((m) => m._id === team.ben)!.givenByWeekday).toBeUndefined();

    // Pinned: a later limit change can't move them, so a revoke returns the day to zero.
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { dailyLimit: 10, timezone: "Asia/Tokyo" });
      const workspace = (await ctx.db.get(team.workspaceId))!;
      for (const row of await ctx.db.query("kudos").collect()) await revokeKudosRow(ctx, workspace, row);
    });
    const after = await t.run((ctx) => ctx.db.query("workspaceStats").collect());
    expect(after.map((w) => w.bucket)).toEqual(["all"]);
    expect(after[0]).toMatchObject({ given: 0, cappedGiven: 0, heat: new Array(168).fill(0) });
  });
});

describe("verifying rollups against the legacy computation from memberDays and kudos", () => {
  const SAMPLE = ["d:2026-09-21", "w:2026-W39", "m:2026-09", "q:2026-Q4", "y:2026", "d:2027-01-01", "w:2026-W53"];
  const verify = (buckets?: string[]) => t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets });

  test("finds nothing on maintained rollups, pinpoints corrupted values, and nothing after a rebuild", async () => {
    await history();
    expect(await verify(SAMPLE)).toEqual({ checked: SAMPLE, mismatches: [] });

    await t.run(async (ctx) => {
      const ws = await ctx.db.query("workspaceStats").collect();
      await ctx.db.patch(ws.find((w) => w.bucket === "d:2026-09-21")!._id, { given: 999 });
      const anaSeptember = (await ctx.db.query("memberStats").collect()).find((m) => m.memberId === team.ana && m.bucket === "m:2026-09")!;
      await ctx.db.patch(anaSeptember._id, { received: 6 });
      const pair = (await ctx.db.query("pairStats").collect()).find(
        (p) => p.giverId === team.ana && p.receiverId === team.ben && p.bucket === "y:2026",
      )!;
      await ctx.db.patch(pair._id, { amount: 7 });
      const channel = (await ctx.db.query("channelStats").collect()).find((c) => c.bucket === "w:2026-W39")!;
      await ctx.db.delete(channel._id);
    });
    expect((await verify(SAMPLE)).mismatches).toEqual([
      { bucket: "d:2026-09-21", table: "workspaceStats", key: "d:2026-09-21", field: "given", expected: 4, actual: 999 },
      { bucket: "w:2026-W39", table: "channelStats", key: "general", field: "amount", expected: 4, actual: 0 },
      { bucket: "m:2026-09", table: "memberStats", key: team.ana, field: "received", expected: 5, actual: 6 },
      { bucket: "y:2026", table: "pairStats", key: `${team.ana}>${team.ben}`, field: "amount", expected: 2, actual: 7 },
    ]);

    await rebuild();
    expect((await verify(SAMPLE)).mismatches).toEqual([]);
  });

  test("checks message finders against the discoveries: all messages, or one", async () => {
    await history();
    const discoveries = await t.run((ctx) => ctx.db.query("discoveries").collect());
    const [first, second] = [...new Set(discoveries.map((d) => d.templateKey))];
    expect(second).toBeDefined();
    expect(await verify(["messages", `messages:${first}`])).toEqual({ checked: ["messages", `messages:${first}`], mismatches: [] });

    const finders = (key: string) => new Set(discoveries.filter((d) => d.templateKey === key).map((d) => d.memberId)).size;
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("messageStats").collect();
      await ctx.db.patch(rows.find((r) => r.templateKey === first)!._id, { finders: 9 });
      await ctx.db.delete(rows.find((r) => r.templateKey === second)!._id);
      await ctx.db.patch(rows.find((r) => r.templateKey === ANY_MESSAGE)!._id, { finders: 1 });
      await ctx.db.insert("messageStats", { workspaceId: team.workspaceId, templateKey: "retired.legendary.1", finders: 2 });
    });
    const mismatch = (bucket: string, key: string, expected: number, actual: number) =>
      ({ bucket, table: "messageStats", key, field: "finders", expected, actual });
    expect((await verify([`messages:${second}`])).mismatches).toEqual([mismatch(`messages:${second}`, second, finders(second), 0)]);
    expect((await verify([`messages:${ANY_MESSAGE}`])).mismatches).toEqual([mismatch(`messages:${ANY_MESSAGE}`, ANY_MESSAGE, 3, 1)]);
    expect((await verify(["messages"])).mismatches).toEqual(
      [
        mismatch("messages", ANY_MESSAGE, 3, 1),
        mismatch("messages", first, finders(first), 9),
        mismatch("messages", "retired.legendary.1", 0, 2),
        mismatch("messages", second, finders(second), 0),
      ].sort((a, b) => a.key.localeCompare(b.key)),
    );

    await rebuild();
    expect((await verify(["messages"])).mismatches).toEqual([]);
  });

  test("counts message finders the way the rebuild does: catalog messages only, collectors among members", async () => {
    await history();
    await t.run(async (ctx) => {
      const [some] = await ctx.db.query("discoveries").collect();
      const { _id, _creationTime, ...found } = some;
      // A discovery of a message that left the catalog, and one left behind by a member who is gone.
      await ctx.db.insert("discoveries", { ...found, templateKey: "giver.common.99" });
      const gone = await ctx.db.insert("members", {
        workspaceId: team.workspaceId, slackUserId: "UGONE", name: "Gone", isAdmin: false, isBot: false, deactivated: false,
        totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
      });
      await ctx.db.insert("discoveries", { ...found, memberId: gone, templateKey: "self.common.1" });
      await ctx.db.delete(gone);
    });
    await rebuild();
    expect((await verify(["messages", `messages:${ANY_MESSAGE}`])).mismatches).toEqual([]);
  });

  test("refuses to check a message that isn't in the catalog", async () => {
    await expect(verify(["messages:giver.common.99"])).rejects.toThrow(/Unknown message/);
    await expect(verify(["messages:"])).rejects.toThrow(/Unknown message/);
  });

  test("a rebuild whose message cursor ran past a shrunken catalog still finishes and marks", async () => {
    await history();
    await t.mutation(internal.rollups.backfillStep, {
      workspaceId: team.workspaceId, from: "2026-09-01", to: "2026-09-30", phase: "messages", cursor: "500",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 100);
    expect((await t.run((ctx) => ctx.db.get(team.workspaceId)))!.rollupsBackfilledAt).toBe(Date.now());
  });

  test("samples the latest active day, its week and its month by default", async () => {
    await history();
    expect(await verify()).toEqual({ checked: ["d:2027-01-04", "w:2027-W01", "m:2027-01"], mismatches: [] });
  });
});

describe("rolling the readers back to their legacy scans (#30 runbook)", () => {
  test("unmarkBackfilled clears both markers, keeps the maintained rollups, and a rebuild marks again", async () => {
    await history();
    await rebuild();
    const markers = async () =>
      await t.run(async (ctx) => ({
        workspace: (await ctx.db.get(team.workspaceId))!.rollupsBackfilledAt,
        all: (await ctx.db.query("workspaceStats").collect()).find((w) => w.bucket === "all")?.rollupsBackfilledAt,
      }));
    expect(await markers()).toEqual({ workspace: Date.now(), all: Date.now() });
    const maintained = await rollupLines();

    await t.mutation(internal.rollups.unmarkBackfilled, { workspaceId: team.workspaceId });
    expect(await markers()).toEqual({ workspace: undefined, all: undefined });
    expect(await rollupLines()).toEqual(maintained);

    await rebuild();
    expect(await markers()).toEqual({ workspace: Date.now(), all: Date.now() });
  });
});

type LiveOp = { kind: "revoke"; pick: number } | { kind: "give"; at: string; giver: string; receiver: string; ts: string; reaction: boolean };

/** Live traffic across the history's days and their neighbours: gives and revokes. */
function liveOps(random: () => number, n: number): LiveOp[] {
  return Array.from({ length: n }, (_, i): LiveOp => {
    if (random() < 0.3) return { kind: "revoke", pick: random() };
    const day = LIVE_DAYS[Math.floor(random() * LIVE_DAYS.length)];
    const [giver, receiver] = random() < 0.5 ? ["UBEN", "UCLEO"] : ["UCLEO", "UANA"];
    return { kind: "give", at: `${day}T${String(8 + (i % 10)).padStart(2, "0")}:00:00Z`, giver, receiver, ts: `live.${i}`, reaction: random() < 0.3 };
  });
}

async function applyLiveOp(op: LiveOp) {
  if (op.kind === "revoke") {
    const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
    const row = rows[Math.floor(op.pick * rows.length)];
    await t.run(async (ctx) => revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row));
  } else {
    vi.setSystemTime(new Date(op.at));
    await give({ giverSlackId: op.giver, recipientSlackIds: [op.receiver], messageTs: op.ts, source: op.reaction ? "reaction" : "message" });
  }
}

/** Days of `history()` and their neighbours, across week, month, quarter and year edges. */
const LIVE_DAYS = ["2026-09-20", "2026-09-21", "2026-09-23", "2026-09-30", "2026-10-01", "2026-12-31", "2027-01-01", "2027-01-04"];

/** Run the scheduled functions due now (one backfill step); false once nothing is left. */
async function runScheduledStep() {
  const pending = await t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
  );
  if (pending.length === 0) return false;
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
  return true;
}

/** Deterministic PRNG so a failing seed can be replayed. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
