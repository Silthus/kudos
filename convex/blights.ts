import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { addXp, gameOn, gameShownTo, playerOf } from "./game";
import { sendGains } from "./gains";
import { startBonusDay } from "./boosts";
import { announceTreeEvent, treeOf, worldSeedOf } from "./tree";
import { requireAdmin, requireViewer } from "./lib/access";
import { BLIGHT, blightHp, nextBlightAt } from "./lib/blight";
import { addDays, DAY_MS, dayKeyFor, parseToday, startOfDayUtc, workspaceNow } from "./lib/time";
import { raidTier, stageForGrowth, stageIndex } from "./lib/tree";
import type { BlightLine } from "./lib/treeView";
import { blightStatusValidator } from "./schema";

/**
 * Blights (#164; design plan #152 S8, the rules are `lib/blight.ts`): a shared foe at the Ancient
 * Tree from its ancient stage. This module keeps the state; every number is the rules'.
 *
 * - **The schedule** runs on the workspace clock (`settleBlight`: hourly from the cron, at each
 *   planned arrival and end, and whenever a simulator's clock moves). The next blight after the last
 *   one ended (or after the tree became ancient) arrives `nextBlightAt(worldSeed, after, count)`, at the
 *   start of that workspace day; a planned day that went by unseen (the game off, a deploy) steps the
 *   seeded chain on from itself, never from now, so the plan can't drift away. It is announced
 *   `announceAheadDays` before, and never with less warning (a tree event, posted in the announcement
 *   channel). On arrival it takes its hit points from the members who gave or received a kudos in the
 *   `activeDays` before (`blightHp`, smaller after a defeat), and stays `windowDays` workspace days. An
 *   admin may send one for a day of their own (the gatehouse) or call off one that hasn't arrived.
 * - **Damage** is dealt in the transaction of its cause (`strikeBlight`): each qualifying kudos line
 *   of a give (the giver's), each room an expedition clears (once for the whole party, each member
 *   standing credited), ten a room in the **blight raid** (`rpg.startRaid`). A revoke never takes it
 *   back. Who dealt it is a `blightContributors` row per member (at most MAX_CONTRIBUTORS a blight:
 *   past that, damage still counts, but no more crests are won).
 * - **Victory** (damage reaches hp): a bonus day for the next free day (#97's `startBonusDay`), and to
 *   each contributor 20 Hog coins (a `blight` game event, 0 XP) and a crest for the gallery, told in
 *   one gain DM each: paid in steps after the winning blow (`payOut`), each exactly once.
 * - **Defeat** (`endsAt` passes): nothing owned is lost; the tree's lanterns burn low for a week
 *   (`trees.lanternsDimUntil`) and the next blight is smaller.
 *
 * While the game is off nothing is planned and nothing strikes. A blight the game was off for any part
 * of never counts as lost: it ends `called_off` (nobody could fight it), and the schedule goes on.
 */

/** Rows in a blight's ledger of who fought it: bounded so the payout, the crests and removal stay small. */
export const MAX_CONTRIBUTORS = 500;
/** Ended blights the history shows. */
const HISTORY = 12;
/** A lost blight's lanterns stay dim this long. */
const DIM_MS = 7 * DAY_MS;
/** Contributors one payout step pays (each a player patch, a game event and a DM). */
export const PAY_BATCH = 50;
/** Workspaces the cron reads a step. */
const WORKSPACES_PAGE = 100;
/** memberDays rows read to count the active company, newest first (30 days × 660 members). */
const ACTIVE_SCAN = 20_000;
/** Admins schedule at most this far ahead. */
const SCHEDULE_AHEAD_DAYS = 90;
/** A beaten blight's bonus day is the first free day in this many after the victory. */
const BONUS_DAY_SEARCH = 7;
/** Seeded plans a settle steps through to catch up (a year of blights or more). */
const CATCH_UP = 40;

type Blight = Doc<"blights">;
type Workspace = Doc<"workspaces">;

/** Over: fought to an end, or called off before (or while) nobody could fight it. */
const over = (b: Blight) => b.status === "won" || b.status === "lost" || b.status === "called_off";
/** Fought to an end: the history's blights. */
const fought = (b: Blight) => b.status === "won" || b.status === "lost";
const dayStart = (at: number, timezone: string) => startOfDayUtc(dayKeyFor(at, timezone), timezone);
/** A blight's end: the start of the workspace day `windowDays` after it arrived (a DST change never shifts it). */
const endOf = (arrivesAt: number, timezone: string) => startOfDayUtc(addDays(dayKeyFor(arrivesAt, timezone), BLIGHT.windowDays), timezone);

async function latestBlight(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("blights")
    .withIndex("by_workspace_number", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .first();
}

/** The blight at the tree now, if one has arrived and its days aren't over. */
export async function activeBlight(ctx: QueryCtx, workspace: Workspace, now: number) {
  const b = await latestBlight(ctx, workspace._id);
  return b && b.status === "active" && now >= b.arrivesAt && now < b.endsAt ? b : null;
}

/** A member's line in a blight's ledger, if they struck it. */
async function contributorOf(ctx: QueryCtx, blightId: Id<"blights">, memberId: Id<"members">) {
  return await ctx.db
    .query("blightContributors")
    .withIndex("by_blight_member", (q) => q.eq("blightId", blightId).eq("memberId", memberId))
    .unique();
}

/** Whether the tree is ancient or older: blights come from then on. */
async function ancientTree(ctx: QueryCtx, workspace: Workspace) {
  const tree = await treeOf(ctx, workspace._id);
  return tree && stageIndex(stageForGrowth(tree.peakGrowth)) >= stageIndex("ancient") ? tree : null;
}

/** When the tree became ancient (its stage event), for the first blight's schedule. */
async function ancientSince(ctx: QueryCtx, workspace: Workspace, tree: Doc<"trees">, now: number) {
  const stages = await ctx.db
    .query("treeEvents")
    .withIndex("by_workspace_kind_at", (q) => q.eq("workspaceId", workspace._id).eq("kind", "stage"))
    .order("desc")
    .take(20);
  return stages.find((e) => e.stage === "ancient")?.at ?? tree.plantedAt ?? now;
}

/** Whether the game was off (paused) at any time from `from` to `to`. */
function pausedBetween(workspace: Workspace, from: number, to: number) {
  return (workspace.gamePauses ?? []).some((p) => p.from < to && (p.until ?? Infinity) > from);
}

/** A tree event about a blight; announced, won and lost ones are posted in the announcement channel. */
async function logBlight(ctx: MutationCtx, workspace: Workspace, kind: Doc<"treeEvents">["kind"], blightId: Id<"blights">, at: number) {
  const id = await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind, at, blightId });
  if (kind === "blight_announced" || kind === "blight_won" || kind === "blight_lost") await announceTreeEvent(ctx, workspace, id);
}

/** Settles the workspace's blights again at `at` on its clock (a simulator's clock runs ahead of the wall's). */
async function settleAt(ctx: MutationCtx, workspace: Workspace, at: number) {
  await ctx.scheduler.runAt(Math.max(Date.now(), at - (workspace.clockOffsetMs ?? 0)), internal.blights.settleIn, { workspaceId: workspace._id });
}

/** A blight announced for `arrivesAt`: the tree's log says so, and it's settled again when it comes. */
async function announce(
  ctx: MutationCtx,
  workspace: Workspace,
  previous: Blight | null,
  arrivesAt: number,
  now: number,
  by?: Id<"members">,
): Promise<Blight> {
  const id = await ctx.db.insert("blights", {
    workspaceId: workspace._id,
    number: (previous?.number ?? 0) + 1,
    status: "announced",
    arrivesAt,
    endsAt: endOf(arrivesAt, workspace.timezone),
    announcedAt: now,
    hp: 0,
    damage: 0,
    contributors: 0,
    // A defeat shrinks the next blight; one called off in between passes the shrink on.
    defeatedBefore: previous?.status === "lost" || (previous?.status === "called_off" && previous.defeatedBefore),
    source: by ? "admin" : "schedule",
    ...(by ? { by } : {}),
  });
  await logBlight(ctx, workspace, "blight_announced", id, now);
  await settleAt(ctx, workspace, arrivesAt);
  return (await ctx.db.get(id))!;
}

/** Members who gave or received a kudos in the `activeDays` before `day` (the latest days first). */
export async function activeMembers(ctx: QueryCtx, workspaceId: Id<"workspaces">, day: string) {
  const rows = await ctx.db
    .query("memberDays")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId).gte("dayKey", addDays(day, -BLIGHT.activeDays)).lt("dayKey", day))
    .order("desc")
    .take(ACTIVE_SCAN);
  return new Set(rows.map((r) => r.memberId)).size;
}

/** The blight arrives: its hit points from the active company, its raid's tier from the tree's stage. */
async function arrive(ctx: MutationCtx, workspace: Workspace, b: Blight, tree: Doc<"trees">, now: number): Promise<Blight> {
  const active = await activeMembers(ctx, workspace._id, dayKeyFor(b.arrivesAt, workspace.timezone));
  await ctx.db.patch(b._id, { status: "active", hp: blightHp(active, b.defeatedBefore), tier: raidTier(stageForGrowth(tree.peakGrowth)) });
  await logBlight(ctx, workspace, "blight_arrived", b._id, Math.max(now, b.arrivesAt));
  await settleAt(ctx, workspace, b.endsAt);
  return (await ctx.db.get(b._id))!;
}

/** Its days ran out: lost. The lanterns dim for a week; the next one is smaller. */
async function lose(ctx: MutationCtx, workspace: Workspace, b: Blight, tree: Doc<"trees">) {
  await ctx.db.patch(b._id, { status: "lost", endedAt: b.endsAt });
  await ctx.db.patch(tree._id, { lanternsDimUntil: b.endsAt + DIM_MS });
  await logBlight(ctx, workspace, "blight_lost", b._id, b.endsAt);
}

/** Nobody could fight it (the game was off for some of its days): it ends without a result. */
async function lapse(ctx: MutationCtx, workspace: Workspace, b: Blight) {
  await ctx.db.patch(b._id, { status: "called_off", endedAt: b.endsAt });
  await logBlight(ctx, workspace, "blight_called_off", b._id, b.endsAt);
}

/**
 * When the next blight after `previous` arrives: the seeded chain from the last one's end (or the
 * ancient stage), stepped on from each missed plan's own end (never from now, so it can't drift), and
 * never announced with less than `announceAheadDays` warning.
 */
function nextArrival(workspace: Workspace, previous: Blight | null, since: number, now: number) {
  const seed = worldSeedOf(workspace);
  const count = previous?.number ?? 0;
  const ahead = BLIGHT.announceAheadDays * DAY_MS;
  let after = previous ? (previous.endedAt ?? previous.endsAt) : since;
  let arrivesAt = dayStart(nextBlightAt(seed, after, count), workspace.timezone);
  // A plan whose announcement is more than a day gone went by unseen: the chain steps on from it.
  for (let i = 0; i < CATCH_UP && now > arrivesAt - ahead + DAY_MS; i++) {
    after = endOf(arrivesAt, workspace.timezone);
    arrivesAt = dayStart(nextBlightAt(seed, after, count), workspace.timezone);
  }
  if (now < arrivesAt - ahead) return null; // not time to announce it yet
  return Math.max(arrivesAt, startOfDayUtc(addDays(dayKeyFor(now, workspace.timezone), BLIGHT.announceAheadDays), workspace.timezone));
}

/** What moving a workspace's blights along did, in order. */
export type BlightChange = "announced" | "arrived" | "lost";

/**
 * Moves a workspace's blights along its own clock: plans and announces the next one, lets an
 * announced one arrive, ends an active one whose days ran out. Idempotent: running it twice at the
 * same moment changes nothing the second time. Returns what it did.
 */
export async function settleBlight(ctx: MutationCtx, workspace: Workspace): Promise<BlightChange[]> {
  const changes: BlightChange[] = [];
  if (!gameOn(workspace)) return changes;
  const tree = await ancientTree(ctx, workspace);
  if (!tree) return changes;
  const now = workspaceNow(workspace);
  let b = await latestBlight(ctx, workspace._id);
  // One the game was off for: it never counts, and the schedule goes on after it.
  if (b && !over(b) && now >= b.endsAt && (b.status === "announced" || pausedBetween(workspace, b.arrivesAt, b.endsAt))) {
    await lapse(ctx, workspace, b);
    b = (await ctx.db.get(b._id))!;
  }
  if (!b || over(b)) {
    const arrivesAt = nextArrival(workspace, b, b ? 0 : await ancientSince(ctx, workspace, tree, now), now);
    if (arrivesAt === null) return changes;
    b = await announce(ctx, workspace, b, arrivesAt, now);
    changes.push("announced");
  }
  if (b.status === "announced" && now >= b.arrivesAt) {
    b = await arrive(ctx, workspace, b, tree, now);
    changes.push("arrived");
  }
  if (b.status === "active" && now >= b.endsAt) {
    await lose(ctx, workspace, b, tree);
    changes.push("lost");
  }
  return changes;
}

/** Workspaces a blight is never moved in: uninstalled, or a demo being reset or a simulator being wiped. */
const resting = (w: Workspace) => !gameOn(w) || w.status !== "active" || w.resettingSince !== undefined || w.wipingSince !== undefined;

/** The cron (hourly): settles each workspace whose game is on, in its own transaction. */
export const tick = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("workspaces").paginate({ numItems: WORKSPACES_PAGE, cursor: cursor ?? null });
    for (const workspace of page.page) {
      if (!resting(workspace) && (await ancientTree(ctx, workspace))) await ctx.scheduler.runAfter(0, internal.blights.settleIn, { workspaceId: workspace._id });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.blights.tick, { cursor: page.continueCursor });
    return null;
  },
});

export const settleIn = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (workspace && !resting(workspace)) await settleBlight(ctx, workspace);
    return null;
  },
});

// ── Damage ──────────────────────────────────────────────────────────────────

/**
 * Deals `damage` to the blight at the tree, in the caller's transaction (a give, a cleared room):
 * credited to each of `memberIds` (a room's whole party standing), counted once. The winning blow
 * wins it. Nothing while no blight is at the tree, or the game is off.
 */
export async function strikeBlight(ctx: MutationCtx, workspace: Workspace, memberIds: Id<"members">[], damage: number, now: number) {
  if (damage <= 0 || memberIds.length === 0 || !gameOn(workspace)) return;
  const b = await activeBlight(ctx, workspace, now);
  if (!b) return;
  let contributors = b.contributors;
  for (const memberId of new Set(memberIds)) {
    const row = await contributorOf(ctx, b._id, memberId);
    if (row) await ctx.db.patch(row._id, { damage: row.damage + damage });
    else if (contributors < MAX_CONTRIBUTORS) {
      await ctx.db.insert("blightContributors", { workspaceId: workspace._id, blightId: b._id, memberId, damage, at: now });
      contributors++;
    }
  }
  const total = b.damage + damage;
  await ctx.db.patch(b._id, { damage: total, contributors });
  if (total >= b.hp) await win(ctx, workspace, b, now);
}

/** Beaten: a bonus day on the next free day, and every contributor paid in steps after this blow. */
async function win(ctx: MutationCtx, workspace: Workspace, b: Blight, now: number) {
  const today = dayKeyFor(now, workspace.timezone);
  let bonusDay: string | undefined;
  for (let i = 1; i <= BONUS_DAY_SEARCH && !bonusDay; i++) {
    const day = addDays(today, i);
    if (await startBonusDay(ctx, workspace, day, "blight", { now })) bonusDay = day;
  }
  await ctx.db.patch(b._id, { status: "won", endedAt: now, ...(bonusDay ? { bonusDay } : {}) });
  await logBlight(ctx, workspace, "blight_won", b._id, now);
  await ctx.scheduler.runAfter(0, internal.blights.payOut, { blightId: b._id });
}

/** A beaten blight's 20 Hog coins to one who fought it, if they play: a `blight` event (0 XP) and their wallet. */
async function payContributor(ctx: MutationCtx, workspace: Workspace, blightId: Id<"blights">, memberId: Id<"members">, at: number) {
  const player = await playerOf(ctx, memberId);
  if (!player) return null;
  const coins = BLIGHT.rewardCoins;
  await ctx.db.insert("gameEvents", {
    workspaceId: workspace._id,
    memberId,
    kind: "blight",
    batchId: `blight:${blightId}`,
    dayKey: dayKeyFor(at, workspace.timezone),
    at,
    xp: 0,
    coins,
  });
  await addXp(ctx, player, 0, coins, undefined, "blightCoins");
  return coins;
}

/**
 * Pays a beaten blight's contributors, PAY_BATCH a step: to each player 20 Hog coins and one gain DM
 * with their damage and crest. Each row is paid once (`paidAt`), so a step run twice pays nobody twice.
 */
export const payOut = internalMutation({
  args: { blightId: v.id("blights") },
  returns: v.null(),
  handler: async (ctx, { blightId }) => {
    const b = await ctx.db.get(blightId);
    const workspace = b && (await ctx.db.get(b.workspaceId));
    if (!b || !workspace || b.status !== "won") return null;
    const now = workspaceNow(workspace);
    const due = await ctx.db
      .query("blightContributors")
      .withIndex("by_blight_paidAt", (q) => q.eq("blightId", blightId).eq("paidAt", undefined))
      .take(PAY_BATCH);
    for (const row of due) {
      await ctx.db.patch(row._id, { paidAt: now });
      const coins = await payContributor(ctx, workspace, blightId, row.memberId, now);
      if (coins !== null) await sendGains(ctx, workspace, row.memberId, [{ kind: "blight_won", damage: row.damage, coins }]);
    }
    if (due.length === PAY_BATCH) await ctx.scheduler.runAfter(0, internal.blights.payOut, { blightId });
    return null;
  },
});

/**
 * A blight the company beat in the past, as history (the demo's story, #164 S10): it arrived at
 * `arrivesAt` and was beaten at `wonAt`, worn down exactly by `fighters`' damage. Each fighter who
 * plays was paid as a victory pays, with no DM, no post and no bonus day.
 */
export async function seedPastVictory(ctx: MutationCtx, workspace: Workspace, story: { arrivesAt: number; wonAt: number; fighters: { memberId: Id<"members">; damage: number }[] }) {
  const fighters = story.fighters.slice(0, MAX_CONTRIBUTORS);
  const hp = fighters.reduce((s, f) => s + f.damage, 0);
  const announcedAt = story.arrivesAt - BLIGHT.announceAheadDays * DAY_MS;
  const blightId = await ctx.db.insert("blights", {
    workspaceId: workspace._id,
    number: ((await latestBlight(ctx, workspace._id))?.number ?? 0) + 1,
    status: "won",
    arrivesAt: story.arrivesAt,
    endsAt: endOf(story.arrivesAt, workspace.timezone),
    announcedAt,
    hp,
    damage: hp,
    contributors: fighters.length,
    defeatedBefore: false,
    tier: 1,
    source: "schedule",
    endedAt: story.wonAt,
  });
  for (const [kind, at] of [["blight_announced", announcedAt], ["blight_arrived", story.arrivesAt], ["blight_won", story.wonAt]] as const) {
    await ctx.db.insert("treeEvents", { workspaceId: workspace._id, kind, at, blightId });
  }
  for (const f of fighters) {
    await ctx.db.insert("blightContributors", { workspaceId: workspace._id, blightId, memberId: f.memberId, damage: f.damage, at: story.arrivesAt, paidAt: story.wonAt });
    await payContributor(ctx, workspace, blightId, f.memberId, story.wonAt);
  }
  return blightId;
}

// ── Reading it ──────────────────────────────────────────────────────────────

/** The blight at the tree for App Home and `/kudos tree` (lib/treeView.ts), by its stored status. */
export async function blightLine(ctx: QueryCtx, workspace: Workspace, memberId: Id<"members">): Promise<BlightLine | null> {
  const b = await latestBlight(ctx, workspace._id);
  if (!b || b.status !== "active") return null;
  const row = await contributorOf(ctx, b._id, memberId);
  return { hp: b.hp, damage: b.damage, lastDay: dayKeyFor(b.endsAt - 1, workspace.timezone), mine: row?.damage ?? 0 };
}

const blightView = v.object({
  _id: v.id("blights"),
  number: v.number(),
  status: blightStatusValidator,
  arrivesAt: v.number(),
  endsAt: v.number(),
  endedAt: v.union(v.number(), v.null()),
  hp: v.number(),
  damage: v.number(),
  contributors: v.number(),
  tier: v.union(v.number(), v.null()),
  bonusDay: v.union(v.string(), v.null()),
  /** The damage the viewer dealt it. */
  mine: v.number(),
});

async function viewOf(ctx: QueryCtx, b: Blight, memberId: Id<"members">) {
  const row = await contributorOf(ctx, b._id, memberId);
  return {
    _id: b._id,
    number: b.number,
    status: b.status,
    arrivesAt: b.arrivesAt,
    endsAt: b.endsAt,
    endedAt: b.endedAt ?? null,
    hp: b.hp,
    damage: Math.min(b.damage, b.hp || b.damage),
    contributors: b.contributors,
    tier: b.tier ?? null,
    bonusDay: b.bonusDay ?? null,
    mine: row?.damage ?? 0,
  };
}

/**
 * The latest blight (announced, at the tree, or how the last one ended) with the viewer's damage,
 * and until when the lanterns burn low after a defeat. Null while the game isn't shown to the viewer.
 */
export const current = query({
  args: {},
  returns: v.union(v.null(), v.object({ blight: v.union(v.null(), blightView), lanternsDimUntil: v.union(v.number(), v.null()) })),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const b = await latestBlight(ctx, workspace._id);
    const tree = await treeOf(ctx, workspace._id);
    return { blight: b && (await viewOf(ctx, b, member._id)), lanternsDimUntil: tree?.lanternsDimUntil ?? null };
  },
});

/** The blights that came and went, newest first (the last HISTORY), each with the viewer's damage. */
export const history = query({
  args: {},
  returns: v.array(blightView),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const rows = await ctx.db
      .query("blights")
      .withIndex("by_workspace_number", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(HISTORY * 2);
    return await Promise.all(rows.filter(fought).slice(0, HISTORY).map((b) => viewOf(ctx, b, member._id)));
  },
});

// ── The gatehouse ───────────────────────────────────────────────────────────

/**
 * An admin sends a blight for a day of their choosing (tomorrow at the earliest, so it's announced
 * before it comes; within 90 days): only while the game is on, from the ancient stage, and with no
 * blight announced or at the tree already.
 */
export const schedule = mutation({
  args: { dayKey: v.string() },
  returns: v.id("blights"),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireAdmin(ctx);
    if (!gameOn(workspace)) throw new ConvexError("Blights are part of the game: switch it on first (Settings).");
    if (!(await ancientTree(ctx, workspace))) throw new ConvexError("Blights come once the tree is an ancient tree.");
    const day = parseToday(args.dayKey);
    const now = workspaceNow(workspace);
    const today = dayKeyFor(now, workspace.timezone);
    if (day <= today) throw new ConvexError("A blight is announced before it comes: pick tomorrow or a later day.");
    if (day > addDays(today, SCHEDULE_AHEAD_DAYS)) throw new ConvexError(`Pick a day within the next ${SCHEDULE_AHEAD_DAYS} days.`);
    const latest = await latestBlight(ctx, workspace._id);
    if (latest && !over(latest)) throw new ConvexError(latest.status === "active" ? "A blight is at the tree now." : "A blight is on its way already. Call it off first to pick another day.");
    return (await announce(ctx, workspace, latest, startOfDayUtc(day, workspace.timezone), now, member._id))._id;
  },
});

/**
 * An admin calls off a blight that hasn't arrived (one at the tree is the company's to fight). It stays
 * on record as called off, so the schedule plans the next one from now rather than sending it again.
 */
export const cancel = mutation({
  args: { blightId: v.id("blights") },
  returns: v.null(),
  handler: async (ctx, { blightId }) => {
    const { workspace } = await requireAdmin(ctx);
    const b = await ctx.db.get(blightId);
    if (!b || b.workspaceId !== workspace._id) throw new ConvexError("That blight doesn't exist.");
    if (b.status !== "announced") throw new ConvexError("That blight has arrived: the company is fighting it now.");
    const now = workspaceNow(workspace);
    await ctx.db.patch(blightId, { status: "called_off", endedAt: now });
    await logBlight(ctx, workspace, "blight_called_off", blightId, now);
    return null;
  },
});
