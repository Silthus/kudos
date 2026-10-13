import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import type { KudosGivenEvent } from "../convex/bus/events";
import type { MemberId } from "../convex/workspace/directory";

export function kudosGivenEvent(giver: MemberId, recipient: MemberId, overrides: Partial<KudosGivenEvent> = {}): KudosGivenEvent {
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver,
    awards: [{ award: awardId(recipient), giver, recipient, kudos: 1 }],
    via: "message",
    kudosEmoji: "taco",
    annotations: {},
    allowance: { dailyOpening: 3, dailyLeft: 2 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day: "2026-10-13",
    at: Date.parse("2026-10-13T10:00:00Z"),
    ...overrides,
  };
}

export function awardId(recipient: MemberId) {
  return `award-${recipient}` as Id<"awards">;
}

export async function kudosGivenEventWithAward(ctx: MutationCtx, giver: MemberId, recipient: MemberId, overrides: Partial<KudosGivenEvent> = {}): Promise<KudosGivenEvent> {
  const event = kudosGivenEvent(giver, recipient, overrides);
  const { workspace, conversation, message } = event.message;
  const award = await ctx.db.insert("awards", { workspace, conversation, message, giver, recipient, kudos: 1, day: event.day, at: event.at });
  return { ...event, awards: [{ award, giver, recipient, kudos: 1 }] };
}
