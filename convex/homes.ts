import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { shownLook } from "./cosmetics";
import { gameShownTo, playerOf } from "./game";
import { sendGains } from "./gains";
import { requireViewer, type Viewer } from "./lib/access";
import { coinBalance, WALLET_LEVEL } from "./lib/coins";
import { lanternNote, LANTERN } from "./lib/garden";
import { GUESTBOOK_MAX, HOME_STAGE_BY_ID, LANTERNS_PER_VISITOR_PER_WEEK, nextHomeStage, PLOT_PRICE, stageCost, type HomeStageId } from "./lib/homes";
import { weekKeyOfDay } from "./lib/quests";
import { DAY_MS, dayKeyFor, workspaceNow } from "./lib/time";
import { homePlots, MAX_HOME_PLOTS } from "./lib/tree";
import { cosmeticLookValidator, homeStageValidator } from "./schema";
import { treeOf } from "./tree";
import { spendCoins } from "./wallet";

/**
 * Homes on the tree (#160, design plan #152 S5; the rules are `lib/homes.ts`). A member buys one
 * branch plot on the homes ring (the plots are `lib/tree.ts layout().homes`, numbered in plot order;
 * `homePlots(peakGrowth)` of them) and builds a home on it in stages, each paid in Hog coins outside
 * the Store and taking real days on the workspace clock, like a plant. A star fruit's discount
 * (`players.homeDiscount`, #157) comes off the next stage paid. A stage is finished once its days have
 * passed: every read works that out (`stageOf`, at the client's `now` on the workspace clock, so it
 * counts down as time goes by), and `settle` writes it and tells the owner, once, when the scheduled
 * `finish` comes, the owner builds again, or a simulator's day goes by.
 *
 * Visitors leave a lantern in a home's guestbook: a plain-text note (moderated like the garden's
 * Lanterns, #97), one per visitor per home per week, the latest GUESTBOOK_MAX kept.
 *
 * A home is shown while its owner is: not deactivated, not a bot, and seeing the game. The ring reads
 * no members: each home keeps its owner's name and whether they're out of view (`syncHomeOwner`,
 * called where those change), so a kudos, which writes its giver's member row, never re-runs it.
 *
 * Homes are state: a game rebuild never touches them, and the `home` game event of a plot bought
 * (#159's tutorial step "Settle") is kept by it too.
 */

type Home = Doc<"homes">;

async function homeOf(ctx: QueryCtx, memberId: Id<"members">): Promise<Home | null> {
  return await ctx.db
    .query("homes")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .first();
}

/** Whether a member's home is shown to others: not deactivated, not a bot, seeing the game. */
function ownerShown(workspace: Doc<"workspaces">, member: Doc<"members"> | null): member is Doc<"members"> {
  return !!member && !member.deactivated && !member.isBot && gameShownTo(workspace, member);
}

/** Whether a member has a home on the tree others may visit: the presence card's "Visit their home" (#158). */
export async function hasHome(ctx: QueryCtx, memberId: Id<"members">): Promise<boolean> {
  const home = await homeOf(ctx, memberId);
  return !!home && !home.hidden;
}

/** Whether a member's home has every stage built: a star fruit's discount has nothing left to take off (#157). */
export async function homeFinished(ctx: QueryCtx, memberId: Id<"members">): Promise<boolean> {
  const home = await homeOf(ctx, memberId);
  return !!home && !home.buildingTo && nextHomeStage(home.stage) === null;
}

/**
 * Keeps a member's home in step with them: the name the ring shows, and whether they're out of view
 * (deactivated, a bot, or hiding the game). Called where those change: the Slack user sync and "Hide
 * the game".
 */
export async function syncHomeOwner(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  const home = await homeOf(ctx, member._id);
  if (!home) return;
  const hidden = ownerShown(workspace, member) ? undefined : (true as const);
  if (home.name !== member.name || home.hidden !== hidden) await ctx.db.patch(home._id, { name: member.name, hidden });
}

/** When the stage under way is finished. */
const doneAt = (home: Home) => home.stageStartedAt + (home.buildingTo ? HOME_STAGE_BY_ID[home.buildingTo].days * DAY_MS : 0);

/** A home as it stands at `now`: the stage under way is finished once its days have passed. */
function stageOf(home: Home, now: number): { stage: HomeStageId; buildingTo: HomeStageId | null; doneAt: number | null } {
  if (!home.buildingTo) return { stage: home.stage, buildingTo: null, doneAt: null };
  if (now >= doneAt(home)) return { stage: home.buildingTo, buildingTo: null, doneAt: null };
  return { stage: home.stage, buildingTo: home.buildingTo, doneAt: doneAt(home) };
}

/** Whole days until `doneAt`, at least 1; an hour's grace, so a read at a rounded-down `now` doesn't count a day too many. */
function daysLeft(doneAt: number, now: number) {
  return Math.max(1, Math.ceil((doneAt - now - 60 * 60 * 1000) / DAY_MS));
}

/** How far a client's clock may be from the server's workspace clock before the server's is used instead. */
const MAX_BEHIND_MS = 6 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 10 * 60 * 1000;

/**
 * The time a read works a home out at: the client's `now` on the workspace clock (rounded, so the
 * subscription changes a few times an hour and re-runs as the days pass), kept near the server's.
 */
function readAt(workspace: Doc<"workspaces">, now: number) {
  const server = workspaceNow(workspace);
  return Number.isFinite(now) ? Math.min(Math.max(now, server - MAX_BEHIND_MS), server + MAX_AHEAD_MS) : server;
}

/**
 * Writes a finished stage down and tells the owner (a `home_stage` gain DM; nobody who doesn't see
 * the game): exactly once per stage, since only the write that finishes it sees it under way.
 * Returns the stage finished, if any.
 */
async function settle(ctx: MutationCtx, workspace: Doc<"workspaces">, home: Home): Promise<HomeStageId | null> {
  const now = workspaceNow(workspace);
  if (!home.buildingTo || now < doneAt(home)) return null;
  const stage = home.buildingTo;
  await ctx.db.patch(home._id, { stage, buildingTo: undefined, stageStartedAt: doneAt(home) });
  await sendGains(ctx, workspace, home.memberId, [{ kind: "home_stage", stage }]);
  return stage;
}

/** The stage under way may be due: settle it (scheduled by `build` for the moment its days are up, on the workspace clock). */
export const finish = internalMutation({
  args: { homeId: v.id("homes") },
  returns: v.null(),
  handler: async (ctx, { homeId }) => {
    const home = await ctx.db.get(homeId);
    const workspace = home && (await ctx.db.get(home.workspaceId));
    if (home && workspace) await settle(ctx, workspace, home);
    return null;
  },
});

/**
 * Settles every home in a workspace whose stage is due: a simulator's day went by (simulator.ts; the
 * scheduled `finish` waits on the wall clock). Returns the stage each member's home finished.
 */
export async function settleHomes(ctx: MutationCtx, workspace: Doc<"workspaces">): Promise<Map<Id<"members">, HomeStageId>> {
  const finished = new Map<Id<"members">, HomeStageId>();
  const homes = await ctx.db
    .query("homes")
    .withIndex("by_workspace_plot", (q) => q.eq("workspaceId", workspace._id))
    .take(MAX_HOME_PLOTS);
  for (const home of homes) {
    const stage = await settle(ctx, workspace, home);
    if (stage) finished.set(home.memberId, stage);
  }
  return finished;
}

// ── Reads ───────────────────────────────────────────────────────────────────

const buildingValidator = v.union(v.null(), v.object({ to: homeStageValidator, name: v.string(), doneAt: v.number(), daysLeft: v.number() }));
const lanternValidator = v.object({
  _id: v.id("homeLanterns"),
  by: v.string(),
  note: v.string(),
  at: v.number(),
  /** The home's owner and admins may take a lantern down (moderation). */
  canTakeDown: v.boolean(),
});

function building(state: ReturnType<typeof stageOf>, now: number) {
  if (!state.buildingTo || state.doneAt === null) return null;
  return { to: state.buildingTo, name: HOME_STAGE_BY_ID[state.buildingTo].name, doneAt: state.doneAt, daysLeft: daysLeft(state.doneAt, now) };
}

/** The guestbook, newest first; lanterns from someone who left are out of view. */
async function guestbook(ctx: QueryCtx, viewer: Viewer, home: Home) {
  const rows = await ctx.db
    .query("homeLanterns")
    .withIndex("by_home_at", (q) => q.eq("homeId", home._id))
    .order("desc")
    .take(GUESTBOOK_MAX);
  const mayModerate = viewer.member._id === home.memberId || viewer.member.isAdmin;
  const out = [];
  for (const l of rows) {
    const by = await ctx.db.get(l.by);
    if (!by || by.deactivated) continue;
    out.push({ _id: l._id, by: by.name, note: l.note, at: l.at, canTakeDown: mayModerate });
  }
  return out;
}

/** Lanterns `by` left at `home` in the workspace week of `at`. */
async function lanternsThisWeek(ctx: QueryCtx, workspace: Doc<"workspaces">, home: Home, by: Id<"members">, at: number) {
  const week = weekKeyOfDay(dayKeyFor(at, workspace.timezone));
  const latest = await ctx.db
    .query("homeLanterns")
    .withIndex("by_home_by_at", (q) => q.eq("homeId", home._id).eq("by", by))
    .order("desc")
    .take(LANTERNS_PER_VISITOR_PER_WEEK);
  return { week, count: latest.filter((l) => l.week === week).length };
}

async function plotsOpen(ctx: QueryCtx, workspace: Doc<"workspaces">) {
  return homePlots((await treeOf(ctx, workspace._id))?.peakGrowth ?? 0);
}

/**
 * The viewer's home window: whether the homes ring is open and how many plots it has, the plot price,
 * their wallet (null below level 3, where coins stay silent) and star-fruit discount, and their home:
 * its plot, stage, the stage under way (days left) or the next one with its cost, and the guestbook.
 * `now`: the client's workspace-clock time, rounded. Null while the game isn't shown to them.
 */
export const mine = query({
  args: { now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      open: v.boolean(),
      plots: v.number(),
      price: v.number(),
      level: v.number(),
      buyLevel: v.number(),
      balance: v.union(v.null(), v.number()),
      discount: v.union(v.null(), v.number()),
      home: v.union(
        v.null(),
        v.object({
          plot: v.number(),
          stage: homeStageValidator,
          building: buildingValidator,
          /** The stage to build next, with its cost and what it costs with a star fruit (null: no discount); null while one is under way, or after the last. */
          next: v.union(v.null(), v.object({ id: homeStageValidator, name: v.string(), cost: v.number(), discounted: v.union(v.null(), v.number()), days: v.number() })),
          guestbook: v.array(lanternValidator),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    if (!gameShownTo(workspace, member)) return null;
    const plots = await plotsOpen(ctx, workspace);
    const player = await playerOf(ctx, member._id);
    const level = player?.level ?? 1;
    const discount = player?.homeDiscount ?? null;
    const home = await homeOf(ctx, member._id);
    const now = readAt(workspace, args.now);
    let view = null;
    if (home) {
      const state = stageOf(home, now);
      const next = state.buildingTo ? null : nextHomeStage(state.stage);
      view = {
        plot: home.plot,
        stage: state.stage,
        building: building(state, now),
        next: next && { id: next.id, name: next.name, cost: next.cost, discounted: discount ? stageCost(next, discount) : null, days: next.days },
        guestbook: await guestbook(ctx, viewer, home),
      };
    }
    return {
      open: plots > 0,
      plots,
      price: PLOT_PRICE,
      level,
      buyLevel: WALLET_LEVEL,
      balance: player && level >= WALLET_LEVEL ? coinBalance(player, member).balance : null,
      discount,
      home: view,
    };
  },
});

/**
 * A teammate's home, visited: the owner (with the frame and banner they wear, S5), plot, stage (and
 * the stage under way), the guestbook and whether the viewer may leave a lantern now. The id comes
 * from the URL (`/homes/:memberId`), so one that isn't a member's is nobody's home, not an error.
 * Null too without a home, for an owner out of view, or while the game isn't shown to the viewer.
 */
export const of = query({
  args: { memberId: v.string(), now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      memberId: v.id("members"),
      name: v.string(),
      avatarUrl: v.union(v.string(), v.null()),
      look: cosmeticLookValidator,
      plot: v.number(),
      stage: homeStageValidator,
      building: buildingValidator,
      yours: v.boolean(),
      canLeaveLantern: v.boolean(),
      guestbook: v.array(lanternValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member } = viewer;
    if (!gameShownTo(workspace, member)) return null;
    const ownerId = ctx.db.normalizeId("members", args.memberId);
    const owner = ownerId && (await ctx.db.get(ownerId));
    if (!owner || owner.workspaceId !== workspace._id || !ownerShown(workspace, owner)) return null;
    const home = await homeOf(ctx, owner._id);
    if (!home) return null;
    const now = readAt(workspace, args.now);
    const state = stageOf(home, now);
    const yours = owner._id === member._id;
    return {
      memberId: owner._id,
      name: owner.name,
      avatarUrl: owner.avatarUrl ?? null,
      look: shownLook(workspace, owner, member),
      plot: home.plot,
      stage: state.stage,
      building: building(state, now),
      yours,
      canLeaveLantern: !yours && (await lanternsThisWeek(ctx, workspace, home, member._id, now)).count < LANTERNS_PER_VISITOR_PER_WEEK,
      guestbook: await guestbook(ctx, viewer, home),
    };
  },
});

/**
 * Every home on the ring, by plot: its owner's name and its stage at the client's `now`, for drawing
 * the ring. At most MAX_HOME_PLOTS, and no member reads (the homes keep their owners' names).
 */
export const all = query({
  args: { now: v.number() },
  returns: v.array(v.object({ plot: v.number(), memberId: v.id("members"), name: v.string(), stage: homeStageValidator, building: v.boolean() })),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const now = readAt(workspace, args.now);
    const homes = await ctx.db
      .query("homes")
      .withIndex("by_workspace_plot", (q) => q.eq("workspaceId", workspace._id))
      .take(MAX_HOME_PLOTS);
    return homes
      .filter((home) => !home.hidden)
      .map((home) => {
        const state = stageOf(home, now);
        return { plot: home.plot, memberId: home.memberId, name: home.name, stage: state.stage, building: state.buildingTo !== null };
      });
  },
});

// ── Acts ────────────────────────────────────────────────────────────────────

/** The viewer as a home owner-to-be: the game shown, and a player with their wallet open. */
async function requireSettler(ctx: QueryCtx) {
  const { workspace, member } = await requireViewer(ctx);
  if (!gameShownTo(workspace, member)) throw new ConvexError("Homes are part of the game, which is off or hidden for you.");
  const player = await playerOf(ctx, member._id);
  if (!player || player.level < WALLET_LEVEL) throw new ConvexError(`Your home opens with your wallet, at level ${WALLET_LEVEL}.`);
  return { workspace, member, player };
}

/**
 * Buys branch plot `plot` (the client offers the free plots it draws, or the next free one): 40 Hog
 * coins, spent in this transaction, one plot per member and one member per plot. The home starts
 * under the sky, and a `home` game event marks it (#159's "Settle").
 */
export const buy = mutation({
  args: { plot: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workspace, member, player } = await requireSettler(ctx);
    // -0 is 0: an index key tells them apart, and plot 0 must be one plot.
    const plot = args.plot + 0;
    const plots = await plotsOpen(ctx, workspace);
    if (plots === 0) throw new ConvexError("The homes ring opens when the tree is a grown tree.");
    if (!Number.isInteger(plot) || plot < 0 || plot >= plots) throw new ConvexError("That isn't a plot on the tree.");
    if (await homeOf(ctx, member._id)) throw new ConvexError("You already have a home on the tree.");
    const taken = await ctx.db
      .query("homes")
      .withIndex("by_workspace_plot", (q) => q.eq("workspaceId", workspace._id).eq("plot", plot))
      .first();
    if (taken) throw new ConvexError("Someone built on that plot already. Pick another.");
    await spendCoins(ctx, member, player, PLOT_PRICE, "A plot");
    const now = workspaceNow(workspace);
    await ctx.db.insert("homes", { workspaceId: workspace._id, memberId: member._id, name: member.name, plot, stage: "sky", stageStartedAt: now });
    await ctx.db.insert("gameEvents", {
      workspaceId: workspace._id,
      memberId: member._id,
      kind: "home",
      batchId: `home:${member._id}`,
      dayKey: dayKeyFor(now, workspace.timezone),
      at: now,
      xp: 0,
    });
    return null;
  },
});

/**
 * Builds the viewer's next stage: pays its cost (less a waiting star fruit's discount, which it uses
 * up) and starts its days on the workspace clock. One stage at a time.
 */
export const build = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, member, player } = await requireSettler(ctx);
    const found = await homeOf(ctx, member._id);
    if (!found) throw new ConvexError("Buy a plot first: your home goes on it.");
    await settle(ctx, workspace, found);
    const home = (await ctx.db.get(found._id))!;
    const now = workspaceNow(workspace);
    if (home.buildingTo) {
      const days = daysLeft(doneAt(home), now);
      throw new ConvexError(`Your home is still building: ${HOME_STAGE_BY_ID[home.buildingTo].name}, ${days === 1 ? "1 day" : `${days} days`} left.`);
    }
    const next = nextHomeStage(home.stage);
    if (!next) throw new ConvexError(`Your home is a ${HOME_STAGE_BY_ID[home.stage].name}: the last stage.`);
    await spendCoins(ctx, member, player, stageCost(next, player.homeDiscount ?? 0), `The ${next.name.toLowerCase()}`);
    if (player.homeDiscount !== undefined) await ctx.db.patch(player._id, { homeDiscount: undefined });
    await ctx.db.patch(home._id, { buildingTo: next.id, stageStartedAt: now, name: member.name });
    // On the workspace clock: the stage is due that far from `now`.
    await ctx.scheduler.runAfter(next.days * DAY_MS, internal.homes.finish, { homeId: home._id });
    return null;
  },
});

/**
 * Leaves a lantern in a teammate's guestbook: a note of one line, 80 characters at most (cleaned like
 * a garden Lantern's), once a week per home. The oldest beyond GUESTBOOK_MAX go.
 */
export const leaveLantern = mutation({
  args: { memberId: v.id("members"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("Homes are part of the game, which is off or hidden for you.");
    const owner = await ctx.db.get(args.memberId);
    const home = owner && owner.workspaceId === workspace._id && ownerShown(workspace, owner) ? await homeOf(ctx, owner._id) : null;
    if (!home) throw new ConvexError("They have no home on the tree yet.");
    if (home.memberId === member._id) throw new ConvexError("Not in your own guestbook: it's for your visitors.");
    const note = lanternNote(args.note);
    if (note === null) throw new ConvexError(`Write a note of one line, ${LANTERN.maxChars} characters at most.`);
    const now = workspaceNow(workspace);
    const { week, count } = await lanternsThisWeek(ctx, workspace, home, member._id, now);
    if (count >= LANTERNS_PER_VISITOR_PER_WEEK) throw new ConvexError("You left a lantern here this week. Leave another next week.");
    await ctx.db.insert("homeLanterns", { workspaceId: workspace._id, homeId: home._id, by: member._id, note, at: now, week });
    const beyond = await ctx.db
      .query("homeLanterns")
      .withIndex("by_home_at", (q) => q.eq("homeId", home._id))
      .order("desc")
      .take(GUESTBOOK_MAX + 10);
    for (const old of beyond.slice(GUESTBOOK_MAX)) await ctx.db.delete(old._id);
    return null;
  },
});

/** Takes a lantern down from a guestbook: the home's owner or an admin (moderation). */
export const takeDownLantern = mutation({
  args: { lanternId: v.id("homeLanterns") },
  returns: v.null(),
  handler: async (ctx, { lanternId }) => {
    const { workspace, member } = await requireViewer(ctx);
    const lantern = await ctx.db.get(lanternId);
    const home = lantern && (await ctx.db.get(lantern.homeId));
    const mayModerate = home && home.workspaceId === workspace._id && (home.memberId === member._id || member.isAdmin);
    if (!lantern || !mayModerate) throw new ConvexError("You can't take that lantern down.");
    await ctx.db.delete(lantern._id);
    return null;
  },
});
