import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, mutation, type MutationCtx, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { superKudosNoteValidator } from "./schema";
import { requireViewer } from "./lib/access";
import { quarterBucket } from "./lib/buckets";
import {
  plainText,
  SUPER_SUFFIX,
  superKudosCelebration,
  superKudosHowTo,
  superKudosNote,
  superKudosPerMonth,
  superKudosSent,
  superKudosSpotlight,
  superKudosVerdict,
} from "./lib/cosmetics";
import { monthOf } from "./lib/items";
import { escapeMrkdwn } from "./lib/slack";
import { hasSkill } from "./lib/skills";
import { dayKeyFor, parseToday } from "./lib/time";
import { gameShownTo, playerOf, skillsOf } from "./game";

/**
 * Super kudos (#98, #55 §G7 Herald). The rules are pure in `lib/cosmetics.ts`; this is where a
 * kudos carrying the Super kudos emoji is judged (in its give transaction), the receiver's
 * celebration is kept until they've seen it, and the Spotlight capstone posts to the announcement
 * channel. A Super kudos gives the usual amount and earns nothing extra: it never touches XP,
 * coins or the allowance.
 */

type Note = Infer<typeof superKudosNoteValidator>;

/** Super kudos a member used in a workspace month ("YYYY-MM"). Revoked ones don't count. */
export async function superKudosUsed(ctx: QueryCtx, giverId: Id<"members">, month: string): Promise<number> {
  return (await ctx.db.query("superKudos").withIndex("by_giver_month", (q) => q.eq("giverId", giverId).eq("month", month)).take(10)).length;
}

/**
 * The golden leaves on a giver's plant for a teammate (#95's hook): one per Super kudos the giver
 * sent them that wasn't revoked, at most `max`.
 */
export async function goldenLeaves(ctx: QueryCtx, giverId: Id<"members">, receiverId: Id<"members">, max = 100): Promise<number> {
  return (await ctx.db.query("superKudos").withIndex("by_giver_receiver_quarter", (q) => q.eq("giverId", giverId).eq("receiverId", receiverId)).take(max)).length;
}

export type SuperKudosOutcome = {
  /** A Super kudos was given (the kudos row is marked, its `superKudos` row written). */
  given: boolean;
  /** For the giver's reply: "sent", or why it was a normal kudos. Null for a giver who hides the game. */
  giverNote: Note | null;
  /** For the receiver's kudos DM. Null when it wasn't a Super kudos, or they hide the game. */
  celebration: { receiverId: Id<"members">; note: Note } | null;
};

/**
 * A kudos message carrying the Super kudos emoji was given (`rows`: one per person, already
 * written). Called only while the game is on: the emoji is only an emoji otherwise.
 */
export async function onSuperKudos(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  rows: Doc<"kudos">[],
  { noteWords, channelPrivate, now }: { noteWords?: number; channelPrivate?: boolean; now: number },
): Promise<SuperKudosOutcome> {
  const skills = skillsOf(await playerOf(ctx, giver._id));
  const perMonth = superKudosPerMonth(skills);
  const month = monthOf(now, workspace.timezone);
  const quarter = quarterBucket(dayKeyFor(now, workspace.timezone));
  const used = perMonth > 0 ? await superKudosUsed(ctx, giver._id, month) : 0;
  const only = rows.length === 1 ? rows[0] : null;
  const sameReceiverThisQuarter =
    only !== null &&
    (await ctx.db
      .query("superKudos")
      .withIndex("by_giver_receiver_quarter", (q) => q.eq("giverId", giver._id).eq("receiverId", only.receiverId).eq("quarter", quarter))
      .first()) !== null;
  const verdict = superKudosVerdict({ perMonth, usedThisMonth: used, people: rows.length, noteWords, sameReceiverThisQuarter });
  const toGiver = gameShownTo(workspace, giver);
  if (!verdict.ok || !only) {
    const reason = verdict.ok ? "one_person" : verdict.reason;
    const text = superKudosHowTo(reason, `:${workspace.emojiName}-${SUPER_SUFFIX}:`, perMonth);
    return { given: false, giverNote: toGiver ? { kind: "howto", slackText: text, webText: plainText(text) } : null, celebration: null };
  }

  const receiver = (await ctx.db.get(only.receiverId))!;
  const toReceiver = gameShownTo(workspace, receiver);
  // The capstone features it, but never a kudos from a private channel (its text isn't public; the
  // post checks again with Slack and fails closed), nor anyone who hides the game.
  const spotlight =
    hasSkill(skills, "spotlight") &&
    toGiver &&
    toReceiver &&
    (workspace.isDemo || (workspace.announceChannel !== undefined && only.channelId.startsWith("C") && !channelPrivate));
  const note = superKudosNote(only.text);
  const id = await ctx.db.insert("superKudos", {
    workspaceId: workspace._id,
    giverId: giver._id,
    receiverId: receiver._id,
    kudosId: only._id,
    month,
    quarter,
    at: now,
    note,
    ...(spotlight ? { spotlight: true as const } : {}),
    // A receiver who hides the game never gets the celebration, not even when they show it again.
    ...(toReceiver ? {} : { seenAt: now }),
  });
  await ctx.db.patch(only._id, { superKudos: true });
  if (spotlight && !workspace.isDemo) await ctx.scheduler.runAfter(0, internal.slack.postSpotlight, { superKudosId: id });

  const left = perMonth - used - 1;
  const sent = (who: string) => superKudosSent(who, left, perMonth, spotlight ? (workspace.isDemo ? "demo" : "posted") : null);
  return {
    given: true,
    giverNote: toGiver ? { kind: "sent", slackText: sent(`<@${receiver.slackUserId}>`), webText: sent(receiver.name) } : null,
    celebration: toReceiver
      ? {
          receiverId: receiver._id,
          note: {
            kind: "celebration",
            slackText: superKudosCelebration(`<@${giver.slackUserId}>`, escapeMrkdwn(note), "slack"),
            webText: superKudosCelebration(giver.name, note, "web"),
          },
        }
      : null,
  };
}

/** A revoked kudos takes its Super kudos with it: the celebration, the golden leaf and the use. */
export async function onSuperKudosRevoked(ctx: MutationCtx, row: Doc<"kudos">) {
  if (!row.superKudos) return;
  const sk = await ctx.db.query("superKudos").withIndex("by_kudos", (q) => q.eq("kudosId", row._id)).unique();
  if (sk) await ctx.db.delete(sk._id);
}

/** Celebrations are shown for this long after the Super kudos; older unseen ones are let go. */
const CELEBRATION_DAYS = 30;

/**
 * The viewer's Super kudos celebration: the latest one they received in the last 30 days and
 * haven't seen yet. Null when there's none, or they don't see the game. `today`: the viewer's
 * workspace day.
 */
export const celebration = query({
  args: { today: v.string() },
  returns: v.union(v.null(), v.object({ id: v.id("superKudos"), from: v.string(), avatarUrl: v.union(v.string(), v.null()), note: v.string(), at: v.number() })),
  handler: async (ctx, { today }) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const since = Date.parse(`${parseToday(today)}T00:00:00Z`) - CELEBRATION_DAYS * 86_400_000;
    const recent = await ctx.db
      .query("superKudos")
      .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id).gte("at", since))
      .order("desc")
      .take(5);
    const unseen = recent.find((r) => r.seenAt === undefined);
    if (!unseen) return null;
    const giver = await ctx.db.get(unseen.giverId);
    return { id: unseen._id, from: giver?.name ?? "A teammate", avatarUrl: giver?.avatarUrl ?? null, note: unseen.note, at: unseen.at };
  },
});

/** The receiver has seen their celebration. */
export const seen = mutation({
  args: { id: v.id("superKudos") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { member } = await requireViewer(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.receiverId !== member._id) throw new ConvexError("Not found.");
    if (row.seenAt === undefined) await ctx.db.patch(id, { seenAt: Date.now() });
    return null;
  },
});

/** What the Spotlight post needs: the announcement channel and the text. Null: nothing to post. */
export const spotlightPost = internalQuery({
  args: { superKudosId: v.id("superKudos") },
  returns: v.union(v.null(), v.object({ botToken: v.string(), channel: v.string(), from: v.string(), text: v.string() })),
  handler: async (ctx, { superKudosId }) => {
    const sk = await ctx.db.get(superKudosId);
    if (!sk) return null; // revoked meanwhile
    const workspace = await ctx.db.get(sk.workspaceId);
    if (!workspace || workspace.status !== "active" || !workspace.announceChannel) return null;
    const install = await ctx.db.query("slackInstallations").withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id)).unique();
    const giver = await ctx.db.get(sk.giverId);
    const receiver = await ctx.db.get(sk.receiverId);
    const kudos = await ctx.db.get(sk.kudosId);
    if (!install || !giver || !receiver || !kudos) return null;
    // The kill switch, or either of them hiding the game since: nothing goes out.
    if (!gameShownTo(workspace, giver) || !gameShownTo(workspace, receiver)) return null;
    return {
      botToken: install.botToken,
      channel: workspace.announceChannel.id,
      from: kudos.channelId,
      text: superKudosSpotlight(`<@${giver.slackUserId}>`, `<@${receiver.slackUserId}>`, escapeMrkdwn(sk.note)),
    };
  },
});
