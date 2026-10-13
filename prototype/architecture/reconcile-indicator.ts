// PROTOTYPE (throwaway, never merged): the Slack adapter delivers an indicator as desired state,
// not as a queue of add/remove operations, so late or retried deliveries cannot leave a stale reaction.

import type { Indicator } from "./contracts.ts";

export type ReactionOp = { op: "add" | "remove"; emoji: string };

export function reconcileIndicator(desired: Indicator, ownIndicatorEmoji: Set<string>): ReactionOp[] {
  const removals = [...ownIndicatorEmoji]
    .filter((emoji) => emoji !== desired?.emoji)
    .map((emoji): ReactionOp => ({ op: "remove", emoji }));
  return desired ? [...removals, { op: "add", emoji: desired.emoji }] : removals;
}
