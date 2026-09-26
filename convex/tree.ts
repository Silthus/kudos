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
  growthToNext,
  layout,
  ringsForGrowth,
  SEED_AUTO_PLANT_DAYS,
  seedsForLine,
  stageForGrowth,
  TREE_STAGE_BY_ID,
  TREE_STAGES,
} from "./lib/tree";
import type { TreeView } from "./lib/treeView";
import { treeStageValidator } from "./schema";

/**
 * The Ancient Tree's backend (#154; design plan #152 S1, S9 and its seeds amendment). The rules are
 * `lib/tree.ts`; this module keeps the state:
 *
 * - **Seeds** (`seeds`): a qualifying kudos sows one per kudos row, in the give transaction; a
 *   revoke deletes it (a planted one takes its sap back). Sown whether or not the game is on: the
 *   tree is the company's appreciation, so switching the game on shows a tree grown from all of it.
 * - **Planting**: the receiver plants all their seeds at once at the tree (`plantSeeds`), or time
 *   does after SEED_AUTO_PLANT_DAYS (`autoPlant`, the cron; a simulator's clock at each day it moves).
 * - **The tree** (`trees`): created at the **seed moment**, the workspace's first planting, with the
 *   giver of the first seed as its planter (a gain DM tells them). `sap` counts planted seeds,
 *   `fuel` what givers claim at the offering stone (#157 adds it through `growTree`), `peakGrowth`
 *   never goes down, and the stage every system uses is `stageForGrowth(peakGrowth)`. A stage
 *   reached is a `treeEvents` row and, while the game is on, one post in the announcement channel;
 *   since the peak never falls, a stage is reached (and posted) once, whatever revokes do later.
 * - **Repair**: `backfillWorkspace` sows the seeds history never sowed (planted by time), `rebuild`
 *   recounts `sap` from the planted seeds exactly even while members keep planting, `verify` compares.
 *
 * Who planted seeds is shown by name, but how many only where the workspace shows received counts
 * (`canSeeReceived`): a planting is a count of kudos received.
 */

/** The tree log keeps this many events per workspace; older ones are trimmed. */
export const TREE_EVENTS_KEPT = 200;
/** Events `state` returns (the world's toasts); the notice board pages through `events`. */
const STATE_EVENTS = 20;
/** Seeds one planting takes (a receiver with more plants the rest with the next press). */
export const PLANT_BATCH = 500;
/** Unplanted seeds a count reads; more still shows as this many. */
const MAX_SEEDS_COUNTED = 1000;
/** Rows one step of the cron, the backfill or the rebuild touches. */
const STEP_ROWS = 1500;
const BACKFILL_PAGE = 400; // kudos rows a backfill step reads, each with a seed lookup and a thank-back read
const REBUILD_PAGE = 700; // seeds a rebuild step reads, each with its kudos row
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

/** Deletes a seed; a planted one takes its sap back (a revoke, a removal). */
export async function unsow(ctx: MutationCtx, workspace: Doc<"workspaces">, seed: Doc<"seeds">) {
  await ctx.db.delete(seed._id);
  if (seed.plantedAt !== undefined) await growTree(ctx, workspace, { sap: -1, seeds: [seed], at: workspaceNow(workspace) });
}

/** A member's seeds still to plant, oldest first. */
function unplanted(ctx: QueryCtx, receiverId: Id<"members">) {
  return ctx.db.query("seeds").withIndex("by_receiver_plantedAt_sownAt", (q) => q.eq("receiverId", receiverId).eq("plantedAt", undefined));
}

/** How many seeds a member has to plant (at most MAX_SEEDS_COUNTED). */
export async function seedsToPlant(ctx: QueryCtx, memberId: Id<"members">): Promise<number> {
  return (await unplanted(ctx, memberId).take(MAX_SEEDS_COUNTED)).length;
}

// ── Growth ──────────────────────────────────────────────────────────────────

type Growth = {
  sap?: number;
  fuel?: number;
  /** The seeds behind a sap change: a rebuild in progress counts the ones it has passed. */
  seeds?: Doc<"seeds">[];
  at: number;
  /** A live act (not a backfill or a rebuild): the seed moment is DMed and stages are posted. */
  live?: boolean;
  /** A planting to log as a growth event: by whom (a receiver, named) or by time. */
  log?: { by: "receiver" | "time"; memberId?: Id<"members"> };
};

/**
 * The one way the tree grows or shrinks: sap from planting (and revokes), fuel from the offering
 * stone (#157). The first growth plants the tree (the seed moment: `seeds[0]`'s giver is its planter).
 * The peak only rises; each stage it passes is an event, and the stage it reaches live is posted.
 */
export async function growTree(ctx: MutationCtx, workspace: Doc<"workspaces">, change: Growth) {
  const { sap = 0, fuel = 0, seeds = [], at, live = false, log } = change;
  let tree = await treeOf(ctx, workspace._id);
  if (!tree) {
    if (sap <= 0 && fuel <= 0) return;
    const first = seeds[0];
    const id = await ctx.db.insert("trees", {
      workspaceId: workspace._id,
      sap: 0,
      fuel: 0,
      peakGrowth: 0,
      plantedAt: at,
      ...(first ? { plantedBy: first.giverId } : {}),
    });
    tree = (await ctx.db.get(id))!;
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "seed", at, ...(first ? { memberId: first.giverId } : {}) });
    if (first && live) {
      const receiver = await ctx.db.get(first.receiverId);
      if (receiver) await sendGains(ctx, workspace, first.giverId, [{ kind: "tree_seed", receiver: { slackUserId: receiver.slackUserId, name: receiver.name } }]);
    }
  }
  const next = { sap: tree.sap + sap, fuel: tree.fuel + fuel };
  const peakGrowth = Math.max(tree.peakGrowth, growthFor(next));
  // A rebuild counts the seeds it has passed; a change to one of those is a change to its count.
  const passed = tree.rebuild ? seeds.filter((s) => s._creationTime <= tree.rebuild!.through).length * Math.sign(sap) : 0;
  await ctx.db.patch(tree._id, { ...next, peakGrowth, ...(passed !== 0 ? { rebuild: { ...tree.rebuild!, count: tree.rebuild!.count + passed } } : {}) });
  if (log) await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "growth", at, seeds: sap, ...log });
  const rose = await recordRise(ctx, workspace, tree.peakGrowth, peakGrowth, at, live);
  if (log || rose) await trimEvents(ctx, workspace._id);
}

/** The stages and rings a rise of the peak passed, as events (true if any); the stage reached live is posted. */
async function recordRise(ctx: MutationCtx, workspace: Doc<"workspaces">, from: number, to: number, at: number, live: boolean) {
  if (to <= from) return false;
  const before = TREE_STAGE_BY_ID[stageForGrowth(from)].index;
  const after = TREE_STAGE_BY_ID[stageForGrowth(to)].index;
  const rings = ringsForGrowth(to);
  const newRing = rings > ringsForGrowth(from);
  if (after === before && !newRing) return false;
  for (const stage of TREE_STAGES.slice(before + 1, after + 1)) {
    const id = await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "stage", at, stage: stage.id });
    if (live && stage.index === after) await announceStage(ctx, workspace, id);
  }
  if (newRing) await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind: "ring", at, rings });
  return true;
}

/** Posts a stage in the announcement channel (#97's), while the game is on; the demo and simulators have no Slack. */
async function announceStage(ctx: MutationCtx, workspace: Doc<"workspaces">, eventId: Id<"treeEvents">) {
  const channel = workspace.isDemo || !gameOn(workspace) ? undefined : workspace.announceChannel;
  if (!channel) return;
  await ctx.db.patch(eventId, { announcement: { status: "pending", channelId: channel.id } });
  await ctx.scheduler.runAfter(0, internal.slack.postTreeStage, { eventId });
}

async function trimEvents(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const newest = await ctx.db
    .query("treeEvents")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(TREE_EVENTS_KEPT + 20);
  for (const e of newest.slice(TREE_EVENTS_KEPT)) await ctx.db.delete(e._id);
}

/** Plants `seeds` (all of one workspace, unplanted) and grows the tree by them, with a growth event. */
async function plant(ctx: MutationCtx, workspace: Doc<"workspaces">, seeds: Doc<"seeds">[], by: "receiver" | "time", at: number) {
  if (seeds.length === 0) return;
  for (const s of seeds) await ctx.db.patch(s._id, { plantedAt: at, plantedBy: by });
  const oldest = [...seeds].sort((a, b) => a.sownAt - b.sownAt);
  const log = by === "receiver" ? { by, memberId: seeds[0].receiverId } : { by };
  await growTree(ctx, workspace, { sap: seeds.length, seeds: oldest, at, live: true, log });
}

/** The ritual at the tree: the viewer plants every seed they have (up to PLANT_BATCH at once). */
export const plantSeeds = mutation({
  args: {},
  returns: v.object({ planted: v.number(), left: v.number() }),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("The tree is part of the game: switch it on (or show it on your Me page) to plant seeds.");
    const seeds = await unplanted(ctx, member._id).take(PLANT_BATCH);
    await plant(ctx, workspace, seeds, "receiver", workspaceNow(workspace));
    return { planted: seeds.length, left: await seedsToPlant(ctx, member._id) };
  },
});

/** Plants, by time, the given seeds of each workspace that are due on its own clock. */
async function plantDue(ctx: MutationCtx, seeds: Doc<"seeds">[]) {
  const byWorkspace = new Map<Id<"workspaces">, Doc<"seeds">[]>();
  for (const s of seeds) byWorkspace.set(s.workspaceId, [...(byWorkspace.get(s.workspaceId) ?? []), s]);
  let planted = 0;
  for (const [workspaceId, group] of byWorkspace) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) continue;
    const now = workspaceNow(workspace);
    const due = group.filter((s) => s.sownAt <= now - AUTO_PLANT_MS);
    await plant(ctx, workspace, due, "time", now);
    planted += due.length;
  }
  return planted;
}

/**
 * The daily cron: seeds nobody planted in SEED_AUTO_PLANT_DAYS plant themselves, at most STEP_ROWS a
 * step, the next step right after while there are more. Simulators (clocks ahead) are planted as their clock moves.
 */
export const autoPlant = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_plantedAt_sownAt", (q) => q.eq("plantedAt", undefined).lte("sownAt", Date.now() - AUTO_PLANT_MS))
      .take(STEP_ROWS);
    const planted = await plantDue(ctx, seeds);
    if (seeds.length === STEP_ROWS && planted > 0) await ctx.scheduler.runAfter(0, internal.tree.autoPlant, {});
    return null;
  },
});

/** One workspace's due seeds, planted by time (a simulator's clock just moved). Returns how many. */
export async function autoPlantWorkspace(ctx: MutationCtx, workspace: Doc<"workspaces">): Promise<number> {
  const seeds = await ctx.db
    .query("seeds")
    .withIndex("by_workspace_plantedAt_sownAt", (q) =>
      q.eq("workspaceId", workspace._id).eq("plantedAt", undefined).lte("sownAt", workspaceNow(workspace) - AUTO_PLANT_MS),
    )
    .take(STEP_ROWS);
  return await plantDue(ctx, seeds);
}

// ── Backfill, rebuild, verify ──────────────────────────────────────────────

/**
 * Sows the seeds a workspace's history never sowed (kudos from before the tree, or the demo's seeded
 * year), each planted by time when it would have been (30 days on, or now), in steps of
 * BACKFILL_PAGE kudos rows, oldest first; the first one plants the tree. Never a DM or a post.
 * Idempotent: kudos rows with a seed are skipped. Writes the world seed when it's missing.
 */
export const backfillWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, cursor }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || superseded(workspace, resetAt)) return null;
    if (workspace.worldSeed === undefined) await ctx.db.patch(workspaceId, { worldSeed: worldSeedOf(workspace) });
    const now = workspaceNow(workspace);
    const page = await ctx.db
      .query("kudos")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: BACKFILL_PAGE, cursor: cursor ?? null });
    const sown: Doc<"seeds">[] = [];
    for (const row of page.page) {
      const seed = await ctx.db
        .query("seeds")
        .withIndex("by_kudos", (q) => q.eq("kudosId", row._id))
        .first();
      if (seed || seedsForLine({ qualifying: await qualifying(ctx, row) }) === 0) continue;
      const plantedAt = Math.min(row.at + AUTO_PLANT_MS, now);
      const id = await ctx.db.insert("seeds", { workspaceId, kudosId: row._id, giverId: row.giverId, receiverId: row.receiverId, sownAt: row.at, plantedAt, plantedBy: "time" });
      sown.push((await ctx.db.get(id))!);
    }
    // Rows come oldest first: the first seed is the tree's planter, and the page's stages date from its last planting.
    if (sown.length > 0) await growTree(ctx, workspace, { sap: sown.length, seeds: sown, at: Math.max(...sown.map((s) => s.plantedAt!)) });
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.tree.backfillWorkspace, { workspaceId, resetAt, cursor: page.continueCursor });
    return null;
  },
});

/** Backfills every workspace (the deploy step), but simulators (fresh, live from the start) and a demo mid-reset (its reset backfills). */
export const backfillAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const workspace of ctx.db.query("workspaces")) {
      if (workspace.simulator || workspace.resettingSince !== undefined) continue;
      await ctx.scheduler.runAfter(0, internal.tree.backfillWorkspace, { workspaceId: workspace._id });
    }
    return null;
  },
});

/**
 * Recounts a tree's sap from its planted seeds (the repair tool), in steps of REBUILD_PAGE seeds in
 * creation order, deleting seeds whose kudos is gone. Exact while members keep planting: `growTree`
 * adds a change to a seed the recount has passed to its count (`trees.rebuild`), and the recount reads
 * the rest as it finds them. The peak never goes down.
 */
export const rebuild = internalMutation({
  args: { workspaceId: v.id("workspaces"), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, cursor }) => {
    const workspace = await ctx.db.get(workspaceId);
    let tree = workspace && (await treeOf(ctx, workspaceId));
    if (!workspace || !tree) return null;
    if (cursor === undefined) {
      await ctx.db.patch(tree._id, { rebuild: { through: 0, count: 0 } });
      tree = (await ctx.db.get(tree._id))!;
    }
    const page = await ctx.db
      .query("seeds")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: REBUILD_PAGE, cursor: cursor ?? null });
    let counted = 0;
    let orphans = 0;
    for (const seed of page.page) {
      if (!(await ctx.db.get(seed.kudosId))) {
        await ctx.db.delete(seed._id);
        if (seed.plantedAt !== undefined) orphans++;
      } else if (seed.plantedAt !== undefined) counted++;
    }
    const through = page.page.at(-1)?._creationTime ?? tree.rebuild?.through ?? 0;
    const rebuilt = { through, count: (tree.rebuild?.count ?? 0) + counted };
    if (!page.isDone) {
      await ctx.db.patch(tree._id, { sap: tree.sap - orphans, rebuild: rebuilt });
      await ctx.scheduler.runAfter(0, internal.tree.rebuild, { workspaceId, cursor: page.continueCursor });
      return null;
    }
    await ctx.db.patch(tree._id, { rebuild: undefined, sap: rebuilt.count });
    const next = { ...tree, sap: rebuilt.count };
    const peakGrowth = Math.max(tree.peakGrowth, growthFor(next));
    await ctx.db.patch(tree._id, { peakGrowth });
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
      .paginate({ numItems: STEP_ROWS, cursor });
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

/** Compares a tree's stored sap with a recount of its planted seeds (read-only; `rebuild` repairs). */
export const verify = internalAction({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ stored: v.number(), planted: v.number(), unplanted: v.number(), peakGrowth: v.number(), ok: v.boolean() }),
  handler: async (ctx, { workspaceId }): Promise<{ stored: number; planted: number; unplanted: number; peakGrowth: number; ok: boolean }> => {
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

const tileValidator = v.object({ x: v.number(), y: v.number() });

const eventValidator = v.object({
  _id: v.id("treeEvents"),
  kind: v.union(v.literal("seed"), v.literal("growth"), v.literal("stage"), v.literal("ring")),
  at: v.number(),
  /** Who it names: the tree's planter, or who planted seeds; null for time, or someone who left. */
  who: v.union(v.null(), v.string()),
  /** growth: seeds planted; null where the viewer may not see received counts. */
  seeds: v.optional(v.union(v.null(), v.number())),
  by: v.optional(v.union(v.literal("receiver"), v.literal("time"))),
  stage: v.optional(treeStageValidator),
  rings: v.optional(v.number()),
});

async function eventView(ctx: QueryCtx, viewer: Viewer, e: Doc<"treeEvents">) {
  const member = e.memberId ? await ctx.db.get(e.memberId) : null;
  return {
    _id: e._id,
    kind: e.kind,
    at: e.at,
    who: member?.name ?? null,
    ...(e.kind === "growth" ? { seeds: e.by === "time" || canSeeReceived(viewer, e.memberId) ? (e.seeds ?? 0) : null, by: e.by } : {}),
    ...(e.stage ? { stage: e.stage } : {}),
    ...(e.rings !== undefined ? { rings: e.rings } : {}),
  };
}

/**
 * The tree as the world draws it (reactive): stage (from the peak), current growth and the way to the
 * next stage, sap and fuel, rings, who planted it, the viewer's seeds to plant, the layout of every
 * district, home plot and ruin (`lib/tree.ts layout`) and the latest events. A workspace that
 * hasn't planted yet is a desert: `planted` false, the seed stage. Null while the game isn't shown to the viewer.
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
      seedsToPlant: v.number(),
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
    const to = growthToNext(growth);
    const planter = tree?.plantedBy ? await ctx.db.get(tree.plantedBy) : null;
    const events = await ctx.db
      .query("treeEvents")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(STATE_EVENTS);
    const worldSeed = worldSeedOf(workspace);
    return {
      planted: tree !== null,
      stage: stageForGrowth(peakGrowth),
      growth,
      peakGrowth,
      sap: tree?.sap ?? 0,
      fuel: tree?.fuel ?? 0,
      rings: ringsForGrowth(peakGrowth),
      next: { stage: to.next, growth: to.growth },
      plantedBy: planter?.name ?? null,
      plantedAt: tree?.plantedAt ?? null,
      seedsToPlant: await seedsToPlant(ctx, member._id),
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
  const stage = stageForGrowth(tree?.peakGrowth ?? 0);
  return {
    planted: tree !== null,
    stage,
    growth,
    toNext: growthToNext(growth).growth,
    rings: ringsForGrowth(tree?.peakGrowth ?? 0),
    districtsOpen: districtsOpen(stage).length,
    seedsToPlant: await seedsToPlant(ctx, member._id),
  };
}

// ── The stage post ─────────────────────────────────────────────────────────

/** What to post for a stage event: the bot token, the channel and the text; null when there's no Slack to post to. */
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
    if (!event) return null; // trimmed or wiped meanwhile
    const channelId = event.announcement?.channelId;
    await ctx.db.patch(eventId, { announcement: { status: outcome, channelId, ...(outcome === "failed" ? { error: error ?? "unknown_error" } : {}) } });
    return null;
  },
});

