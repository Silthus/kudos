import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { gameShownTo } from "./game";
import { requireViewer } from "./lib/access";
import { parseToday } from "./lib/time";

/**
 * Life in the world (#134): the neighbours' sprouts. A teammate's bed on the map grows a tiny
 * sprout on a day they gave a thoughtful kudos: a give event today with a qualifying line (the
 * game's own rule: a note of a few words, not a thank-you straight back). Asked for the teammates
 * already in the viewer's ring (`gardens.neighbours`), so the ring isn't worked out twice; each is
 * checked to be a playing teammate in the viewer's workspace. It only ever says "gave thoughtfully
 * today", never to whom or how much.
 */

/** The ring's size (`gardens.neighbours`): no more are asked about. */
const MAX_ASKED = 20;
/** A teammate's game events looked through for today's give, receipts included. */
const EVENTS_READ = 60;

export const sprouts = query({
  args: { today: v.string(), memberIds: v.array(v.id("members")) },
  returns: v.array(v.id("members")),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    if (args.memberIds.length > MAX_ASKED) throw new ConvexError(`Ask about at most ${MAX_ASKED} teammates.`);
    if (!gameShownTo(workspace, member)) return [];
    const today = parseToday(args.today);
    const out = [];
    for (const id of new Set(args.memberIds)) {
      const teammate = await ctx.db.get(id);
      if (!teammate || teammate.workspaceId !== workspace._id || teammate.isBot || teammate.deactivated || !gameShownTo(workspace, teammate)) continue;
      const events = await ctx.db
        .query("gameEvents")
        .withIndex("by_member_day", (q) => q.eq("memberId", id).eq("dayKey", today))
        .take(EVENTS_READ);
      if (events.some((e) => e.kind === "give" && e.lines?.some((l) => l.qualifying))) out.push(id);
    }
    return out;
  },
});
