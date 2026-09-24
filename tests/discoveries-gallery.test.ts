import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { CATALOG } from "../convex/lib/messages";
import { ANY_MESSAGE } from "../convex/lib/rollups";
import { NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

// The Discoveries gallery's "found by N" and collector counts (#86): exact at any size, read from
// the per-message `messageStats` rollup once the workspace is backfilled.

let t: ReturnType<typeof setupConvex>;
let team: Team;
afterEach(() => vi.useRealTimers());

async function discover(memberId: Id<"members">, templateKey: string, at = NOW.getTime()) {
  const template = CATALOG.find((c) => c.key === templateKey)!;
  await t.run((ctx) =>
    ctx.db.insert("discoveries", {
      workspaceId: team.workspaceId,
      memberId,
      templateKey,
      rarity: template.rarity,
      category: template.category,
      timesSeen: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    }),
  );
}

describe("discoveries.gallery before the workspace is backfilled", () => {
  test("counts finders and collectors from the discoveries themselves", async () => {
    t = setupConvex();
    team = await seedTeam(t);
    await discover(team.ana, CATALOG[0].key);
    await discover(team.ben, CATALOG[0].key);
    await discover(team.ben, CATALOG[1].key);
    const g = await (await signInAs(t, team.ana)).query(api.discoveries.gallery, {});
    expect(g.collectors).toBe(2);
    expect(g.discovered).toBe(1);
    expect(g.items.slice(0, 3).map((i) => [i.discovered, i.foundBy])).toEqual([[true, 2], [false, 1], [false, 0]]);
  });
});

describe("discoveries.gallery at the scale proof's size (500 members, 13k discoveries)", () => {
  const MEMBERS = 500;
  const FOUND_KEYS = CATALOG.slice(0, 40).map((c) => c.key);
  /** Member i found the k-th of FOUND_KEYS unless (i + k) is a multiple of 3: ~27 messages each. */
  const finds = (i: number) => FOUND_KEYS.filter((_, k) => (i + k) % 3 !== 0);

  /** 500 members' discoveries, plus Ana's two (one nobody else has); returns the finders per message. */
  async function seedScaleDiscoveries() {
    const finders = new Map<string, number>();
    await t.run(async (ctx) => {
      for (let i = 0; i < MEMBERS; i++) {
        const memberId = await ctx.db.insert("members", {
          workspaceId: team.workspaceId,
          slackUserId: `USCALE${i}`,
          name: `Scale ${i}`,
          isAdmin: false,
          isBot: false,
          deactivated: false,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
        for (const key of finds(i)) {
          const template = CATALOG.find((c) => c.key === key)!;
          const at = NOW.getTime() - (i * 40 + FOUND_KEYS.indexOf(key)) * 60_000;
          await ctx.db.insert("discoveries", {
            workspaceId: team.workspaceId, memberId, templateKey: key, rarity: template.rarity, category: template.category,
            timesSeen: 1, firstSeenAt: at, lastSeenAt: at,
          });
          finders.set(key, (finders.get(key) ?? 0) + 1);
        }
      }
    });
    for (const key of [CATALOG[0].key, CATALOG[60].key]) {
      await discover(team.ana, key);
      finders.set(key, (finders.get(key) ?? 0) + 1);
    }
    expect([...finders.values()].reduce((n, f) => n + f, 0)).toBeGreaterThan(13_000);
    return finders;
  }

  async function expectExactGallery(finders: Map<string, number>) {
    const g = await (await signInAs(t, team.ana)).query(api.discoveries.gallery, {});
    expect(g.collectors).toBe(MEMBERS + 1);
    expect(g.discovered).toBe(2);
    expect(Object.fromEntries(g.items.map((i) => [i.key, i.foundBy]))).toEqual(
      Object.fromEntries(CATALOG.map((c) => [c.key, finders.get(c.key) ?? 0])),
    );
    // 500 members, a third of whom skip each message: 333 or 334 finders, plus Ana on the first.
    expect(g.items[0].foundBy).toBe(334);
    expect(g.items[60]).toMatchObject({ discovered: true, foundBy: 1 });
  }

  test("reads the per-message rollup and the viewer's own finds, within a few hundred documents", { timeout: 120_000 }, async () => {
    // What the gallery may read: the viewer's session, their own finds (≤ 72), one row per message (≤ 73).
    t = setupConvex({ transactionLimits: { documentsRead: 2 * CATALOG.length + 60 } });
    team = await seedTeam(t, { rollupsBackfilledAt: NOW.getTime() });
    const finders = await seedScaleDiscoveries();
    // The rollup as a backfill leaves it: one row per found message, and the collectors.
    await t.run(async (ctx) => {
      for (const [templateKey, n] of finders) await ctx.db.insert("messageStats", { workspaceId: team.workspaceId, templateKey, finders: n });
      await ctx.db.insert("messageStats", { workspaceId: team.workspaceId, templateKey: ANY_MESSAGE, finders: MEMBERS + 1 });
    });
    await expectExactGallery(finders);
  });

  test("is exact once the backfill's message steps have run, each within Convex's limits", { timeout: 120_000 }, async () => {
    t = setupConvex({ transactionLimits: true });
    team = await seedTeam(t);
    const finders = await seedScaleDiscoveries();
    // The backfill's last phases on a workspace with sources only: every message, the collectors, the marker.
    await t.mutation(internal.rollups.backfillStep, {
      workspaceId: team.workspaceId, from: "2026-09-01", to: "2026-09-30", phase: "messages", cursor: "0",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 200);
    expect((await t.run((ctx) => ctx.db.get(team.workspaceId)))!.rollupsBackfilledAt).toBe(NOW.getTime());
    await expectExactGallery(finders);
    const workspaceId = team.workspaceId;
    expect((await t.query(internal.rollups.verify, { workspaceId, buckets: [`messages:${ANY_MESSAGE}`] })).mismatches).toEqual([]);
  });
});
