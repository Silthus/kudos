import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { gameOn, gameShownTo, playerOf, skillsOf } from "./game";
import { requireViewer } from "./lib/access";
import { ALL_BUCKET } from "./lib/buckets";
import { canSpend, coinBalance, WALLET_LEVEL } from "./lib/coins";
import { canTake, isSkillId, pointsOf, resetCost, SCOUT, SKILLS, takeBlockText } from "./lib/skills";
import { addDays, parseToday } from "./lib/time";

/**
 * The skill tree (#55 §G7): taking skills with skill points and the paid reset. The rules are pure
 * in `lib/skills.ts`; the allocation lives on the player (`players.skills`), and every change is
 * also a `skillChanges` row, so a rebuild can replay the Scout skills as they stood at each kudos.
 *
 * Effects are looked up where they apply: `skillsOf(player)` (game.ts, next to the XP ledger) with
 * `rankOf`/`hasSkill` (lib/skills.ts), or a branch lookup like `scoutEffects`, which the give path
 * and the rebuild use (the rebuild via `skillTimeline`).
 */

async function requirePlayer(ctx: QueryCtx) {
  const { workspace, member } = await requireViewer(ctx);
  if (!gameOn(workspace)) throw new ConvexError("The game is off in this workspace.");
  const player = await playerOf(ctx, member._id);
  if (!player) throw new ConvexError("Your skill tree starts with your first kudos.");
  return { workspace, member, player };
}

/**
 * Resets a player's tree: every point comes back, and the reset's Hog coins are spent in the same
 * transaction (`members.coinsSpent`). Each reset costs more (`resetCost`). `expectedCost` is the
 * price the member agreed to; if it changed in the meantime nothing happens. The Store's reset item
 * (#91) calls this too.
 */
export async function resetSkills(ctx: MutationCtx, member: Doc<"members">, player: Doc<"players">, expectedCost: number) {
  const cost = resetCost(player.skillResets ?? 0);
  if (pointsOf(skillsOf(player), player.level).spent === 0) throw new ConvexError("Your tree has no skills to reset.");
  if (player.level < WALLET_LEVEL) throw new ConvexError("A reset costs Hog coins; your wallet opens at level 3.");
  if (expectedCost !== cost) throw new ConvexError(`The reset price is now ${cost} Hog coins. Check it and try again.`);
  const { balance } = coinBalance(player, member);
  if (!canSpend(balance, cost)) throw new ConvexError(`A reset costs ${cost} Hog coins; you have ${balance}.`);
  const at = Date.now();
  await ctx.db.patch(member._id, { coinsSpent: (member.coinsSpent ?? 0) + cost });
  await ctx.db.patch(player._id, { skills: undefined, skillResets: (player.skillResets ?? 0) + 1 });
  await ctx.db.insert("skillChanges", { workspaceId: member.workspaceId, memberId: member._id, at, kind: "reset", coins: cost });
  return { cost };
}

/**
 * The viewer's tree: their level (one point per level-up), the rank of each skill taken, resets so
 * far, the next reset's price and, once the wallet is open, their Hog coins. Null when there's no
 * tree to show: the game is off or hidden, or they aren't a player yet.
 */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      level: v.number(),
      skills: v.record(v.string(), v.number()),
      resets: v.number(),
      resetCost: v.number(),
      balance: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const player = await playerOf(ctx, member._id);
    if (!player) return null;
    return {
      level: player.level,
      skills: player.skills ?? {},
      resets: player.skillResets ?? 0,
      resetCost: resetCost(player.skillResets ?? 0),
      balance: player.level >= WALLET_LEVEL ? coinBalance(player, member).balance : null,
    };
  },
});

/** Takes one rank of a skill with the viewer's skill points. */
export const take = mutation({
  args: { skill: v.string() },
  returns: v.null(),
  handler: async (ctx, { skill }) => {
    const { member, player } = await requirePlayer(ctx);
    if (!isSkillId(skill)) throw new ConvexError("There's no such skill.");
    const skills = skillsOf(player);
    const check = canTake(skills, player.level, skill);
    if (!check.ok) throw new ConvexError(takeBlockText(SKILLS[skill], check.reason, pointsOf(skills, player.level).available));
    await ctx.db.patch(player._id, { skills: { ...player.skills, [skill]: (skills[skill] ?? 0) + 1 } });
    await ctx.db.insert("skillChanges", { workspaceId: member.workspaceId, memberId: member._id, at: Date.now(), kind: "take", skill });
    return null;
  },
});

/** Resets the viewer's tree for Hog coins, at the price they were shown (`cost`). */
export const reset = mutation({
  args: { cost: v.number() },
  returns: v.object({ cost: v.number() }),
  handler: async (ctx, { cost }) => {
    const { member, player } = await requirePlayer(ctx);
    return await resetSkills(ctx, member, player, cost);
  },
});

const hintValidator = v.object({
  memberId: v.id("members"),
  name: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  /** The day they were last thanked by the viewer; null in the never-thanked list. */
  lastDay: v.union(v.string(), v.null()),
});

/** Teammates the viewer's Scout skills point at, most thanked first. */
const QUIET_LIMIT = 5;
const NEVER_LIMIT = 3;

/**
 * Lookout (Scout): teammates the viewer has thanked before but not in 30 days or more, the ones
 * they thanked most first; with Wide net also a few they have never thanked, the most recently
 * active givers first. Private: it only reads the viewer's own giving. Null without Lookout.
 * `today` is the viewer's workspace-local day (queries don't read the clock).
 */
export const hints = query({
  args: { today: v.string() },
  returns: v.union(v.null(), v.object({ quiet: v.array(hintValidator), never: v.union(v.null(), v.array(hintValidator)) })),
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const skills = skillsOf(await playerOf(ctx, member._id));
    if (!skills.lookout) return null;

    const pairs = await ctx.db
      .query("pairStats")
      .withIndex("by_giver_bucket_receiver", (q) => q.eq("giverId", member._id).eq("bucket", ALL_BUCKET))
      .take(1000);
    const cutoff = addDays(today, -Math.round(SCOUT.quietAfterMs / (24 * 3_600_000)));
    const quiet = [];
    for (const pair of pairs.sort((a, b) => b.amount - a.amount)) {
      if (quiet.length >= QUIET_LIMIT) break;
      if (pair.receiverId === member._id || pair.amount <= 0) continue;
      const last = await ctx.db
        .query("kudos")
        .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", pair.receiverId))
        .order("desc")
        .first();
      if (!last || last.dayKey > cutoff) continue;
      const teammate = await ctx.db.get(pair.receiverId);
      if (!teammate || teammate.deactivated || teammate.isBot) continue;
      quiet.push({ memberId: teammate._id, name: teammate.name, avatarUrl: teammate.avatarUrl ?? null, lastDay: last.dayKey });
    }

    let never = null;
    if (skills.wide_net) {
      const thanked = new Set<string>(pairs.map((p) => p.receiverId));
      const members = await ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
        .take(1000);
      never = members
        .filter((m) => m._id !== member._id && !m.isBot && !m.deactivated && !thanked.has(m._id))
        .sort((a, b) => (b.lastGivenAt ?? 0) - (a.lastGivenAt ?? 0) || a.name.localeCompare(b.name))
        .slice(0, NEVER_LIMIT)
        .map((m) => ({ memberId: m._id, name: m.name, avatarUrl: m.avatarUrl ?? null, lastDay: null }));
    }
    return { quiet, never };
  },
});
