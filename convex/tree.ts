import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { gameOn, gameShownTo, superseded, thankedBack } from "./game";
import { sendGains } from "./gains";
import { canSeeReceived, requireViewer, type Viewer } from "./lib/access";
import { hasNote } from "./lib/quests";
import { fnv1a } from "./lib/random";
import { DAY_MS, workspaceNow } from "./lib/time";
import {
  districtsOpen,
  growthFor,
  growthToReach,
  layout,
  RING_GROWTH,
  ringsForGrowth,
  SEED_AUTO_PLANT_DAYS,
  seedsForLine,
  stageForGrowth,
  TREE_STAGE_BY_ID,
  TREE_STAGES,
  type TreeStageId,
} from "./lib/tree";
import { SEEDS_COUNTED, type TreeView } from "./lib/treeView";
import { treeStageValidator } from "./schema";

/**
 * The Ancient Tree's backend (#154; design plan #152 S1, S9 and its seeds amendment). The rules are
 * `lib/tree.ts`; this module keeps the state:
 *
 * - **Seeds** (`seeds`): a qualifying kudos sows one per kudos row, in the give transaction; a
 *   revoke deletes it (a planted one takes its sap back). Sown whether or not the game is on: the
 *   tree is the company's appreciation, so switching the game on shows a tree grown from all of it.
 * - **Planting**: the receiver plants their seeds at the tree (`plantSeeds`), or time does after
 *   SEED_AUTO_PLANT_DAYS (`autoPlant`, hourly; a simulator's whenever its clock moves).
 * - **The tree** (`trees`): `sap` counts planted seeds, `fuel` what givers claim at the offering
 *   stone (#157, `addFuel`), and `peakGrowth` never goes down: the stage every system uses is
 *   `stageForGrowth(peakGrowth)`. Its **seed moment** is the first planting: the giver of the first
 *   seed is its planter, and a gain DM tells them (through the gains pipeline, so like every gain it
 *   is never sent while the game is off or hidden from them, and never resent). A stage reached is a
 *   `treeEvents` row and, while the game is on, one post in the announcement channel; the peak never
 *   falls, so a stage is reached (and posted) once, whatever revokes do later.
 * - **Repair**: `backfillWorkspace` sows the seeds history never sowed (once per workspace), `rebuild`
 *   recounts `sap` from the planted seeds, exactly even while members keep planting, `verify` compares.
 *
 * Privacy: a planting is a count of kudos received, and the tree's sap is public, so the log names
 * who planted only to viewers who may see their received counts (`canSeeReceived`); where nobody
 * sees received counts, members see that they have seeds to plant, never how many.
 */

/** The log keeps this many plantings per workspace (the seed moment, stages and rings are all kept). */
export const PLANTINGS_KEPT = 200;
/** Events `state` returns (the world's toasts); the notice board pages through `events`. */
const STATE_EVENTS = 20;
/** Seeds one planting takes: a receiver with more plants the rest with the next press; time, with the next step. */
export const PLANT_BATCH = 500;
/** Seeds the auto-plant cron reads to find the workspaces with seeds due. */
const DUE_SCAN = 1500;
const BACKFILL_PAGE = 400; // kudos rows a backfill step reads, each with a seed lookup and a thank-back read
const REBUILD_PAGE = 700; // seeds a rebuild step reads, each with its kudos row
const WORKSPACES_PAGE = 100;
const COUNT_PAGE = 1500;
const AUTO_PLANT_MS = SEED_AUTO_PLANT_DAYS * DAY_MS;

// ── The world's seed ────────────────────────────────────────────────────────

/** A new workspace's world seed: a uint32 (lib/tree.ts). */
export function newWorldSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** The workspace's world seed; workspaces from before the tree get one from their id until the backfill writes it. */
export function worldSeedOf(workspace: Pick<Doc<"workspaces">, "_id" | "worldSeed">): number {
  return workspace.worldSeed ?? fnv1a(`world:${workspace._id}`);
}

// ── Seeds ───────────────────────────────────────────────────────────────────

export async function treeOf(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("trees")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}

/** Whether a kudos row is a qualifying line (a Note of 3+ words, not a thank-back, not a spree's pooled kudos). */
async function qualifying(ctx: QueryCtx, row: Doc<"kudos">): Promise<boolean> {
  if (row.source === "spree" || !hasNote(row.noteWords)) return false;
  return !(await thankedBack(ctx, row.giverId, row.receiverId, row.at));
}

/** Called from `giveKudos` with a batch's rows: sows a seed for each qualifying one. Returns who got one. */
export async function sowSeeds(ctx: MutationCtx, workspace: Doc<"workspaces">, rows: Doc<"kudos">[]): Promise<Set<Id<"members">>> {
  const sownFor = new Set<Id<"members">>();
  for (const row of rows) {
    if (seedsForLine({ qualifying: await qualifying(ctx, row) }) === 0) continue;
    await ctx.db.insert("seeds", { workspaceId: workspace._id, kudosId: row._id, giverId: row.giverId, receiverId: row.receiverId, sownAt: row.at });
    sownFor.add(row.receiverId);
  }
  return sownFor;
}

/** Called from `revokeKudosRow`: the kudos' seed goes, and a planted one takes its sap back. */
export async function onTreeRevoked(ctx: MutationCtx, workspace: Doc<"workspaces">, row: Doc<"kudos">) {
  const seed = await ctx.db
    .query("seeds")
    .withIndex("by_kudos", (q) => q.eq("kudosId", row._id))
    .first();
  if (seed) await unsow(ctx, workspace, seed);
}

/** Deletes a seed; a planted one takes its sap back (a revoke, a removal, a rebuild's orphan). */
export async function unsow(ctx: MutationCtx, workspace: Doc<"workspaces">, seed: Doc<"seeds">) {
  await ctx.db.delete(seed._id);
  if (seed.plantedAt !== undefined) await grow(ctx, workspace, { unplanted: [seed], at: workspaceNow(workspace) });
}

/** A member's seeds still to plant, oldest first. */
function unplanted(ctx: QueryCtx, receiverId: Id<"members">) {
  return ctx.db.query("seeds").withIndex("by_receiver_plantedAt_sownAt", (q) => q.eq("receiverId", receiverId).eq("plantedAt", undefined));
}

/**
 * How many seeds a member has to plant, as they may see it: up to SEEDS_COUNTED (that many or
 * more), and null where the workspace hides received counts even from the member themselves.
 */
export async function seedsToPlant(ctx: QueryCtx, workspace: Doc<"workspaces">, memberId: Id<"members">) {
  const n = (await unplanted(ctx, memberId).take(SEEDS_COUNTED)).length;
  return { count: workspace.receivedVisibility === "hidden" ? null : n, any: n > 0 };
}

// ── Growth ──────────────────────────────────────────────────────────────────

type Growth = {
  /** Seeds just planted, oldest first: one sap each. The first planting ever is the seed moment. */
  planted?: Doc<"seeds">[];
  /** Planted seeds taken away (revoked): one sap back each. */
  unplanted?: Doc<"seeds">[];
  /** Fuel claimed at the offering stone (#157); negative when a claimed offering is revoked. */
  fuel?: number;
  at: number;
  /** A live act (not a backfill or a rebuild): the seed moment is DMed and stages are posted. */
  live?: boolean;
  /** A planting to log: by a receiver (named) or by time. */
  log?: { by: "receiver" | "time"; memberId?: Id<"members"> };
};

/**
 * The one way the tree grows or shrinks. The tree row appears with its first growth; its seed moment
 * is its first planting. The peak only rises: each stage (and ring) it passes is an event, and the
 * stage it reaches live is posted. A rebuild in progress counts changes to seeds it has passed.
 */
async function grow(ctx: MutationCtx, workspace: Doc<"workspaces">, change: Growth) {
  const { planted = [], unplanted = [], fuel = 0, at, live = false, log } = change;
  const sap = planted.length - unplanted.length;
  let tree = await treeOf(ctx, workspace._id);
  if (!tree) {
    if (sap <= 0 && fuel <= 0) return;
    const id = await ctx.db.insert("trees", { workspaceId: workspace._id, sap: 0, fuel: 0, peakGrowth: 0, plantings: 0 });
    tree = (await ctx.db.get(id))!;
  }
  const first = tree.plantedAt === undefined ? planted[0] : undefined; // the seed moment
  const through = tree.rebuild?.through;
  const passed = (seeds: Doc<"seeds">[]) => (through === undefined ? 0 : seeds.filter((s) => s._creationTime <= through).length);
  const counted = passed(planted) - passed(unplanted);
  const next = { sap: tree.sap + sap, fuel: tree.fuel + fuel };
  const peakGrowth = Math.max(tree.peakGrowth, growthFor(next));
  const plantings = tree.plantings + (log ? 1 : 0);
  await ctx.db.patch(tree._id, {
    ...next,
    peakGrowth,
    plantings: Math.min(plantings, PLANTINGS_KEPT),
    ...(first ? { plantedAt: first.plantedAt ?? at, plantedBy: first.giverId } : {}),
    ...(counted !== 0 ? { rebuild: { through: through!, count: tree.rebuild!.count + counted } } : {}),
  });
  if (first) {
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "seed", at: first.plantedAt ?? at, memberId: first.giverId });
    const receiver = live ? await ctx.db.get(first.receiverId) : null;
    if (receiver) await sendGains(ctx, workspace, first.giverId, [{ kind: "tree_seed", receiver: { slackUserId: receiver.slackUserId, name: receiver.name } }]);
  }
  if (log) {
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "growth", at, seeds: sap, ...log });
    if (plantings > PLANTINGS_KEPT) await forgetOldestPlanting(ctx, workspace._id);
  }
  await recordRise(ctx, workspace, tree.peakGrowth, peakGrowth, at, live);
}

/** The log keeps the last PLANTINGS_KEPT plantings: one in, the oldest out. */
async function forgetOldestPlanting(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const oldest = await ctx.db
    .query("treeEvents")
    .withIndex("by_workspace_kind_at", (q) => q.eq("workspaceId", workspaceId).eq("kind", "growth"))
    .first();
  if (oldest) await ctx.db.delete(oldest._id);
}

/** The stages and rings a rise of the peak passed, as events; the stage reached live is posted. */
async function recordRise(ctx: MutationCtx, workspace: Doc<"workspaces">, from: number, to: number, at: number, live: boolean) {
  if (to <= from) return;
  const before = TREE_STAGE_BY_ID[stageForGrowth(from)].index;
  const after = TREE_STAGE_BY_ID[stageForGrowth(to)].index;
  for (const stage of TREE_STAGES.slice(before + 1, after + 1)) {
    const id = await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "stage", at, stage: stage.id });
    if (live && stage.index === after) await announceStage(ctx, workspace, id);
  }
  const rings = ringsForGrowth(to);
  if (rings > ringsForGrowth(from)) await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "ring", at, rings });
}

/** Posts a stage in the announcement channel (#97's), while the game is on; the demo and simulators have no Slack. */
async function announceStage(ctx: MutationCtx, workspace: Doc<"workspaces">, eventId: Id<"treeEvents">) {
  const channel = workspace.isDemo || workspace.status !== "active" || !gameOn(workspace) ? undefined : workspace.announceChannel;
  if (!channel) return;
  await ctx.db.patch(eventId, { announcement: { status: "pending", channelId: channel.id } });
  await ctx.scheduler.runAfter(0, internal.slack.postTreeStage, { eventId });
}

/**
 * Fuel claimed at the offering stone (#157): half a point of growth each (`growthFor`); negative to
 * take a revoked claim back. Fuel before any planting grows the desert's tree-to-be, but only a
 * planting is its seed moment.
 */
export async function addFuel(ctx: MutationCtx, workspace: Doc<"workspaces">, fuel: number, at: number) {
  if (fuel !== 0) await grow(ctx, workspace, { fuel, at, live: true });
}

/** Plants `seeds` (all of one workspace, unplanted) and grows the tree by them, with a planting in the log. */
async function plant(ctx: MutationCtx, workspace: Doc<"workspaces">, seeds: Doc<"seeds">[], by: "receiver" | "time", at: number) {
  if (seeds.length === 0) return;
  for (const s of seeds) await ctx.db.patch(s._id, { plantedAt: at, plantedBy: by });
  const planted = seeds.map((s) => ({ ...s, plantedAt: at, plantedBy: by })).sort((a, b) => a.sownAt - b.sownAt);
  await grow(ctx, workspace, { planted, at, live: true, log: by === "receiver" ? { by, memberId: seeds[0].receiverId } : { by } });
}

/**
 * The ritual at the tree: the viewer plants the seeds they have, up to PLANT_BATCH at once (`more`:
 * press again). `planted` is null where the workspace hides received counts even from the member.
 */
export const plantSeeds = mutation({
  args: {},
  returns: v.object({ planted: v.union(v.number(), v.null()), more: v.boolean() }),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("The tree is part of the game: switch it on (or show it on your Me page) to plant seeds.");
    const seeds = await unplanted(ctx, member._id).take(PLANT_BATCH);
    await plant(ctx, workspace, seeds, "receiver", workspaceNow(workspace));
    const more = (await unplanted(ctx, member._id).first()) !== null;
    return { planted: workspace.receivedVisibility === "hidden" ? null : seeds.length, more };
  },
});

/**
 * Hourly: finds the workspaces with seeds nobody planted in SEED_AUTO_PLANT_DAYS and plants each in
 * its own steps (`autoPlantIn`). It reads the due seeds by the wall clock on purpose: every workspace's
 * clock is at or ahead of it, so what is due by it is due in its workspace too. Simulators, whose
 * clocks run ahead, are planted as their clock moves (simulator.ts).
 */
export const autoPlant = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("seeds")
      .withIndex("by_plantedAt_sownAt", (q) => q.eq("plantedAt", undefined).lte("sownAt", Date.now() - AUTO_PLANT_MS))
      .take(DUE_SCAN);
    for (const workspaceId of new Set(due.map((s) => s.workspaceId))) {
      await ctx.scheduler.runAfter(0, internal.tree.autoPlantIn, { workspaceId });
    }
    return null;
  },
});

/** One workspace's due seeds, PLANT_BATCH a step until none is left. */
export const autoPlantIn = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (workspace && (await autoPlantWorkspace(ctx, workspace)) === PLANT_BATCH) {
      await ctx.scheduler.runAfter(0, internal.tree.autoPlantIn, { workspaceId });
    }
    return null;
  },
});

/** Plants, by time, up to PLANT_BATCH of a workspace's seeds due on its own clock. Returns how many. */
export async function autoPlantWorkspace(ctx: MutationCtx, workspace: Doc<"workspaces">): Promise<number> {
  const now = workspaceNow(workspace);
  const seeds = await ctx.db
    .query("seeds")
    .withIndex("by_workspace_plantedAt_sownAt", (q) => q.eq("workspaceId", workspace._id).eq("plantedAt", undefined).lte("sownAt", now - AUTO_PLANT_MS))
    .take(PLANT_BATCH);
  await plant(ctx, workspace, seeds, "time", now);
  return seeds.length;
}

// ── Backfill, rebuild, verify ──────────────────────────────────────────────

/**
 * Sows the seeds a workspace's history never sowed (kudos from before the tree, or the demo's seeded
 * year), BACKFILL_PAGE kudos rows a step, oldest first, each planted by time (the conductor's scope
 * for #154: nobody was ever asked to plant them): when it would have planted itself, or now for the
 * last 30 days'. The first one plants the tree. Never a DM or a post. Once per workspace (`seedsBackfilledAt`):
 * after it, a kudos row without a seed was judged when it was given (a thank-back stays one even if
 * what it thanked is revoked later). Writes the world seed when it's missing.
 */
export const backfillWorkspace = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    resetAt: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, cursor }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || superseded(workspace, resetAt)) return null;
    if (cursor === undefined && workspace.seedsBackfilledAt !== undefined) return null;
    if (workspace.worldSeed === undefined) await ctx.db.patch(workspaceId, { worldSeed: worldSeedOf(workspace) });
    const now = workspaceNow(workspace);
    const page = await ctx.db
      .query("kudos")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: BACKFILL_PAGE, cursor: cursor ?? null });
    const planted: Doc<"seeds">[] = [];
    for (const row of page.page) {
      const seed = await ctx.db
        .query("seeds")
        .withIndex("by_kudos", (q) => q.eq("kudosId", row._id))
        .first();
      if (seed || seedsForLine({ qualifying: await qualifying(ctx, row) }) === 0) continue;
      const plantedAt = Math.min(row.at + AUTO_PLANT_MS, now);
      const id = await ctx.db.insert("seeds", { workspaceId, kudosId: row._id, giverId: row.giverId, receiverId: row.receiverId, sownAt: row.at, plantedAt, plantedBy: "time" });
      planted.push((await ctx.db.get(id))!);
    }
    // Rows come oldest first: the first seed plants the tree, and the page's stages date from its latest planting.
    if (planted.length > 0) await grow(ctx, workspace, { planted, at: Math.max(...planted.map((s) => s.plantedAt!)) });
    if (page.isDone) await ctx.db.patch(workspaceId, { seedsBackfilledAt: Date.now() });
    else await ctx.scheduler.runAfter(0, internal.tree.backfillWorkspace, { workspaceId, resetAt, cursor: page.continueCursor });
    return null;
  },
});

/**
 * Backfills every workspace that hasn't been (the deploy step: `npx convex run tree:backfillAll`),
 * WORKSPACES_PAGE a step; never simulators (live from the start) or the demo mid-reset (its reset backfills).
 */
export const backfillAll = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("workspaces").paginate({ numItems: WORKSPACES_PAGE, cursor: cursor ?? null });
    for (const workspace of page.page) {
      if (workspace.simulator || workspace.resettingSince !== undefined || workspace.seedsBackfilledAt !== undefined) continue;
      await ctx.scheduler.runAfter(0, internal.tree.backfillWorkspace, { workspaceId: workspace._id });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.tree.backfillAll, { cursor: page.continueCursor });
    return null;
  },
});

/**
 * Recounts a tree's sap from its planted seeds (the repair tool), REBUILD_PAGE seeds a step in
 * creation order, deleting seeds whose kudos is gone. Exact while members keep planting: `grow` adds
 * a change to a seed the recount has passed to its count (`trees.rebuild`), and the recount reads the
 * rest as it finds them. The peak never goes down. One at a time: a start while one runs is refused
 * unless `force` (for a rebuild that stopped).
 */
export const rebuild = internalMutation({
  args: { workspaceId: v.id("workspaces"), cursor: v.optional(v.string()), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, cursor, force }) => {
    const workspace = await ctx.db.get(workspaceId);
    let tree = workspace && (await treeOf(ctx, workspaceId));
    if (!workspace || !tree) return null;
    if (cursor === undefined) {
      if (tree.rebuild && !force) {
        console.warn(`tree rebuild: ${workspace.name} (${workspaceId}) is being rebuilt already; pass "force": true if that one stopped.`);
        return null;
      }
      await ctx.db.patch(tree._id, { rebuild: { through: 0, count: 0 } });
    }
    const page = await ctx.db
      .query("seeds")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: REBUILD_PAGE, cursor: cursor ?? null });
    let counted = 0;
    for (const seed of page.page) {
      if (!(await ctx.db.get(seed.kudosId))) await unsow(ctx, workspace, seed);
      else if (seed.plantedAt !== undefined) counted++;
    }
    tree = (await treeOf(ctx, workspaceId))!;
    const count = tree.rebuild!.count + counted;
    if (!page.isDone) {
      await ctx.db.patch(tree._id, { rebuild: { through: page.page.at(-1)?._creationTime ?? tree.rebuild!.through, count } });
      await ctx.scheduler.runAfter(0, internal.tree.rebuild, { workspaceId, cursor: page.continueCursor });
      return null;
    }
    const peakGrowth = Math.max(tree.peakGrowth, growthFor({ sap: count, fuel: tree.fuel }));
    await ctx.db.patch(tree._id, { rebuild: undefined, sap: count, peakGrowth });
    await recordRise(ctx, workspace, tree.peakGrowth, peakGrowth, workspaceNow(workspace), false);
    return null;
  },
});

/** One page of a workspace's seeds, counted (verify's read). */
export const countSeeds = internalQuery({
  args: { workspaceId: v.id("workspaces"), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ planted: v.number(), unplanted: v.number(), isDone: v.boolean(), cursor: v.string() }),
  handler: async (ctx, { workspaceId, cursor }) => {
    const page = await ctx.db
      .query("seeds")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: COUNT_PAGE, cursor });
    const planted = page.page.filter((s) => s.plantedAt !== undefined).length;
    return { planted, unplanted: page.page.length - planted, isDone: page.isDone, cursor: page.continueCursor };
  },
});

export const storedTree = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(v.null(), v.object({ sap: v.number(), fuel: v.number(), peakGrowth: v.number() })),
  handler: async (ctx, { workspaceId }) => {
    const tree = await treeOf(ctx, workspaceId);
    return tree ? { sap: tree.sap, fuel: tree.fuel, peakGrowth: tree.peakGrowth } : null;
  },
});

type Verified = { stored: number; planted: number; unplanted: number; peakGrowth: number; ok: boolean };

/** Compares a tree's stored sap with a recount of its planted seeds (read-only; `rebuild` repairs). */
export const verify = internalAction({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ stored: v.number(), planted: v.number(), unplanted: v.number(), peakGrowth: v.number(), ok: v.boolean() }),
  handler: async (ctx, { workspaceId }): Promise<Verified> => {
    let planted = 0;
    let unplanted = 0;
    let cursor: string | null = null;
    for (;;) {
      const page: { planted: number; unplanted: number; isDone: boolean; cursor: string } = await ctx.runQuery(internal.tree.countSeeds, { workspaceId, cursor });
      planted += page.planted;
      unplanted += page.unplanted;
      if (page.isDone) break;
      cursor = page.cursor;
    }
    const tree: { sap: number; peakGrowth: number } | null = await ctx.runQuery(internal.tree.storedTree, { workspaceId });
    const stored = tree?.sap ?? 0;
    return { stored, planted, unplanted, peakGrowth: tree?.peakGrowth ?? 0, ok: stored === planted };
  },
});

// ── Reading it ──────────────────────────────────────────────────────────────

/**
 * The meter: current growth still needed for the stage after the one the peak reached (past the
 * world tree, its next ring). Only the meter reads current growth, which a revoke can lower.
 */
function meter(growth: number, peakGrowth: number): { stage: TreeStageId | "ring"; growth: number } {
  const next = TREE_STAGES[TREE_STAGE_BY_ID[stageForGrowth(peakGrowth)].index + 1];
  if (next) return { stage: next.id, growth: growthToReach(growth, next.id) };
  const ring = TREE_STAGE_BY_ID.world_tree.growth + (ringsForGrowth(peakGrowth) + 1) * RING_GROWTH;
  return { stage: "ring", growth: Math.max(0, ring - growth) };
}

const tileValidator = v.object({ x: v.number(), y: v.number() });

const eventValidator = v.object({
  _id: v.id("treeEvents"),
  kind: v.union(v.literal("seed"), v.literal("growth"), v.literal("stage"), v.literal("ring")),
  at: v.number(),
  /** seed: the tree's planter; growth: who planted, where the viewer may see their received counts. Null otherwise, or once they left. */
  who: v.union(v.null(), v.string()),
  seeds: v.optional(v.number()), // growth: how many were planted
  by: v.optional(v.union(v.literal("receiver"), v.literal("time"))), // growth
  stage: v.optional(treeStageValidator), // stage: the stage reached
  rings: v.optional(v.number()), // ring: the rings the tree has now
});

async function eventView(ctx: QueryCtx, viewer: Viewer, e: Doc<"treeEvents">) {
  const named = e.memberId && (e.kind === "seed" || canSeeReceived(viewer, e.memberId)) ? await ctx.db.get(e.memberId) : null;
  return {
    _id: e._id,
    kind: e.kind,
    at: e.at,
    who: named?.name ?? null,
    ...(e.kind === "growth" ? { seeds: e.seeds ?? 0, by: e.by } : {}),
    ...(e.stage ? { stage: e.stage } : {}),
    ...(e.rings !== undefined ? { rings: e.rings } : {}),
  };
}

/**
 * The tree as the world draws it (reactive): its stage (from the peak), current growth and the meter
 * to the next stage, sap and fuel, rings, who planted it, the viewer's seeds to plant, the layout of
 * every district, home plot and ruin (`lib/tree.ts layout`) and the latest events. A workspace that
 * hasn't planted yet is a desert: `planted` false. Null while the game isn't shown to the viewer.
 */
export const state = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      planted: v.boolean(),
      stage: treeStageValidator,
      growth: v.number(),
      peakGrowth: v.number(),
      sap: v.number(),
      fuel: v.number(),
      rings: v.number(),
      next: v.object({ stage: v.union(treeStageValidator, v.literal("ring")), growth: v.number() }),
      plantedBy: v.union(v.null(), v.string()),
      plantedAt: v.union(v.null(), v.number()),
      /** Up to SEEDS_COUNTED (that many or more); null where the workspace hides received counts. */
      seedsToPlant: v.union(v.null(), v.number()),
      hasSeedsToPlant: v.boolean(),
      worldSeed: v.number(),
      layout: v.object({
        tree: tileValidator,
        stage: treeStageValidator,
        rings: v.number(),
        districts: v.array(v.object({ id: v.string(), at: tileValidator, open: v.boolean() })),
        homes: v.array(tileValidator),
        ruins: v.array(v.object({ id: v.string(), name: v.string(), tier: v.number(), at: tileValidator })),
      }),
      events: v.array(eventValidator),
    }),
  ),
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    if (!gameShownTo(workspace, member)) return null;
    const tree = await treeOf(ctx, workspace._id);
    const growth = tree ? growthFor(tree) : 0;
    const peakGrowth = tree?.peakGrowth ?? 0;
    const planter = tree?.plantedBy ? await ctx.db.get(tree.plantedBy) : null;
    const events = await ctx.db
      .query("treeEvents")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(STATE_EVENTS);
    const seeds = await seedsToPlant(ctx, workspace, member._id);
    const worldSeed = worldSeedOf(workspace);
    return {
      planted: tree?.plantedAt !== undefined,
      stage: stageForGrowth(peakGrowth),
      growth,
      peakGrowth,
      sap: tree?.sap ?? 0,
      fuel: tree?.fuel ?? 0,
      rings: ringsForGrowth(peakGrowth),
      next: meter(growth, peakGrowth),
      plantedBy: planter?.name ?? null,
      plantedAt: tree?.plantedAt ?? null,
      seedsToPlant: seeds.count,
      hasSeedsToPlant: seeds.any,
      worldSeed,
      layout: layout(worldSeed, peakGrowth),
      events: await Promise.all(events.map((e) => eventView(ctx, viewer, e))),
    };
  },
});

/** The tree's log, newest first, for the notice board. Empty while the game isn't shown to the viewer. */
export const events = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(eventValidator),
  handler: async (ctx, { paginationOpts }) => {
    const viewer = await requireViewer(ctx);
    if (!gameShownTo(viewer.workspace, viewer.member)) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("treeEvents")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", viewer.workspace._id))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((e) => eventView(ctx, viewer, e))) };
  },
});

/** The tree for App Home and `/kudos tree` (lib/treeView.ts); null unless the game is shown to the member. */
export async function treeView(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">): Promise<TreeView | null> {
  if (!gameShownTo(workspace, member)) return null;
  const tree = await treeOf(ctx, workspace._id);
  const growth = tree ? growthFor(tree) : 0;
  const peakGrowth = tree?.peakGrowth ?? 0;
  const stage = stageForGrowth(peakGrowth);
  const next = meter(growth, peakGrowth);
  const seeds = await seedsToPlant(ctx, workspace, member._id);
  return {
    planted: tree?.plantedAt !== undefined,
    stage,
    growth,
    next: next.stage,
    toNext: next.growth,
    rings: ringsForGrowth(peakGrowth),
    districtsOpen: districtsOpen(stage).length,
    seedsToPlant: seeds.count,
    hasSeedsToPlant: seeds.any,
  };
}

// ── The stage post ─────────────────────────────────────────────────────────

/** What to post for a stage event: the bot token, the channel and the stage; null when there's no Slack to post to. */
export const stagePost = internalQuery({
  args: { eventId: v.id("treeEvents") },
  returns: v.union(v.null(), v.object({ token: v.string(), channelId: v.string(), stage: treeStageValidator })),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    const channelId = event?.announcement?.channelId;
    if (!event || !channelId || !event.stage) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", event.workspaceId))
      .unique();
    return install ? { token: install.botToken, channelId, stage: event.stage } : null;
  },
});

/** How a stage's post went (kept on its event). */
export const stagePosted = internalMutation({
  args: { eventId: v.id("treeEvents"), outcome: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { eventId, outcome, error }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return null; // wiped meanwhile
    const channelId = event.announcement?.channelId;
    await ctx.db.patch(eventId, { announcement: { status: outcome, channelId, ...(outcome === "failed" ? { error: error ?? "unknown_error" } : {}) } });
    return null;
  },
});
