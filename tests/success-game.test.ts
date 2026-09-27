import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { xpForLevel } from "../convex/lib/xp";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * The game's success metrics (#165, design plan #152 S11): claims per active player per week, the
 * share of coins claimed within 7 days, expeditions per active player and crew-quest contributors,
 * kept per month in `successStats` next to #102's, recounted by the rebuild and checked by verify.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  // The game launched in September: the months before it are the baseline, and have no game to measure.
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, notifyGiver: false, notifyReceiver: false, offeringsFrom: 0, successBaselineBefore: "2026-09" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers, 1000);

async function giveAt(iso: string, opts: Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] }) {
  vi.setSystemTime(new Date(iso));
  const result = await t.run(async (ctx) =>
    giveKudos(ctx, {
      workspace: (await ctx.db.get(team.workspaceId))!,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      messageTs: `${Date.parse(iso) / 1000}`,
      noteWords: 5,
      ...opts,
    }),
  );
  expect(result.status).toBe("given");
}

async function rebuild() {
  await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
  await settle();
  vi.setSystemTime(NOW);
}

/** A member at `level` with `coins` and `stamina` to spend. */
const makePlayer = (memberId: typeof team.ana, patch: { level: number; coins?: number; stamina?: number }) =>
  t.run(async (ctx) => {
    const player = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique())!;
    await ctx.db.patch(player._id, { level: patch.level, xp: xpForLevel(patch.level), coins: (player.coins ?? 0) + (patch.coins ?? 0), stamina: patch.stamina ?? 0 });
  });

async function september() {
  const ana = await signInAs(t, team.ana);
  return (await ana.query(api.analytics.successMetrics, { today: TODAY })).months.find((m) => m.month === "2026-09")!;
}

describe("the game's success metrics (#165, S11)", () => {
  test("count claims, coins claimed within a week, expeditions and crew-quest contributors live, and a rebuild recounts the same", async () => {
    await rebuild();
    // Two active players: Ana thanks Ben, Ben thanks Cleo. Each offering waits at the stone.
    await giveAt("2026-09-01T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    await giveAt("2026-09-01T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"] });
    // Ana claims two days later (within the week); Ben never does.
    vi.setSystemTime(new Date("2026-09-03T09:00:00Z"));
    await (await signInAs(t, team.ana)).mutation(api.offerings.claim, {});

    // Ana goes into a near ruin once the tree has opened them.
    await t.run(async (ctx) => {
      const tree = (await ctx.db.query("trees").withIndex("by_workspace", (q) => q.eq("workspaceId", team.workspaceId)).unique())!;
      await ctx.db.patch(tree._id, { peakGrowth: 900, plantedAt: Date.now() });
    });
    await makePlayer(team.ana, { level: 6, stamina: 1, coins: 50 });
    const ana = await signInAs(t, team.ana);
    const ruin = (await ana.query(api.tree.state, {}))!.layout.ruins.find((r) => r.tier === 1)!;
    vi.setSystemTime(new Date("2026-09-10T09:00:00Z"));
    await ana.mutation(api.rpg.start, { ruinId: ruin.id });

    // Ana gives to a crew quest twice and Ben once: two contributors this month.
    const questId = await t.run((ctx) =>
      ctx.db.insert("crewQuests", { workspaceId: team.workspaceId, part: "structure_bell", proposedBy: team.ana, proposedAt: Date.now(), goal: 300, contributed: 0, contributors: 0, status: "proposed" }),
    );
    await makePlayer(team.ben, { level: 3, coins: 20 });
    await ana.mutation(api.crew.contribute, { questId, coins: 5 });
    await ana.mutation(api.crew.contribute, { questId, coins: 5 });
    await (await signInAs(t, team.ben)).mutation(api.crew.contribute, { questId, coins: 5 });
    vi.setSystemTime(NOW);

    const expected = {
      givers: 2,
      // One claim by two active players over the 23 days of September so far.
      claimsPerPlayerWeek: expect.closeTo(1 / 2 / (23 / 7), 5),
      claimedSoonShare: 0.5,
      expeditionsPerPlayer: 0.5,
      crewContributors: 2,
    };
    expect(await september()).toMatchObject(expected);
    // Before the launch there is no game to measure.
    const ana2 = await signInAs(t, team.ana);
    const august = (await ana2.query(api.analytics.successMetrics, { today: TODAY })).months.find((m) => m.month === "2026-08");
    if (august) expect(august).toMatchObject({ claimsPerPlayerWeek: null, claimedSoonShare: null, expeditionsPerPlayer: null, crewContributors: null });
    expect((await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: ["m:2026-09"] })).mismatches).toEqual([]);

    await rebuild();
    expect(await september()).toMatchObject(expected);

    // A revoked kudos takes its waiting offering out of the share: now all of September's coins were claimed within a week.
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      for (const row of (await ctx.db.query("kudos").collect()).filter((k) => k.giverId === team.ben)) await revokeKudosRow(ctx, workspace, row);
    });
    expect(await september()).toMatchObject({ claimedSoonShare: 1 });
    expect((await t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: ["m:2026-09"] })).mismatches).toEqual([]);
  });
});
