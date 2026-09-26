import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { addXp, gameShownTo, playerOf } from "./game";
import { requireViewer } from "./lib/access";
import { WALLET_LEVEL } from "./lib/coins";
import { dayKeyFor, workspaceNow } from "./lib/time";
import { TUTORIAL_COINS, TUTORIAL_STEPS, tutorialStep, type TutorialStepId } from "./lib/tutorial";

/**
 * The tutorial (#159, design plan #152 S4): the elder hog's chain of ten first steps, the rules in
 * lib/tutorial.ts. A member's progress is `members.tutorial` (on the member: the chain starts before
 * the first kudos makes them a player): when each step was done, in order, and how many have paid.
 *
 * Steps are detected from what the member did, read when they come to it, never written by the
 * systems they're about: the first thoughtful kudos (a give event with a qualifying line), the first
 * claim at the stone (a `claim` event `by: "player"`), a plant, a skill taken, a trade at the stall (a
 * `sale` event or an item bought), and a later system's own event kind for steps 8 to 10: `expedition`,
 * `home`, and `crew` or `party`. The two steps done only in the world, arriving at the elder hog and
 * looking round the Places list, the client reports (`advance` with `did`); a member who has already
 * done the steps after one of them is past it too, so nobody who played before the chain is held there.
 *
 * `state` says whether `advance` has something to do; the client then calls it, and it completes
 * every step met in order (a step done early completes the moment it's reached) and pays each 5 Hog
 * coins once, as a `tutorial` event. A step completed before the member is a player pays once they are
 * one. Completed steps stay completed, whatever is revoked later. Only while the game is shown to
 * them; a game rebuild keeps both the chain and its events.
 */

type Tutorial = NonNullable<Doc<"members">["tutorial"]>;

const NOT_STARTED: Tutorial = { completedAt: [], paid: 0 };

/** The chain as a demo member who has done it all has it (the shared demo's Alex, #152 S10). */
export function finishedTutorial(at: number): Tutorial {
  return { completedAt: TUTORIAL_STEPS.map(() => at), paid: TUTORIAL_STEPS.length };
}

/** Has the member an event of `kind` (that `where` accepts)? */
async function hasEvent(ctx: QueryCtx, memberId: Id<"members">, kind: Doc<"gameEvents">["kind"], where: (e: Doc<"gameEvents">) => boolean = () => true) {
  // Bounded: a member reaches each step early in their game, with only a few such events behind them.
  const events = await ctx.db
    .query("gameEvents")
    .withIndex("by_member_kind", (q) => q.eq("memberId", memberId).eq("kind", kind))
    .take(200);
  return events.some(where);
}

/**
 * Has the member done what step `id` asks? A step only the world sees counts once the member has done
 * what comes after it: arriving once they've given a thoughtful kudos, looking around once they've
 * grown, learnt or traded something.
 */
async function done(ctx: QueryCtx, memberId: Id<"members">, id: TutorialStepId): Promise<boolean> {
  switch (id) {
    case "arrive":
      return await done(ctx, memberId, "thanks");
    case "look":
      return (await done(ctx, memberId, "grow")) || (await done(ctx, memberId, "learn")) || (await done(ctx, memberId, "trade"));
    case "thanks":
      return await hasEvent(ctx, memberId, "give", (e) => (e.lines ?? []).some((l) => l.qualifying));
    case "feed":
      return await hasEvent(ctx, memberId, "claim", (e) => e.by === "player");
    case "grow":
      return (await ctx.db.query("plants").withIndex("by_owner_memory", (q) => q.eq("ownerId", memberId)).first()) !== null;
    case "learn":
      return (await ctx.db.query("skillChanges").withIndex("by_member_at", (q) => q.eq("memberId", memberId)).take(50)).some((c) => c.kind === "take");
    case "trade":
      return (await hasEvent(ctx, memberId, "sale")) || (await ctx.db.query("itemPurchases").withIndex("by_member_item_month", (q) => q.eq("memberId", memberId)).first()) !== null;
    case "explore":
      return await hasEvent(ctx, memberId, "expedition");
    case "settle":
      return await hasEvent(ctx, memberId, "home");
    case "together":
      return (await hasEvent(ctx, memberId, "crew")) || (await hasEvent(ctx, memberId, "party"));
  }
}

export const state = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      /** The step on, 1 to 10; 11 once the chain is done. */
      step: v.number(),
      /** `advance` has something to do: the step on is done already, or coins are owed to a new player. */
      due: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const { completedAt, paid } = member.tutorial ?? NOT_STARTED;
    const next = tutorialStep(completedAt.length);
    const met = next !== null && (await done(ctx, member._id, next.id));
    const owed = paid < completedAt.length && (await playerOf(ctx, member._id)) !== null;
    return { step: completedAt.length + 1, due: met || owed };
  },
});

export const advance = mutation({
  args: { did: v.optional(v.union(v.literal("arrive"), v.literal("look"))) },
  returns: v.object({
    // What completed, in order; `coins` only where they were paid and the wallet is open (level 3).
    completed: v.array(v.object({ step: v.number(), coins: v.union(v.number(), v.null()) })),
  }),
  handler: async (ctx, { did }) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return { completed: [] };
    const now = workspaceNow(workspace);
    const tutorial = member.tutorial ?? NOT_STARTED;
    const completedAt = [...tutorial.completedAt];
    for (let next = tutorialStep(completedAt.length); next; next = tutorialStep(completedAt.length)) {
      if (!(next.id === did || (await done(ctx, member._id, next.id)))) break;
      completedAt.push(now);
    }
    const paying = await pay(ctx, workspace, member._id, tutorial.paid, completedAt.length, now);
    if (completedAt.length === tutorial.completedAt.length && paying.paid === tutorial.paid) return { completed: [] };
    await ctx.db.patch(member._id, { tutorial: { completedAt, paid: paying.paid } });
    return {
      completed: completedAt.slice(tutorial.completedAt.length).map((_, i) => {
        const step = tutorial.completedAt.length + i + 1;
        return { step, coins: paying.shown && step <= paying.paid ? TUTORIAL_COINS : null };
      }),
    };
  },
});

/**
 * Pays steps `from + 1` to `to` their coins, one `tutorial` event each, if the member is a player;
 * otherwise they wait for the first kudos. Returns how many are paid now and whether the wallet shows it.
 */
async function pay(ctx: MutationCtx, workspace: Doc<"workspaces">, memberId: Id<"members">, from: number, to: number, now: number) {
  const player = await playerOf(ctx, memberId);
  if (!player || to <= from) return { paid: from, shown: false };
  const dayKey = dayKeyFor(now, workspace.timezone);
  for (let step = from + 1; step <= to; step++) {
    await ctx.db.insert("gameEvents", { workspaceId: workspace._id, memberId, kind: "tutorial", batchId: `tutorial:${memberId}:${step}`, dayKey, at: now, xp: 0, coins: TUTORIAL_COINS });
  }
  await addXp(ctx, player, 0, TUTORIAL_COINS * (to - from), undefined, "tutorialCoins");
  return { paid: to, shown: player.level >= WALLET_LEVEL };
}
