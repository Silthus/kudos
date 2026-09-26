import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertNotDemo, getViewer, requireAdmin } from "./lib/access";
import { slackApi } from "./lib/slack";
import { announcementText, type BoostKind, type BoostSource, cancellationText, MAX_SCHEDULED, SCHEDULE_AHEAD_DAYS } from "./lib/boosts";
import { addDays, dayKeyFor, parseToday, startOfDayUtc, workspaceNow } from "./lib/time";
import { boostKindValidator, boostSourceValidator } from "./schema";

/**
 * Bonus days and company-wide boosters (#55 §G9, G10; the rules are in lib/boosts.ts). A boost is a
 * `boosts` row for one workspace day; the give path (game.ts) doubles what qualifying kudos earn
 * while it's on, and the rebuild replays it from the same rows. Every boost is announced: in the
 * admin's announcement channel (§G14) when there is one, and always on the in-app banner.
 */

/** The workspace's boost for a day, if any (there is at most one). */
export async function boostOn(ctx: QueryCtx, workspaceId: Id<"workspaces">, dayKey: string) {
  return await ctx.db
    .query("boosts")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId).eq("dayKey", dayKey))
    .first();
}

/** Every boost a workspace had, for the rebuild (a year of daily boosts is a few hundred rows). */
export async function boostsOf(ctx: QueryCtx, workspaceId: Id<"workspaces">): Promise<Doc<"boosts">[]> {
  return await ctx.db
    .query("boosts")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
    .take(5000);
}

/** The boosts from `day` on, soonest first: today's (if any) and the ones waiting. */
async function boostsFrom(ctx: QueryCtx, workspaceId: Id<"workspaces">, day: string) {
  return await ctx.db
    .query("boosts")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId).gte("dayKey", day))
    .take(MAX_SCHEDULED + 2);
}

/**
 * When a boost starting now may start: not before the workspace's latest kudos. Convex fixes
 * `Date.now()` when a mutation starts, so a give that started later may have committed first; a
 * boost starting before it would double it in every rebuild though the give wasn't doubled. The
 * read also makes a give committing meanwhile conflict with this transaction, which then retries.
 */
async function startsNow(ctx: MutationCtx, workspaceId: Id<"workspaces">, now: number) {
  const latest = await ctx.db
    .query("kudos")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .first();
  return latest && latest.at >= now ? latest.at + 1 : now;
}

/**
 * The one way a boost starts: the admin schedule, a booster bought in the Store, and later the
 * team garden's milestones (#96) and the Block party capstone. A booster starts now, for the rest
 * of today; every other source is a bonus day announced in advance, so its `day` is tomorrow or
 * later and it starts at that day's start. Returns null (and changes nothing) when the day already
 * has a boost or the day doesn't fit the source, so the caller can tell the member why or pick
 * another day. Announces it.
 */
export async function startBonusDay(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  day: string,
  source: BoostSource,
  { by, kind = "double", purchaseId, now = workspaceNow(workspace) }: { by?: Id<"members">; kind?: BoostKind; purchaseId?: Id<"itemPurchases">; now?: number } = {},
): Promise<Id<"boosts"> | null> {
  const today = dayKeyFor(now, workspace.timezone);
  if (source === "booster" ? day !== today : day <= today) return null;
  if (await boostOn(ctx, workspace._id, day)) return null;
  const from = day === today ? await startsNow(ctx, workspace._id, now) : startOfDayUtc(day, workspace.timezone);
  const id = await ctx.db.insert("boosts", {
    workspaceId: workspace._id,
    dayKey: day,
    from,
    kind,
    source,
    ...(by ? { by } : {}),
    ...(purchaseId ? { purchaseId } : {}),
    createdAt: now,
    announcement: { status: "skipped" },
  });
  await announce(ctx, workspace, id, day);
  return id;
}

/** Posts a boost in the announcement channel (the demo has none to post in): pending until Slack answers. */
async function announce(ctx: MutationCtx, workspace: Doc<"workspaces">, boostId: Id<"boosts">, dayKey: string) {
  const channel = workspace.isDemo ? undefined : workspace.announceChannel;
  if (!channel) return;
  await ctx.db.patch(boostId, { announcement: { status: "pending", channel: channel.name, channelId: channel.id } });
  await ctx.scheduler.runAfter(0, internal.slack.postAnnouncement, { boostId, workspaceId: workspace._id, kind: "start", dayKey, channelId: channel.id });
}

async function nameOf(ctx: QueryCtx, memberId: Id<"members"> | undefined) {
  const member = memberId ? await ctx.db.get(memberId) : null;
  return member ? { name: member.name, slackUserId: member.slackUserId } : null;
}

/** How a boost reads on the web (names, not mentions), as of `today`. */
async function webText(ctx: QueryCtx, boost: Doc<"boosts">, today: string) {
  const who = await nameOf(ctx, boost.by);
  return announcementText({ kind: boost.kind, source: boost.source, dayKey: boost.dayKey, today, who: who?.name ?? null });
}

const postKindValidator = v.union(v.literal("start"), v.literal("cancel"));

/** What to post, for the Slack action: the bot token and the text (with a mention); null when there's no Slack to post to. */
export const announcementForSlack = internalQuery({
  args: { boostId: v.id("boosts"), workspaceId: v.id("workspaces"), kind: postKindValidator, dayKey: v.string() },
  returns: v.union(v.null(), v.object({ token: v.string(), text: v.string() })),
  handler: async (ctx, { boostId, workspaceId, kind, dayKey }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (!install) return null;
    if (kind === "cancel") return { token: install.botToken, text: cancellationText(dayKey) };
    const boost = await ctx.db.get(boostId);
    if (!boost) return null; // called off before it went out
    const who = await nameOf(ctx, boost.by);
    const today = dayKeyFor(boost.createdAt, workspace.timezone);
    const text = announcementText({ kind: boost.kind, source: boost.source, dayKey: boost.dayKey, today, who: who ? `<@${who.slackUserId}>` : null });
    return { token: install.botToken, text };
  },
});

/**
 * How the start post went, for the admin page: a failed post (e.g. `not_in_channel`) never stops
 * the boost, and can be sent again (`repost`). A post that went out for a bonus day called off
 * meanwhile is followed by the call-off.
 */
export const announced = internalMutation({
  args: {
    boostId: v.id("boosts"),
    workspaceId: v.id("workspaces"),
    dayKey: v.string(),
    channelId: v.string(),
    outcome: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { boostId, workspaceId, dayKey, channelId, outcome, error }) => {
    const boost = await ctx.db.get(boostId);
    if (!boost) {
      if (outcome === "sent") await ctx.scheduler.runAfter(0, internal.slack.postAnnouncement, { boostId, workspaceId, kind: "cancel", dayKey, channelId });
      return null;
    }
    const channel = boost.announcement?.channel;
    await ctx.db.patch(boostId, { announcement: { status: outcome, channel, channelId, ...(outcome === "failed" ? { error: error ?? "unknown_error" } : {}) } });
    return null;
  },
});

/**
 * The banner every player sees (§G9): today's boost while it's on, and the bonus days announced
 * ahead. `today` is the viewer's workspace day, so it rolls over at midnight without the clock.
 * Null while the game is off or hidden from them.
 */
export const banner = query({
  args: { today: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      current: v.union(v.null(), v.object({ kind: boostKindValidator, text: v.string() })),
      upcoming: v.array(v.object({ dayKey: v.string(), kind: boostKindValidator, text: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    // Not an error for someone signed out mid-session: the banner sits outside the page's error boundary.
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    const { workspace, member } = viewer;
    if (workspace.gameEnabled !== true || member.gameHidden) return null;
    const today = parseToday(args.today);
    const boosts = await boostsFrom(ctx, workspace._id, today);
    const todays = boosts.find((b) => b.dayKey === today);
    const upcoming = boosts.filter((b) => b.dayKey > today);
    return {
      current: todays ? { kind: todays.kind, text: await webText(ctx, todays, today) } : null,
      upcoming: await Promise.all(upcoming.map(async (b) => ({ dayKey: b.dayKey, kind: b.kind, text: await webText(ctx, b, today) }))),
    };
  },
});

const announcementValidator = v.union(
  v.null(),
  v.object({
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    channel: v.optional(v.string()),
    channelId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
);

/**
 * The admin's view: the announcement channel and every boost from today on, each with the text it
 * was announced with (dated from the day it was announced) and how its post went.
 */
export const admin = query({
  args: { today: v.string() },
  returns: v.object({
    channel: v.union(v.null(), v.object({ id: v.string(), name: v.string() })),
    isDemo: v.boolean(),
    maxAheadDays: v.number(),
    boosts: v.array(
      v.object({
        _id: v.id("boosts"),
        dayKey: v.string(),
        kind: boostKindValidator,
        source: boostSourceValidator,
        by: v.union(v.string(), v.null()),
        text: v.string(),
        announcement: announcementValidator,
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { workspace } = await requireAdmin(ctx);
    const today = parseToday(args.today);
    const boosts = await boostsFrom(ctx, workspace._id, today);
    return {
      channel: workspace.announceChannel ?? null,
      isDemo: workspace.isDemo,
      maxAheadDays: SCHEDULE_AHEAD_DAYS,
      boosts: await Promise.all(
        boosts.map(async (b) => ({
          _id: b._id,
          dayKey: b.dayKey,
          kind: b.kind,
          source: b.source,
          by: (await nameOf(ctx, b.by))?.name ?? null,
          text: await webText(ctx, b, dayKeyFor(b.createdAt, workspace.timezone)),
          announcement: b.announcement ?? null,
        })),
      ),
    };
  },
});

/**
 * An admin schedules a bonus day (§G9): always in advance (tomorrow at the earliest, so it can be
 * announced before it starts), at most 90 days ahead and 12 waiting at once, one boost a day. Only
 * while the game is on: there's nothing to double without it.
 */
export const schedule = mutation({
  args: { day: v.string() },
  returns: v.id("boosts"),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireAdmin(ctx);
    if (workspace.gameEnabled !== true) throw new ConvexError("Bonus days double XP and Hog coins, so they need the game on (Settings).");
    const day = parseToday(args.day);
    const now = workspaceNow(workspace);
    const today = dayKeyFor(now, workspace.timezone);
    if (day <= today) throw new ConvexError("Bonus days are announced in advance: pick tomorrow or a later day.");
    if (day > addDays(today, SCHEDULE_AHEAD_DAYS)) throw new ConvexError(`Pick a day within the next ${SCHEDULE_AHEAD_DAYS} days.`);
    const waiting = (await boostsFrom(ctx, workspace._id, addDays(today, 1))).length;
    if (waiting >= MAX_SCHEDULED) throw new ConvexError(`${MAX_SCHEDULED} bonus days are waiting already. Let one pass first.`);
    const id = await startBonusDay(ctx, workspace, day, "schedule", { by: member._id, now });
    if (!id) throw new ConvexError("That day has a bonus day or booster already.");
    return id;
  },
});

async function adminBoost(ctx: MutationCtx, boostId: Id<"boosts">) {
  const { workspace } = await requireAdmin(ctx);
  const boost = await ctx.db.get(boostId);
  if (!boost || boost.workspaceId !== workspace._id) throw new ConvexError("That bonus day doesn't exist.");
  return { workspace, boost };
}

/** An admin calls off a scheduled bonus day before it starts; the channel hears it if it heard of it. */
export const cancel = mutation({
  args: { boostId: v.id("boosts") },
  returns: v.null(),
  handler: async (ctx, { boostId }) => {
    const { workspace, boost } = await adminBoost(ctx, boostId);
    // Kudos given during a boost earned double: it's history now, and a rebuild must replay it.
    const now = workspaceNow(workspace);
    if (boost.from <= now || boost.dayKey <= dayKeyFor(now, workspace.timezone)) throw new ConvexError("That boost has started, so it runs until midnight.");
    if (boost.source !== "schedule") throw new ConvexError("Only scheduled bonus days can be called off.");
    await ctx.db.delete(boostId);
    const channelId = boost.announcement?.channelId;
    if (boost.announcement?.status === "sent" && channelId && !workspace.isDemo) {
      await ctx.scheduler.runAfter(0, internal.slack.postAnnouncement, { boostId, workspaceId: workspace._id, kind: "cancel", dayKey: boost.dayKey, channelId });
    }
    return null;
  },
});

/** An admin posts a boost's announcement again (after inviting the app, or picking a channel), in today's channel. */
export const repost = mutation({
  args: { boostId: v.id("boosts") },
  returns: v.null(),
  handler: async (ctx, { boostId }) => {
    const { workspace, boost } = await adminBoost(ctx, boostId);
    if (boost.dayKey < dayKeyFor(workspaceNow(workspace), workspace.timezone)) throw new ConvexError("That boost is over.");
    const status = boost.announcement?.status;
    if (status === "sent" || status === "pending") throw new ConvexError("It's announced already.");
    if (workspace.isDemo || !workspace.announceChannel) throw new ConvexError("Pick an announcement channel first.");
    await announce(ctx, workspace, boostId, boost.dayKey);
    return null;
  },
});

/**
 * A timezone change moves the scheduled bonus days that haven't started to the start of their day
 * in the new timezone, never earlier than now: kudos already given keep what they earned.
 */
export async function retimeBoosts(ctx: MutationCtx, workspace: Doc<"workspaces">, timezone: string, now: number) {
  for (const boost of await boostsFrom(ctx, workspace._id, addDays(dayKeyFor(now, workspace.timezone), -1))) {
    if (boost.source === "booster" || boost.from <= now) continue;
    await ctx.db.patch(boost._id, { from: Math.max(now, startOfDayUtc(boost.dayKey, timezone)) });
  }
}

/** The bot token for the signed-in admin's workspace (the channel picker); null in the demo. */
export const adminInstall = internalQuery({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    if (workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    return install?.botToken ?? null;
  },
});

const CHANNEL_PAGES = 5;

/**
 * The channels an admin can announce in: the ones the Kudos app is in (`users.conversations`,
 * `channels:read` + `groups:read`), since it can only post where it's a member. The page says how to
 * invite it anywhere else.
 */
export const channels = action({
  args: {},
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx) => {
    const token = await ctx.runQuery(internal.boosts.adminInstall, {});
    if (!token) return [];
    const out: { id: string; name: string }[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < CHANNEL_PAGES; page++) {
      const res = await slackApi(token, "users.conversations", { types: "public_channel,private_channel", exclude_archived: true, limit: 200, cursor });
      if (!res.ok) throw new ConvexError(`Slack didn't list the channels (${res.error}).`);
      for (const c of (res.channels ?? []) as { id: string; name: string }[]) out.push({ id: c.id, name: c.name });
      cursor = (res.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || undefined;
      if (!cursor) break;
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** The announcement channel (§G14): where boosts are posted. Null: only the in-app banner. */
export const setChannel = mutation({
  args: { channel: v.union(v.null(), v.object({ id: v.string(), name: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { channel }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, "The demo's announcement channel is");
    if (channel && (!/^[CG][A-Z0-9]{1,30}$/.test(channel.id) || channel.name.length === 0 || channel.name.length > 80)) {
      throw new ConvexError("Pick a channel from the list.");
    }
    await ctx.db.patch(workspace._id, { announceChannel: channel ?? undefined });
    return null;
  },
});
