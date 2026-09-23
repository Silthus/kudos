import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { seedTeam, setupConvex, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => vi.useRealTimers());

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

const ROLLUP_TABLES = ["workspaceStats", "memberStats", "pairStats", "channelStats"] as const;

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
    });
    expect(await rollupLines()).not.toEqual(maintained);

    await rebuild();
    expect(await rollupLines()).toEqual(maintained);
  });

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
    await history();
    const random = mulberry32(7);
    // Rollups as a workspace has them before its first backfill: partly missing, partly wrong.
    await t.run(async (ctx) => {
      for (const table of ROLLUP_TABLES) {
        for (const row of await ctx.db.query(table).collect()) if (random() < 0.5) await ctx.db.delete(row._id);
      }
      for (const row of await ctx.db.query("memberStats").collect()) await ctx.db.patch(row._id, { given: row.given + 2 });
    });

    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    let steps = 0;
    while (await runScheduledStep()) {
      steps += 1;
      if (random() < 0.3) {
        const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
        const row = rows[Math.floor(random() * rows.length)];
        await t.run(async (ctx) => revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row));
      } else {
        const day = LIVE_DAYS[Math.floor(random() * LIVE_DAYS.length)];
        const [giver, receiver] = random() < 0.5 ? ["UBEN", "UCLEO"] : ["UCLEO", "UANA"];
        vi.setSystemTime(new Date(`${day}T${String(8 + steps % 10).padStart(2, "0")}:00:00Z`));
        await give({ giverSlackId: giver, recipientSlackIds: [receiver], messageTs: `live.${steps}`, source: random() < 0.3 ? "reaction" : "message" });
      }
    }
    expect(steps).toBeGreaterThan(20);
    const concurrent = await rollupLines();

    await rebuild();
    expect(concurrent).toEqual(await rollupLines());
  });
});

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
