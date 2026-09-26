import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
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
  MAX_AHEAD_MS,
  MAX_BEHIND_MS,
  MAX_CHUNKS,
  MIN_BEAT_MS,
  ONLINE_BEAT_MS,
  ONLINE_LIMIT,
  ONLINE_MS,
  PER_CHUNK,
  shouldSave,
  SWEEP_AFTER_MS,
  SWEEP_BATCH,
  tileValidator,
} from "./lib/presence";
import { workspaceNow } from "./lib/time";
import { isSharedDemo, leaveWorld } from "./lib/world";
import { titleForLevel } from "./lib/xp";

/**
 * Presence in the shared world (#155, design plan #152 S2). The client sends a heartbeat while its
 * hog is in the world (at most 4 a second while walking, every 20 s standing still); each one
 * upserts the viewer's `worldPresence` row for their sign-in session (every visitor to the shared
 * demo is the same member, each their own hog), every 15 s its `worldOnline` copy, and now and then
 * saves where they stand to `players.at` so they reappear there. Other clients read the rows of the
 * chunks around them (`nearby`) and who is online (`online`). Only within the workspace, and only
 * while the game is shown to both: a member who hides the game, or a workspace with the game off,
 * is never in the world and sees nobody in it. Rows older than a minute are offline and never
 * shown; `sweep` deletes them after ten.
 *
 * Every time is on the workspace clock. Queries take the client's `now` rather than reading the
 * clock (they aren't re-run as time passes); the server's clock only bounds how far back it looks.
 */

/** The viewer's sign-in session. */
async function sessionOf(ctx: QueryCtx): Promise<string> {
  return (await getAuthSessionId(ctx)) ?? "";
}

/** The viewer's hog in this session. */
function ownHog(ctx: QueryCtx, { workspace, member }: Viewer, sessionId: string) {
  return ctx.db
    .query("worldPresence")
    .withIndex("by_workspace_member_session", (q) => q.eq("workspaceId", workspace._id).eq("memberId", member._id).eq("sessionId", sessionId))
    .unique();
}

/** The viewer's entry in the online list for this session. */
function ownListing(ctx: QueryCtx, { workspace, member }: Viewer, sessionId: string) {
  return ctx.db
    .query("worldOnline")
    .withIndex("by_workspace_member_session", (q) => q.eq("workspaceId", workspace._id).eq("memberId", member._id).eq("sessionId", sessionId))
    .unique();
}

/** Whether the viewer is in the world: the game shown to them, and the shared demo not mid-reset. */
function inWorld({ workspace, member }: Viewer): boolean {
  return gameShownTo(workspace, member) && workspace.resettingSince === undefined;
}

/**
 * The oldest time a hog may have been seen and still show: a minute before the client's `now`,
 * with `now` pulled to within MAX_BEHIND_MS / MAX_AHEAD_MS of the server's workspace clock, so a
 * crafted `now` never shows anyone gone for more than ~70 s.
 */
function onlineSince(workspace: Doc<"workspaces">, now: number): number {
  const server = workspaceNow(workspace);
  const at = Number.isFinite(now) ? Math.min(Math.max(now, server - MAX_BEHIND_MS), server + MAX_AHEAD_MS) : server;
  return at - ONLINE_MS;
}

/** How a hog is shown to others. */
const hogValidator = v.object({
  id: v.id("worldPresence"), // one per member and sign-in session: the key to draw it by
  memberId: v.id("members"),
  name: v.string(),
  title: v.string(), // their level title
  x: v.number(),
  y: v.number(),
  facing: facingValidator,
  animation: hogAnimationValidator,
  look: lookValidator,
  hasHome: v.boolean(), // "Visit their home": homes arrive with #160
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
    hasHome: false,
    updatedAt: row.updatedAt,
  };
}

/**
 * The viewer's hog is at (x, y), facing and doing this. "ok" when recorded; "notShown" when the game
 * is off or hidden for them (stop beating until it's shown again), "resetting" while the shared demo
 * resets (keep beating slowly): either way their hog leaves the world. One presence write per call;
 * every 15 s its online copy, and where they stand is saved to `players.at` when `shouldSave` says so.
 */
export const heartbeat = mutation({
  args: { x: v.number(), y: v.number(), facing: facingValidator, animation: hogAnimationValidator },
  returns: v.union(v.literal("ok"), v.literal("notShown"), v.literal("resetting")),
  handler: async (ctx, { x, y, facing, animation }) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    const sessionId = await sessionOf(ctx);
    if (!inWorld(viewer)) {
      await leaveWorld(ctx, workspace, member._id, sessionId);
      return gameShownTo(workspace, member) ? "resetting" : "notShown";
    }
    if (!isTile(x, y)) throw new ConvexError("That tile is outside the world.");
    const now = workspaceNow(workspace);
    const row = await ownHog(ctx, viewer, sessionId);
    if (row && now - row.updatedAt < MIN_BEAT_MS && row.facing === facing && row.animation === animation) return "ok";

    const player = await playerOf(ctx, member._id);
    // The shared demo's visitors are one member: a saved spot would be wherever another visitor left.
    if (player && !isSharedDemo(workspace) && shouldSave({ at: player.at, x, y, walking: animation === "walk", savedAt: player.atSavedAt, now })) {
      await ctx.db.patch(player._id, { at: { x, y }, atSavedAt: now });
    }
    const hog = {
      x,
      y,
      chunk: chunkKey(x, y),
      facing,
      animation,
      name: member.name,
      title: titleForLevel(player?.level ?? 1),
      look: player?.look ?? DEFAULT_LOOK,
      updatedAt: now,
    };
    if (row) await ctx.db.patch(row._id, hog);
    else await ctx.db.insert("worldPresence", { workspaceId: workspace._id, memberId: member._id, sessionId, ...hog });

    const listed = await ownListing(ctx, viewer, sessionId);
    const entry = { name: member.name, x, y, seenAt: now };
    if (!listed) await ctx.db.insert("worldOnline", { workspaceId: workspace._id, memberId: member._id, sessionId, ...entry });
    else if (now - listed.seenAt >= ONLINE_BEAT_MS || listed.name !== member.name) await ctx.db.patch(listed._id, entry);
    return "ok";
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
    // This session's hog (kept up to ten minutes after it stopped beating) is where a reload left it,
    // even mid-walk, before `players.at` caught up.
    const row = await ownHog(ctx, viewer, await sessionOf(ctx));
    const at = row ? { x: row.x, y: row.y } : (player?.at ?? null);
    return { at, look: player?.look ?? DEFAULT_LOOK };
  },
});

/**
 * Your hog's look (the cabin): a Hedgehog Mode colour filter and accessory, or none. Worn at once
 * here; your other sessions put it on with their next heartbeat.
 */
export const setLook = mutation({
  args: lookValidator.fields,
  returns: v.null(),
  handler: async (ctx, look) => {
    const viewer = await requireViewer(ctx);
    if (!gameShownTo(viewer.workspace, viewer.member)) throw new ConvexError("Your look is part of the game, which is off or hidden for you.");
    const player = await playerOf(ctx, viewer.member._id);
    if (!player) throw new ConvexError("Your hog's look opens with your first kudos.");
    await ctx.db.patch(player._id, { look });
    const row = await ownHog(ctx, viewer, await sessionOf(ctx));
    if (row) await ctx.db.patch(row._id, { look });
    return null;
  },
});

/**
 * Who is in the world now (the HUD's online list): every member seen in the last minute before `now`
 * (the client's workspace-clock time, as for `nearby`), once each at where they were within the last
 * 15 s, the most recently seen first, at most 200; the viewer too (`you`). In the shared demo every
 * visitor is listed (they're all the demo user); `you` is only the viewer's own session. Never anyone
 * offline.
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
    const bySession = isSharedDemo(viewer.workspace);
    const sessionId = await sessionOf(ctx);
    const rows = await ctx.db
      .query("worldOnline")
      .withIndex("by_workspace_seenAt", (q) => q.eq("workspaceId", viewer.workspace._id).gte("seenAt", onlineSince(viewer.workspace, args.now)))
      .order("desc")
      // A member's sessions (a second tab) collapse into one name.
      .take(2 * ONLINE_LIMIT);
    const seen = new Map<string, { memberId: Id<"members">; name: string; x: number; y: number; you: boolean }>();
    for (const row of rows) {
      if (seen.size === ONLINE_LIMIT) break;
      const key = bySession ? `${row.memberId}|${row.sessionId}` : row.memberId;
      const you = row.memberId === viewer.member._id && (!bySession || row.sessionId === sessionId);
      if (!seen.has(key)) seen.set(key, { memberId: row.memberId, name: row.name, x: row.x, y: row.y, you });
    }
    const players = [...seen.values()];
    return { count: players.length, players };
  },
});

/**
 * The hogs online in these chunks ("cx:cy", lib/presence.ts `chunksAround`: at most 9), at most 50
 * a chunk, the viewer's own hog (this session) left out. `now` is the client's workspace-clock time:
 * round it down to a few seconds so the subscription changes rarely; rows seen more than a minute
 * before it are offline.
 */
export const nearby = query({
  args: { chunks: v.array(v.string()), now: v.number() },
  returns: v.array(hogValidator),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (args.chunks.length > MAX_CHUNKS) throw new ConvexError(`At most ${MAX_CHUNKS} chunks at a time.`);
    if (!args.chunks.every(isChunkKey)) throw new ConvexError('A chunk is "cx:cy".');
    if (!inWorld(viewer)) return [];
    const since = onlineSince(viewer.workspace, args.now);
    const sessionId = await sessionOf(ctx);
    const hogs = [];
    for (const chunk of new Set(args.chunks)) {
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

/**
 * The cron (crons.ts): deletes hogs not seen for ten minutes, at most 1,500 rows a run, and returns
 * how many. Across every workspace, so it compares with the wall clock: a simulator's rows (its
 * clock runs ahead) stay a little longer, and go with the simulator's wipe at the latest.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const before = Date.now() - SWEEP_AFTER_MS;
    const hogs = await ctx.db
      .query("worldPresence")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", before))
      .take(SWEEP_BATCH);
    const room = SWEEP_BATCH - hogs.length;
    const listed = room > 0 ? await ctx.db.query("worldOnline").withIndex("by_seenAt", (q) => q.lt("seenAt", before)).take(room) : [];
    for (const row of [...hogs, ...listed]) await ctx.db.delete(row._id);
    return hogs.length + listed.length;
  },
});
