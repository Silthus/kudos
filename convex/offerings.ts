import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { gameShownTo, playerOf } from "./game";
import { Gains } from "./gains";
import { requireViewer } from "./lib/access";
import { WALLET_LEVEL } from "./lib/coins";
import { FRUITS, fruitEffect, fruitsBetween, rollFruits, type FruitId } from "./lib/fruits";
import { STAMINA, staminaAfterMoonFruit } from "./lib/rpg";
import { fnv1a, mulberry32 } from "./lib/random";
import { dayKeyFor, DAY_MS, workspaceNow } from "./lib/time";
import { fuelForLine, OFFERING_AUTO_CLAIM_DAYS } from "./lib/tree";
import { fruitIdValidator } from "./schema";
import { addFuel } from "./tree";

/**
 * Offerings at the Ancient Tree (#157; design plan #152 S3): the giver's side of the stone's two
 * rituals (the receiver's is planting seeds, tree.ts).
 *
 * - **An offering** is what one kudos batch earned its giver: the Hog coins of its qualifying lines
 *   (`lineCoins`) and one fuel each (`fuelForLine`). The give transaction writes it (`makeOffering`)
 *   instead of crediting the wallet; the coins wait at the tree.
 * - **Claiming** (`claim`) takes every offering waiting at once, in one transaction: the coins go into
 *   `players.coins` (and `claimedCoins`, their share), the tree takes the fuel (`addFuel`), a fruit
 *   drops for every five coins past the most ever claimed (`claimedPeak`, lib/fruits.ts), into the
 *   member's `inventory`, and a `claim` game event records it. Nothing waiting: nothing written.
 * - **Time** claims what nobody claimed in OFFERING_AUTO_CLAIM_DAYS (`autoClaim`, hourly; a simulator's
 *   whenever its clock moves), with a gain DM.
 * - **A revoke** takes its line out of the offering; once claimed, the coins and fuel go back too.
 *   Batches from before offerings (their coins were credited straight away) are taken back as before.
 * - **The rebuild** (game.ts `rebuildPlayer`) replays offerings from the surviving kudos
 *   (`replayOfferings`) and keeps which batches were claimed; claims, fruit and the inventory are state.
 */

/** Offerings one claim takes (a press claims up to this many; `more` says there are others). */
export const CLAIM_BATCH = 500;
/** Offerings read to sum what is waiting. */
const WAITING_READ = 1000;
const DUE_SCAN = 1500;
const AUTO_CLAIM_MS = OFFERING_AUTO_CLAIM_DAYS * DAY_MS;

type OfferedLine = { qualifying: boolean; coins?: number };
type Offered = { coins: number; fuel: number };

/** What a batch's lines offer: their coins and one fuel per qualifying line. */
export function offeringOf(lines: OfferedLine[]): Offered {
  return {
    coins: lines.reduce((s, l) => s + (l.coins ?? 0), 0),
    fuel: lines.reduce((s, l) => s + fuelForLine(l), 0),
  };
}

const sum = (rows: Offered[]): Offered => rows.reduce((s, o) => ({ coins: s.coins + o.coins, fuel: s.fuel + o.fuel }), { coins: 0, fuel: 0 });

/** Called from `onGameGiven` with a batch's ledger lines: its offering, if it offers anything. */
export async function makeOffering(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  batch: { batchId: string; at: number; lines: OfferedLine[] },
) {
  const { coins, fuel } = offeringOf(batch.lines);
  if (coins === 0 && fuel === 0) return;
  await ctx.db.insert("offerings", { workspaceId: workspace._id, memberId, batchId: batch.batchId, coins, fuel, createdAt: batch.at });
}

/** A batch's offering to its giver (a batch has one giver; a few rows at most share its id). */
async function offeringOfBatch(ctx: QueryCtx, memberId: Id<"members">, batchId: string) {
  const rows = await ctx.db
    .query("offerings")
    .withIndex("by_batch", (q) => q.eq("batchId", batchId))
    .take(10);
  return rows.find((o) => o.memberId === memberId) ?? null;
}

/**
 * Called from `onGameRevoked` for the revoked row's line: takes it out of its batch's offering, and
 * once claimed takes its coins and fuel back. Returns false for a batch from before offerings, whose
 * coins went straight into the wallet (the caller takes those back itself).
 */
export async function onOfferingRevoked(ctx: MutationCtx, memberId: Id<"members">, batchId: string, line: OfferedLine) {
  const offering = await offeringOfBatch(ctx, memberId, batchId);
  if (!offering) return false;
  const { coins, fuel } = offeringOf([line]);
  if (coins === 0 && fuel === 0) return true;
  const left = { coins: offering.coins - coins, fuel: offering.fuel - fuel };
  if (left.coins <= 0 && left.fuel <= 0) await ctx.db.delete(offering._id);
  else await ctx.db.patch(offering._id, left);
  if (offering.claimedAt === undefined) return true;
  const player = await playerOf(ctx, memberId);
  if (player) await ctx.db.patch(player._id, { coins: (player.coins ?? 0) - coins, claimedCoins: (player.claimedCoins ?? 0) - coins });
  const workspace = await ctx.db.get(offering.workspaceId);
  if (workspace) await addFuel(ctx, workspace, -fuel, workspaceNow(workspace));
  return true;
}

/** A member's offerings still waiting, oldest first. */
function waitingOfferings(ctx: QueryCtx, memberId: Id<"members">) {
  return ctx.db.query("offerings").withIndex("by_member_claimedAt_createdAt", (q) => q.eq("memberId", memberId).eq("claimedAt", undefined));
}

/** What waits at the tree for a member: coins, fuel and how many offerings. */
export async function waiting(ctx: QueryCtx, memberId: Id<"members">) {
  const rows = await waitingOfferings(ctx, memberId).take(WAITING_READ);
  return { ...sum(rows), offerings: rows.length };
}

// ── The inventory ───────────────────────────────────────────────────────────

async function heldRow(ctx: QueryCtx, memberId: Id<"members">, fruit: FruitId) {
  return await ctx.db
    .query("inventory")
    .withIndex("by_member_fruit", (q) => q.eq("memberId", memberId).eq("fruit", fruit))
    .unique();
}

/** Adds (or, negative, takes) fruit of one kind; a kind held at zero has no row. */
export async function addFruit(ctx: MutationCtx, workspaceId: Id<"workspaces">, memberId: Id<"members">, fruit: FruitId, delta: number) {
  const row = await heldRow(ctx, memberId, fruit);
  const count = (row?.count ?? 0) + delta;
  if (count < 0) throw new ConvexError(`You have no ${FRUITS.find((f) => f.id === fruit)!.name.toLowerCase()} left.`);
  if (row && count === 0) await ctx.db.delete(row._id);
  else if (row) await ctx.db.patch(row._id, { count });
  else if (count > 0) await ctx.db.insert("inventory", { workspaceId, memberId, fruit, count });
}

// ── Claiming ────────────────────────────────────────────────────────────────

export type Claimed = { coins: number; fuel: number; offerings: number; fruit: FruitId[] };

/**
 * Claims `rows` (a member's waiting offerings) for `player`, in this transaction: the coins into the
 * wallet, the fuel into the tree, the fruit into the inventory and a `claim` event. The fruit is
 * rolled from a seed of the member and their peak, so the same claim always drops the same fruit.
 */
export async function claimOfferings(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  player: Doc<"players">,
  rows: Doc<"offerings">[],
  by: "player" | "time",
  now: number,
): Promise<Claimed> {
  if (rows.length === 0) return { coins: 0, fuel: 0, offerings: 0, fruit: [] };
  for (const o of rows) await ctx.db.patch(o._id, { claimedAt: now });
  const { coins, fuel } = sum(rows);
  const claimedCoins = (player.claimedCoins ?? 0) + coins;
  const peak = player.claimedPeak ?? 0;
  const fruit = rollFruits(fruitsBetween(peak, Math.max(peak, claimedCoins)), mulberry32(fnv1a(`${player.memberId}:${peak}`)));
  await ctx.db.patch(player._id, { coins: (player.coins ?? 0) + coins, claimedCoins, claimedPeak: Math.max(peak, claimedCoins) });
  for (const f of new Set(fruit)) await addFruit(ctx, workspace._id, player.memberId, f, fruit.filter((x) => x === f).length);
  await addFuel(ctx, workspace, fuel, now);
  await ctx.db.insert("gameEvents", {
    workspaceId: workspace._id,
    memberId: player.memberId,
    kind: "claim",
    batchId: `claim:${player.memberId}:${now}`,
    dayKey: dayKeyFor(now, workspace.timezone),
    at: now,
    xp: 0,
    claimed: coins,
    fuel,
    by,
    fruits: fruit,
  });
  return { coins, fuel, offerings: rows.length, fruit };
}

const claimedValidator = v.object({
  coins: v.union(v.number(), v.null()), // null below level 3: coins collect silently until the wallet opens
  fuel: v.number(),
  offerings: v.number(),
  fruit: v.array(fruitIdValidator),
  more: v.boolean(),
});

/** The ritual at the stone: the viewer offers their appreciation, every offering waiting at once. */
export const claim = mutation({
  args: {},
  returns: claimedValidator,
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("The tree is part of the game: switch it on (or show it on your Me page) to offer your appreciation.");
    const player = await playerOf(ctx, member._id);
    if (!player) return { coins: 0, fuel: 0, offerings: 0, fruit: [], more: false };
    const rows = await waitingOfferings(ctx, member._id).take(CLAIM_BATCH);
    const claimed = await claimOfferings(ctx, workspace, player, rows, "player", workspaceNow(workspace));
    const more = (await waitingOfferings(ctx, member._id).first()) !== null;
    return { ...claimed, coins: player.level >= WALLET_LEVEL ? claimed.coins : null, more };
  },
});

/** What waits for the viewer at the stone; null while the game isn't shown to them. */
export const pending = query({
  args: {},
  returns: v.union(v.null(), v.object({ coins: v.union(v.number(), v.null()), fuel: v.number(), offerings: v.number() })),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const player = await playerOf(ctx, member._id);
    const w = await waiting(ctx, member._id);
    return { ...w, coins: (player?.level ?? 1) >= WALLET_LEVEL ? w.coins : null };
  },
});

/** The viewer's fruit, in the catalogue's order; empty while the game isn't shown to them. */
export const inventory = query({
  args: {},
  returns: v.array(v.object({ fruit: fruitIdValidator, name: v.string(), about: v.string(), count: v.number() })),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const rows = await ctx.db
      .query("inventory")
      .withIndex("by_member_fruit", (q) => q.eq("memberId", member._id))
      .take(FRUITS.length);
    return FRUITS.flatMap((f) => {
      const row = rows.find((r) => r.fruit === f.id);
      return row ? [{ fruit: f.id, name: f.name, about: f.about, count: row.count }] : [];
    });
  },
});

// ── Claimed by time ─────────────────────────────────────────────────────────

/**
 * Hourly: the workspaces with offerings nobody claimed in OFFERING_AUTO_CLAIM_DAYS, each claimed in
 * its own steps (`autoClaimIn`). Due by the wall clock, which every workspace's clock is at or ahead
 * of (tree.ts `autoPlant` reads seeds the same way); simulators are claimed as their clock moves.
 */
export const autoClaim = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("offerings")
      .withIndex("by_claimedAt_createdAt", (q) => q.eq("claimedAt", undefined).lte("createdAt", Date.now() - AUTO_CLAIM_MS))
      .take(DUE_SCAN);
    for (const workspaceId of new Set(due.map((o) => o.workspaceId))) {
      await ctx.scheduler.runAfter(0, internal.offerings.autoClaimIn, { workspaceId });
    }
    return null;
  },
});

/** One workspace's due offerings, CLAIM_BATCH a step until none is left. */
export const autoClaimIn = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (workspace && (await autoClaimWorkspace(ctx, workspace)) === CLAIM_BATCH) {
      await ctx.scheduler.runAfter(0, internal.offerings.autoClaimIn, { workspaceId });
    }
    return null;
  },
});

/**
 * Claims, by time, up to CLAIM_BATCH of a workspace's offerings due on its own clock, member by
 * member, each told in a gain DM with what it dropped. Returns how many offerings it claimed.
 */
export async function autoClaimWorkspace(ctx: MutationCtx, workspace: Doc<"workspaces">): Promise<number> {
  const now = workspaceNow(workspace);
  const due = await ctx.db
    .query("offerings")
    .withIndex("by_workspace_claimedAt_createdAt", (q) => q.eq("workspaceId", workspace._id).eq("claimedAt", undefined).lte("createdAt", now - AUTO_CLAIM_MS))
    .take(CLAIM_BATCH);
  if (due.length === 0) return 0;
  const gains = new Gains(ctx, workspace, now);
  for (const memberId of new Set(due.map((o) => o.memberId))) {
    const rows = due.filter((o) => o.memberId === memberId);
    const player = await playerOf(ctx, memberId);
    if (!player) {
      // No player to credit (never happens for a live offering): settle them without a wallet.
      for (const o of rows) await ctx.db.patch(o._id, { claimedAt: now });
      continue;
    }
    const claimed = await claimOfferings(ctx, workspace, player, rows, "time", now);
    gains.add(memberId, {
      kind: "offering_claimed",
      since: Math.min(...rows.map((o) => o.createdAt)),
      ...(player.level >= WALLET_LEVEL ? { coins: claimed.coins } : {}),
      fruits: claimed.fruit,
    });
  }
  const dms = await gains.flush();
  if (dms.length > 0 && !workspace.isDemo) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids: dms });
  return due.length;
}

// ── The rebuild ─────────────────────────────────────────────────────────────

/** Offerings a rebuild reads per member. */
const MAX_REPLAYED_OFFERINGS = 8000;

/**
 * The rebuild's offerings for one member (game.ts `rebuildPlayer`): one per replayed batch that
 * offers something, keeping which were claimed; a batch the member's history no longer has loses its
 * offering. Offerings older than OFFERING_AUTO_CLAIM_DAYS that were never claimed count as claimed by
 * time, silently (a rebuild never DMs) and without fruit (the caller raises the peak past them). The
 * tree takes the change in claimed fuel. Returns the coins claimed, for the wallet.
 */
export async function replayOfferings(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  batches: { batchId: string; at: number; lines: OfferedLine[] }[],
) {
  const now = workspaceNow(workspace);
  const existing = await ctx.db
    .query("offerings")
    .withIndex("by_member_claimedAt_createdAt", (q) => q.eq("memberId", memberId))
    .take(MAX_REPLAYED_OFFERINGS);
  if (existing.length === MAX_REPLAYED_OFFERINGS) console.warn(`game rebuild: member ${memberId} has more than ${MAX_REPLAYED_OFFERINGS} offerings; later ones were left as they are.`);
  const byBatch = new Map(existing.map((o) => [o.batchId, o]));
  const fuelBefore = existing.reduce((s, o) => s + (o.claimedAt !== undefined ? o.fuel : 0), 0);
  let coins = 0;
  let fuel = 0;
  const kept = new Set<Id<"offerings">>();
  for (const batch of batches) {
    const offered = offeringOf(batch.lines);
    if (offered.coins === 0 && offered.fuel === 0) continue;
    const old = byBatch.get(batch.batchId);
    const claimedAt = old?.claimedAt ?? (batch.at <= now - AUTO_CLAIM_MS ? now : undefined);
    if (old) {
      kept.add(old._id);
      if (old.coins !== offered.coins || old.fuel !== offered.fuel || old.claimedAt !== claimedAt) await ctx.db.patch(old._id, { ...offered, claimedAt });
    } else {
      await ctx.db.insert("offerings", { workspaceId: workspace._id, memberId, batchId: batch.batchId, ...offered, createdAt: batch.at, claimedAt });
    }
    if (claimedAt !== undefined) {
      coins += offered.coins;
      fuel += offered.fuel;
    }
  }
  for (const o of existing) if (!kept.has(o._id)) await ctx.db.delete(o._id);
  if (fuel !== fuelBefore) await addFuel(ctx, workspace, fuel - fuelBefore, now, { live: false });
  return coins;
}

// ── Fruit at the stall ──────────────────────────────────────────────────────

/**
 * The stall (#157): a fruit is sold or used, one at a time, each by its one effect (lib/fruits.ts
 * `fruitEffect`): sun fruit sells for its coins (a `sale` event; `players.fruitCoins`), moon fruit
 * restores stamina (`players.stamina`, lib/rpg.ts; C3 spends it), amber fruit is a Lucky charm charge
 * (#97's `players.luckyCharms`), star fruit keeps a discount for a home's next build stage
 * (`players.homeDiscount`; C1 takes it) and heart fruit a Super seed to plant on the terrace
 * (`players.superSeeds`; gardens.ts plants it as a Sapling). A use that would waste the fruit (full
 * stamina, a discount already waiting) is refused and keeps it.
 */
export const applyFruit = mutation({
  args: { fruit: fruitIdValidator },
  returns: v.object({ said: v.string(), coins: v.optional(v.number()) }),
  handler: async (ctx, { fruit }) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("Tree fruit is part of the game: switch it on (or show it on your Me page) to use it.");
    const player = await playerOf(ctx, member._id);
    if (!player) throw new ConvexError("You have no tree fruit yet. Offer your appreciation at the stone to earn some.");
    await addFruit(ctx, workspace._id, member._id, fruit, -1);
    const effect = fruitEffect(fruit);
    const now = workspaceNow(workspace);
    switch (effect.kind) {
      case "sell":
        await ctx.db.patch(player._id, { coins: (player.coins ?? 0) + effect.coins, fruitCoins: (player.fruitCoins ?? 0) + effect.coins });
        await ctx.db.insert("gameEvents", {
          workspaceId: workspace._id,
          memberId: member._id,
          kind: "sale",
          batchId: `sale:${member._id}:${now}`,
          dayKey: dayKeyFor(now, workspace.timezone),
          at: now,
          xp: 0,
          coins: effect.coins,
          fruits: [fruit],
        });
        return { said: `Sold for ${effect.coins} Hog coins.`, coins: effect.coins };
      case "stamina": {
        const stamina = player.stamina ?? 0;
        const after = staminaAfterMoonFruit(stamina);
        if (after === stamina) throw new ConvexError("Your stamina is full already. Keep the moon fruit for after an expedition.");
        await ctx.db.patch(player._id, { stamina: after });
        return { said: `Stamina ${after} of ${STAMINA.max}.` };
      }
      case "luckyCharm":
        await ctx.db.patch(player._id, { luckyCharms: (player.luckyCharms ?? 0) + effect.charges });
        return { said: "A Lucky charm charge: your next thoughtful kudos rolls its message Uncommon or better." };
      case "homeDiscount":
        if (player.homeDiscount !== undefined) throw new ConvexError("A star fruit's discount is already waiting for your home's next stage.");
        await ctx.db.patch(player._id, { homeDiscount: effect.percent });
        return { said: `${effect.percent}% off your home's next build stage.` };
      case "superSeed":
        await ctx.db.patch(player._id, { superSeeds: (player.superSeeds ?? 0) + 1 });
        return { said: "A Super seed: plant it on your terrace and it starts as a Sapling." };
    }
  },
});
