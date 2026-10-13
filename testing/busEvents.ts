import type { KudosGivenEvent } from "../convex/bus/events";
import type { MemberId } from "../convex/workspace/directory";

export function kudosGivenEvent(giver: MemberId, recipient: MemberId, overrides: Partial<KudosGivenEvent> = {}): KudosGivenEvent {
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver,
    awards: [{ giver, recipient, kudos: 1 }],
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
