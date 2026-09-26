import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { gameShownTo, playerOf } from "./game";
import { DM_CATEGORIES, type Gain, gainsText, mergeGains, visibleTo } from "./lib/gains";
import { workspaceNow } from "./lib/time";

/**
 * The one pipeline for game DMs (#55 §G13): whatever a member discovers or gains is `add`ed while
 * an event runs (a kudos given, a skill picked, a spree tier reached), and `flush` writes it once at
 * the end: **one DM per member per event, never a stream.** If the event already DMs the member (the
 * receiver's kudos DM, a quest-complete DM), the gains ride along in it; otherwise they get a DM of
 * their own. Members who hide the game, and workspaces with the game off, get nothing; what they
 * earned still counts (§G1). Rendering is pure in `lib/gains.ts`.
 */
export class Gains {
  private pending = new Map<Id<"members">, Gain[]>();
  private flushed = false;

  /** `now`: when the event happened on the workspace's clock, the time its DMs are told at (#171). */
  constructor(
    private ctx: MutationCtx,
    private workspace: Doc<"workspaces">,
    private now: number = workspaceNow(workspace),
  ) {}

  add(memberId: Id<"members">, gain: Gain) {
    // A gain added after the event's DMs were written would silently never be told.
    if (this.flushed) throw new Error("These gains were already flushed: add every gain before the event's flush.");
    this.pending.set(memberId, mergeGains(this.pending.get(memberId) ?? [], gain));
  }

  /**
   * Writes what the event gained. `eventDms` are the notifications the event already queued: a
   * member's gains join their DM among them. Returns the new DMs, to deliver with the event's.
   */
  async flush(eventDms: Id<"notifications">[] = []): Promise<Id<"notifications">[]> {
    const { ctx, workspace, now } = this;
    const written: Id<"notifications">[] = [];
    // DMs that will actually go out (the demo sends nothing, but its playground shows them all).
    const queued = [];
    for (const id of eventDms) {
      const n = await ctx.db.get(id);
      if (n && DM_CATEGORIES.has(n.category) && (n.delivery === "pending" || workspace.isDemo)) queued.push(n);
    }
    this.flushed = true;
    for (const [memberId, pending] of this.pending) {
      const member = await ctx.db.get(memberId);
      if (!member || !gameShownTo(workspace, member)) continue;
      // The game starts with a member's first kudos: nothing is told before (§G1).
      const player = await playerOf(ctx, memberId);
      if (!player) continue;
      const gains = pending.map((g) => visibleTo(g, player.level));
      const host = queued.find((n) => n.memberId === memberId);
      if (host) {
        await ctx.db.patch(host._id, { gains: gains.reduce(mergeGains, host.gains ?? []) });
        continue;
      }
      written.push(
        await ctx.db.insert("notifications", {
          workspaceId: workspace._id,
          memberId,
          category: "gains",
          templateKey: "gains",
          rarity: "common",
          isNewDiscovery: false,
          slackText: gainsText(gains, "slack"),
          webText: gainsText(gains, "web"),
          delivery: workspace.isDemo ? "skipped" : "pending",
          at: now,
          gains,
        }),
      );
    }
    this.pending.clear();
    return written;
  }
}

/**
 * A gain outside a Slack event (a skill picked or an item bought on the web): writes its DM and
 * sends it right after this transaction. Nothing for members who don't see the game. Never call it
 * while an event collects its own `Gains`: add to those instead, or the member gets two DMs.
 */
export async function sendGains(ctx: MutationCtx, workspace: Doc<"workspaces">, memberId: Id<"members">, gains: Gain[]) {
  const collector = new Gains(ctx, workspace);
  for (const gain of gains) collector.add(memberId, gain);
  const ids = await collector.flush();
  if (ids.length > 0 && !workspace.isDemo) {
    await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids });
  }
  return ids;
}
