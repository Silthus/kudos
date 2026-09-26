import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { gameShownTo, playerOf } from "./game";
import { requireViewer, type Viewer } from "./lib/access";
import {
  chunkKey,
  DEFAULT_LOOK,
  facingValidator,
  hogAnimationValidator,
  isChunkKey,
  isTile,
  lookValidator,
  MAX_CHUNKS,
  MAX_SESSIONS,
  MAX_SKEW_MS,
  MIN_BEAT_MS,
  ONLINE_LIMIT,
  ONLINE_MS,
  PER_CHUNK,
  shouldSave,
  SWEEP_AFTER_MS,
  SWEEP_BATCH,
  tileValidator,
} from "./lib/presence";
import { workspaceNow } from "./lib/time";
import { titleForLevel } from "./lib/xp";

/**
 * Presence in the shared world (#155, design plan #152 S2). The client sends a heartbeat while its
 * hog is in the world (at most 4 a second while walking, every 20 s standing still); each one
 * upserts the viewer's `worldPresence` row for their sign-in session, and now and then saves where
 * they stand to `players.at` so they reappear there. Other clients read the rows of the chunks
 * around them (`nearby`) and who is online (`online`). Only within the workspace, and only while
 * the game is shown to both: a member who hides the game, or a workspace with the game off, is
 * never in the world and sees nobody in it. Rows older than a minute are offline and never shown;
 * `sweep` deletes them after ten.
 */

/** The viewer's sign-in session: every visitor to the shared demo is the same member, each their own hog. */
async function sessionOf(ctx: QueryCtx): Promise<string> {
  return (await getAuthSessionId(ctx)) ?? "";
}

function ownRow(ctx: QueryCtx, { workspace, member }: Viewer, sessionId: string) {
  return ctx.db
    .query("worldPresence")
    .withIndex("by_workspace_member_session", (q) => q.eq("workspaceId", workspace._id).eq("memberId", member._id).eq("sessionId", sessionId))
    .unique();
}

/** Whether the viewer is in the world: the game shown to them, and the shared demo not mid-reset. */
function inWorld({ workspace, member }: Viewer): boolean {
  return gameShownTo(workspace, member) && workspace.resettingSince === undefined;
}

/**
 * The client's "now" on the workspace clock, pulled to within MAX_SKEW_MS of the server's: queries
 * take the time as an argument (they aren't re-run as time passes), but never to look further back.
 */
function clampNow(workspace: Doc<"workspaces">, now: number): number {
  const server = workspaceNow(workspace);
  if (!Number.isFinite(now)) return server;
  return Math.min(Math.max(now, server - MAX_SKEW_MS), server + MAX_SKEW_MS);
}

/** A member leaves the world at once, every session of theirs (hiding the game: game.ts `setHidden`). */
export async function leaveWorld(ctx: MutationCtx, member: Doc<"members">) {
  const rows = await ctx.db
    .query("worldPresence")
    .withIndex("by_workspace_member_session", (q) => q.eq("workspaceId", member.workspaceId).eq("memberId", member._id))
    .take(MAX_SESSIONS);
  for (const row of rows) await ctx.db.delete(row._id);
}

/** How a presence row is shown to others. */
const hogValidator = v.object({
  id: v.id("worldPresence"),
  memberId: v.id("members"),
  name: v.string(),
  title: v.string(),
  x: v.number(),
  y: v.number(),
  facing: facingValidator,
  animation: hogAnimationValidator,
  look: lookValidator,
  hasHome: v.boolean(),
  updatedAt: v.number(),
});

function hogOf(row: Doc<"worldPresence">) {
  return {
    id: row._id,
    memberId: row.memberId,
    name: row.name,
    title: row.title,
    x: row.x,
    y: row.y,
    facing: row.facing,
    animation: row.animation,
    look: row.look,
    hasHome: false, // homes arrive with #160
    updatedAt: row.updatedAt,
  };
}

/**
 * The viewer's hog is at (x, y), facing and doing this. True when recorded; false (and their hog
 * leaves the world) when the game is off or hidden for them. One presence write per call; where they
 * stand is also saved to `players.at` when `shouldSave` says so.
 */
export const heartbeat = mutation({
  args: { x: v.number(), y: v.number(), facing: facingValidator, animation: hogAnimationValidator },
  returns: v.boolean(),
  handler: async (ctx, { x, y, facing, animation }) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    const sessionId = await sessionOf(ctx);
    const row = await ownRow(ctx, viewer, sessionId);
    if (!inWorld(viewer)) {
      if (row) await ctx.db.delete(row._id);
      return false;
    }
    if (!isTile(x, y)) throw new ConvexError("That tile is outside the world.");
    const now = workspaceNow(workspace);
    if (row && now - row.updatedAt < MIN_BEAT_MS && row.x === x && row.y === y && row.facing === facing && row.animation === animation) return true;
    const player = await playerOf(ctx, member._id);
    const save = player !== null && shouldSave({ at: player.at, x, y, walking: animation === "walk", savedAt: row?.savedAt, now });
    if (save) await ctx.db.patch(player._id, { at: { x, y } });
    const fields = {
      x,
      y,
      chunk: chunkKey(x, y),
      facing,
      animation,
      name: member.name,
      title: titleForLevel(player?.level ?? 1),
      look: player?.look ?? DEFAULT_LOOK,
      updatedAt: now,
      ...(save ? { savedAt: now } : {}),
    };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("worldPresence", { workspaceId: workspace._id, memberId: member._id, sessionId, ...fields });
    return true;
  },
});

/**
 * Where the viewer's hog appears and how it looks: `at` is this session's hog if it is still in the
 * world (a reload), else where they were last saved (`players.at`, shared by their devices); null for
 * someone who never walked: they appear at the base camp. Null while the game isn't shown to them.
 * Read it once when the world opens: it changes with every heartbeat of this session.
 */
export const mine = query({
  args: {},
  returns: v.union(v.null(), v.object({ at: v.union(v.null(), tileValidator), look: lookValidator })),
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    if (!inWorld(viewer)) return null;
    const player = await playerOf(ctx, viewer.member._id);
    const row = await ownRow(ctx, viewer, await sessionOf(ctx));
    // This session's hog (kept up to ten minutes after it stopped beating) is where a reload left it,
    // even mid-walk, before `players.at` caught up.
    const at = row ? { x: row.x, y: row.y } : (player?.at ?? null);
    return { at, look: player?.look ?? DEFAULT_LOOK };
  },
});

/** Your hog's look (the cabin): a Hedgehog Mode colour filter and accessory, or none. Worn at once. */
export const setLook = mutation({
  args: lookValidator.fields,
  returns: v.null(),
  handler: async (ctx, look) => {
    const viewer = await requireViewer(ctx);
    if (!gameShownTo(viewer.workspace, viewer.member)) throw new ConvexError("Your look is part of the game, which is off or hidden for you.");
    const player = await playerOf(ctx, viewer.member._id);
    if (!player) throw new ConvexError("Your hog's look opens with your first kudos.");
    await ctx.db.patch(player._id, { look });
    const rows = await ctx.db
      .query("worldPresence")
      .withIndex("by_workspace_member_session", (q) => q.eq("workspaceId", viewer.workspace._id).eq("memberId", viewer.member._id))
      .take(MAX_SESSIONS);
    for (const row of rows) await ctx.db.patch(row._id, { look });
    return null;
  },
});

/**
 * Who is in the world now (the HUD's online list): every member seen in the last minute before `now`
 * (the client's workspace-clock time, as for `nearby`), once each at their freshest position, the
 * most recently seen first, at most 200; the viewer too (`you`). Never anyone offline.
 */
export const online = query({
  args: { now: v.number() },
  returns: v.object({
    count: v.number(),
    players: v.array(v.object({ memberId: v.id("members"), name: v.string(), x: v.number(), y: v.number(), you: v.boolean() })),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (!inWorld(viewer)) return { count: 0, players: [] };
    const since = clampNow(viewer.workspace, args.now) - ONLINE_MS;
    const rows = await ctx.db
      .query("worldPresence")
      .withIndex("by_workspace_updatedAt", (q) => q.eq("workspaceId", viewer.workspace._id).gte("updatedAt", since))
      .order("desc")
      // Sessions of one member (demo visitors, a second tab) collapse into one name.
      .take(2 * ONLINE_LIMIT);
    const seen = new Map<Id<"members">, { memberId: Id<"members">; name: string; x: number; y: number; you: boolean }>();
    for (const row of rows) {
      if (seen.size === ONLINE_LIMIT) break;
      if (!seen.has(row.memberId)) seen.set(row.memberId, { memberId: row.memberId, name: row.name, x: row.x, y: row.y, you: row.memberId === viewer.member._id });
    }
    const players = [...seen.values()];
    return { count: players.length, players };
  },
});

/**
 * The cron (crons.ts): deletes rows not updated for ten minutes, at most 1,500 a run, and returns
 * how many. Across every workspace, so it compares with the wall clock: a simulator's rows (its
 * clock runs ahead) stay a little longer, and go with the simulator's wipe at the latest.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("worldPresence")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", Date.now() - SWEEP_AFTER_MS))
      .take(SWEEP_BATCH);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/**
 * The hogs online in these chunks ("cx:cy", lib/presence.ts `chunksAround`: at most 9), at most 50
 * a chunk, the viewer's own hog left out. `now` is the client's workspace-clock time (round it to a
 * few seconds so the subscription is shared); rows older than a minute before it are offline.
 */
export const nearby = query({
  args: { chunks: v.array(v.string()), now: v.number() },
  returns: v.array(hogValidator),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const chunks = [...new Set(args.chunks)];
    if (chunks.length > MAX_CHUNKS) throw new ConvexError(`At most ${MAX_CHUNKS} chunks at a time.`);
    if (!chunks.every(isChunkKey)) throw new ConvexError("A chunk is \"cx:cy\".");
    if (!inWorld(viewer)) return [];
    const since = clampNow(viewer.workspace, args.now) - ONLINE_MS;
    const sessionId = await sessionOf(ctx);
    const hogs = [];
    for (const chunk of chunks) {
      const rows = await ctx.db
        .query("worldPresence")
        .withIndex("by_workspace_chunk_updatedAt", (q) => q.eq("workspaceId", viewer.workspace._id).eq("chunk", chunk).gte("updatedAt", since))
        .order("desc")
        .take(PER_CHUNK);
      for (const row of rows) if (!(row.memberId === viewer.member._id && row.sessionId === sessionId)) hogs.push(hogOf(row));
    }
    return hogs;
  },
});

