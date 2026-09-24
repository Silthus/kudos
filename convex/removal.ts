import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { revokeKudosRow } from "./engine";
import { rememberPlant } from "./gardens";
import { counts } from "./sprees";
import { Rollups } from "./lib/rollups";
import { isOpen } from "./lib/store";

/**
 * Removes a member from a workspace for good (an operator tool, not a product feature):
 *
 *   npx convex run --prod removal:removeMember '{"slackTeamId":"T…","slackUserId":"U…"}'
 *
 * Everything they gave or received is revoked through the engine, so totals, memberDays, maxed
 * days, quests and the rollups move exactly as they would for an admin revoke. Then every row
 * that is theirs alone is deleted, the member last, and `rollups.rebuildWorkspace` recomputes the
 * workspace so what the engine can't express as a delta (first discoveries) is exact too.
 *
 * The work runs in chained steps, each one phase over a bounded batch that also stops once it has
 * used half of the transaction's budget, so a member with years of history never hits the limits. Before deleting the member, the last step checks every
 * phase again and starts over if something came back (a give that raced the removal). Running it
 * twice is harmless: a second run finds the member gone, or clears whatever the first left.
 */

type Workspace = Doc<"workspaces">;
type Member = Doc<"members">;

type Phase = {
  name: string;
  /** Rows per step: revokes touch dozens of rollup rows and re-check quests, deletes are cheap. */
  batch: number;
  /** Up to `n` of the member's rows this phase still has to clear. Clearing a row removes it from here. */
  rows: (ctx: MutationCtx, member: Member, n: number) => Promise<Doc<TableNames>[]>;
  clear: (ctx: MutationCtx, workspace: Workspace, row: Doc<TableNames>) => Promise<void>;
};

const remove = async (ctx: MutationCtx, _workspace: Workspace, row: Doc<TableNames>) => ctx.db.delete(row._id);

/**
 * In order. Quest completions go first, so revoking the member's own gives doesn't re-evaluate
 * their board; revokes come before the rows they would otherwise recreate or touch.
 */
const PHASES: Phase[] = [
  // Plants grown for them become memories (§G15) before the revokes below take their waterings.
  {
    name: "plantsFor",
    batch: 50,
    rows: (ctx, m, n) => ctx.db.query("plants").withIndex("by_for_memory", (q) => q.eq("forId", m._id).eq("memoryAt", undefined)).take(n),
    clear: (ctx, workspace, row) => rememberPlant(ctx, workspace, row as Doc<"plants">, "left"),
  },
  {
    name: "plantsOwned",
    batch: 200,
    rows: (ctx, m, n) => ctx.db.query("plants").withIndex("by_owner_memory", (q) => q.eq("ownerId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "questCompletions",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("questCompletions").withIndex("by_member_week", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "dailyQuestCompletions",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("dailyQuestCompletions").withIndex("by_member_day", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "kudosGiven",
    batch: 10,
    rows: (ctx, m, n) => ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", m._id)).take(n),
    clear: (ctx, workspace, row) => revokeKudosRow(ctx, workspace, row as Doc<"kudos">),
  },
  {
    name: "kudosReceived",
    batch: 10,
    rows: (ctx, m, n) => ctx.db.query("kudos").withIndex("by_receiver_at", (q) => q.eq("receiverId", m._id)).take(n),
    clear: (ctx, workspace, row) => revokeKudosRow(ctx, workspace, row as Doc<"kudos">),
  },
  // What revoking can't reach: rows from before rollups existed, or left behind by past bugs.
  {
    name: "memberDays",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("memberDays").withIndex("by_member_day", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "memberStats",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("memberStats").withIndex("by_member_bucket", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "pairStatsGiven",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("pairStats").withIndex("by_giver_bucket_receiver", (q) => q.eq("giverId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "pairStatsReceived",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("pairStats").withIndex("by_receiver_bucket_amount", (q) => q.eq("receiverId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "discoveries",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("discoveries").withIndex("by_member_template", (q) => q.eq("memberId", m._id)).take(n),
    // Each one leaves the message's finders (and, with their last one, the collectors) right away.
    clear: async (ctx, workspace, row) => {
      const discovery = row as Doc<"discoveries">;
      await ctx.db.delete(discovery._id);
      const another = await ctx.db
        .query("discoveries")
        .withIndex("by_member_template", (q) => q.eq("memberId", discovery.memberId))
        .first();
      const rollups = new Rollups(ctx, workspace);
      rollups.messageLost(discovery.templateKey, another === null);
      await rollups.flush();
    },
  },
  {
    name: "kudosAttempts",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("kudosAttempts").withIndex("by_giver", (q) => q.eq("giverId", m._id)).take(n),
    clear: remove,
  },
  // Kudos sprees (#94). Revoking their kudos above already cancelled the sprees they started or
  // received, and revoked the pooled kudos they gave or got. Their joins leave the sprees they
  // joined (a waiting one stops counting), and sprees they started go with every join of them.
  {
    name: "spreeJoins",
    batch: 200,
    rows: (ctx, m, n) => ctx.db.query("spreeJoins").withIndex("by_member_day", (q) => q.eq("memberId", m._id)).take(n),
    clear: async (ctx, _workspace, row) => {
      const join = row as Doc<"spreeJoins">;
      const spree = await ctx.db.get(join.spreeId);
      // `joiners` counts every join that holds one (waiting or paid): they're no longer a joiner.
      if (spree && counts(join)) await ctx.db.patch(spree._id, { joiners: Math.max(0, spree.joiners - 1) });
      await ctx.db.delete(join._id);
    },
  },
  {
    name: "sprees",
    batch: 5,
    rows: (ctx, m, n) => ctx.db.query("sprees").withIndex("by_giver", (q) => q.eq("giverId", m._id)).take(n),
    clear: async (ctx, _workspace, row) => {
      for await (const join of ctx.db.query("spreeJoins").withIndex("by_spree_member", (q) => q.eq("spreeId", row._id as Id<"sprees">))) {
        await ctx.db.delete(join._id);
      }
      await ctx.db.delete(row._id);
    },
  },
  {
    name: "notifications",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  // The revokes above took back every XP event their kudos earned; this catches any left over.
  {
    name: "gameEvents",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "skillChanges",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("skillChanges").withIndex("by_member_at", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "players",
    batch: 10,
    rows: (ctx, m, n) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "itemPurchases",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("itemPurchases").withIndex("by_member_item_month", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  {
    name: "balanceAdjustments",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("balanceAdjustments").withIndex("by_member_at", (q) => q.eq("memberId", m._id)).take(n),
    clear: remove,
  },
  // Their requests, as if withdrawn: an open one gives back the stock it held (their refund goes
  // with them), and the reward's counters drop the request. Admins' review DMs are rewritten
  // without buttons; a stale click answers "Request not found." only to the clicker.
  {
    name: "redemptions",
    batch: 50,
    rows: (ctx, m, n) => ctx.db.query("redemptions").withIndex("by_member_requestedAt", (q) => q.eq("memberId", m._id)).take(n),
    clear: async (ctx, workspace, row) => {
      const redemption = row as Doc<"redemptions">;
      const reward = await ctx.db.get(redemption.rewardId);
      if (reward) {
        const open = isOpen(redemption.status);
        await ctx.db.patch(reward._id, {
          ...(open ? { openCount: Math.max(0, (reward.openCount ?? 0) - 1) } : {}),
          ...(redemption.status === "fulfilled" ? { fulfilledCount: Math.max(0, (reward.fulfilledCount ?? 0) - 1) } : {}),
          ...(open && redemption.stockHeld && reward.stock !== undefined ? { stock: reward.stock + 1 } : {}),
        });
      }
      if (!workspace.isDemo && redemption.adminMessages?.length) {
        await ctx.scheduler.runAfter(0, internal.slack.retireAdminMessages, {
          workspaceId: workspace._id,
          reward: { name: redemption.rewardName, emoji: redemption.rewardEmoji },
          messages: redemption.adminMessages.map(({ channel, ts }) => ({ channel, ts })),
        });
      }
      await ctx.db.delete(redemption._id);
    },
  },
  // Adjustments and decisions they made for others stay: those ledgers show "a former admin".
  // Only the four-eyes link to them goes, since nobody can be blocked by someone who's gone.
  {
    name: "adminRemovedBy",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("members").withIndex("by_adminRemovedBy", (q) => q.eq("adminRemovedBy", m._id)).take(n),
    clear: (ctx, _workspace, row) => ctx.db.patch(row._id as Id<"members">, { adminRemovedBy: undefined }),
  },
  // Lanterns they hung on other people's plants go out (#97).
  {
    name: "lanterns",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("plants").withIndex("by_lantern_by", (q) => q.eq("lanternBy", m._id)).take(n),
    clear: (ctx, _workspace, row) => ctx.db.patch(row._id as Id<"plants">, { lantern: undefined, lanternBy: undefined }),
  },
  // Bonus days they scheduled and boosters they bought stay: everyone's kudos that day earned
  // double, and a rebuild must replay that. Only their name (and the purchase row, gone above) goes.
  {
    name: "boosts",
    batch: 500,
    rows: (ctx, m, n) => ctx.db.query("boosts").withIndex("by_by", (q) => q.eq("by", m._id)).take(n),
    clear: (ctx, _workspace, row) => ctx.db.patch(row._id as Id<"boosts">, { by: undefined, purchaseId: undefined }),
  },
  // Their sign-in, unless the same user is still a member of another workspace. Every token
  // refresh leaves a row behind, so a long-lived session's refresh tokens get a phase of their own.
  {
    name: "authRefreshTokens",
    batch: 500,
    rows: async (ctx, m, n) => {
      const userId = await ownUser(ctx, m);
      if (!userId) return [];
      const rows: Doc<TableNames>[] = [];
      for await (const session of ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId))) {
        const tokens = ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", session._id));
        rows.push(...(await tokens.take(n - rows.length)));
        if (rows.length === n) break;
      }
      return rows;
    },
    clear: remove,
  },
  {
    name: "authSessions",
    batch: 500,
    rows: async (ctx, m, n) => {
      const userId = await ownUser(ctx, m);
      return userId ? await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).take(n) : [];
    },
    clear: remove,
  },
  {
    name: "authAccounts",
    batch: 50,
    rows: async (ctx, m, n) => {
      const userId = await ownUser(ctx, m);
      return userId ? await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).take(n) : [];
    },
    clear: async (ctx, _workspace, row) => {
      const codes = ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", row._id as Id<"authAccounts">));
      for await (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(row._id);
    },
  },
];

/** The member's signed-in user, if this is their only membership (else it isn't theirs to delete). */
async function ownUser(ctx: MutationCtx, member: Member) {
  const userId = member.userId;
  if (!userId) return null;
  const memberships = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("userId", userId)).take(2);
  return memberships.some((m) => m._id !== member._id) ? null : userId;
}

/**
 * Whether the step has used half of any read or write budget. A revoke re-reads the giver's days
 * when it empties one (their streaks), so its cost grows with their history; stopping at half
 * leaves room for the next one to finish.
 */
async function halfSpent(ctx: MutationCtx) {
  const m = await ctx.meta.getTransactionMetrics();
  return [m.documentsRead, m.bytesRead, m.documentsWritten, m.bytesWritten, m.databaseQueries].some((x) => x.used >= x.remaining);
}

const countsValidator = v.record(v.string(), v.number());

/**
 * Start removing one member. Refuses bots, the shared demo, and the workspace's last admin unless
 * `force` (nobody could run its settings or store afterwards); a member already gone is a no-op.
 */
export const removeMember = internalMutation({
  args: { slackTeamId: v.string(), slackUserId: v.string(), force: v.optional(v.boolean()) },
  returns: v.object({ status: v.union(v.literal("started"), v.literal("not_found")) }),
  handler: async (ctx, { slackTeamId, slackUserId, force }) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", slackTeamId))
      .unique();
    if (!workspace) throw new ConvexError(`No workspace for Slack team ${slackTeamId}.`);
    // The demo is reseeded by its reset, around people it expects to be there.
    if (workspace.isDemo) throw new ConvexError("Members of the shared demo workspace can't be removed; reset the demo instead.");
    const member = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id).eq("slackUserId", slackUserId))
      .unique();
    if (!member) {
      console.log(`removeMember: ${slackUserId} is not a member of ${workspace.name} (${slackTeamId}); nothing to do.`);
      return { status: "not_found" as const };
    }
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    if (member.isBot || install?.botUserId === slackUserId) throw new ConvexError(`${slackUserId} is a bot; bots aren't removed.`);
    const user = member.userId ? await ctx.db.get(member.userId) : null;
    if (user?.isDemo) throw new ConvexError(`${slackUserId} is signed in as the shared demo user; it can't be removed.`);
    if (member.isAdmin && !force) {
      const admins = ctx.db.query("members").withIndex("by_workspace_isAdmin", (q) => q.eq("workspaceId", workspace._id).eq("isAdmin", true));
      let another = false;
      for await (const admin of admins) {
        if (admin._id !== member._id && !admin.deactivated && !admin.isBot) {
          another = true;
          break;
        }
      }
      if (!another) {
        throw new ConvexError(
          `${member.name} (${slackUserId}) is the only admin of ${workspace.name}; make someone else an admin first, or pass "force": true.`,
        );
      }
    }
    // Nobody can give to or as them from here on (the engine ignores deactivated members).
    await ctx.db.patch(member._id, { deactivated: true });
    await ctx.scheduler.runAfter(0, internal.removal.removeStep, { memberId: member._id, phase: 0, counts: {} });
    console.log(`removeMember: removing ${member.name} (${slackUserId}) from ${workspace.name} (${slackTeamId}).`);
    return { status: "started" as const };
  },
});

export const removeStep = internalMutation({
  args: { memberId: v.id("members"), phase: v.number(), counts: countsValidator },
  returns: v.null(),
  handler: async (ctx, { memberId, phase, counts }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return null; // another run finished first
    const workspace = (await ctx.db.get(member.workspaceId))!;
    const tally: Record<string, number> = { ...counts, steps: (counts.steps ?? 0) + 1 };
    const next = (phase: number) => ctx.scheduler.runAfter(0, internal.removal.removeStep, { memberId, phase, counts: tally });

    if (phase < PHASES.length) {
      const { name, batch, rows, clear } = PHASES[phase];
      const found = await rows(ctx, member, batch);
      let cleared = 0;
      while (cleared < found.length) {
        await clear(ctx, workspace, found[cleared++]);
        if (await halfSpent(ctx)) break;
      }
      tally[name] = (tally[name] ?? 0) + cleared;
      await next(found.length === batch || cleared < found.length ? phase : phase + 1);
      return null;
    }

    // Last step: go back to the first phase that has rows again, else delete the member.
    for (let i = 0; i < PHASES.length; i++) {
      if ((await PHASES[i].rows(ctx, member, 1)).length > 0) {
        await next(i);
        return null;
      }
    }
    const userId = await ownUser(ctx, member);
    if (userId) await ctx.db.delete(userId);
    await ctx.db.delete(member._id);
    await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId: workspace._id });
    console.log(
      `removeMember: removed ${member.name} (${member.slackUserId}) from ${workspace.name}; rebuilding its rollups. ${JSON.stringify(tally)}`,
    );
    return null;
  },
});
