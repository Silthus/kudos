import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { DomainEvent } from "./events";

type Subscriber<E extends DomainEvent> = FunctionReference<"mutation" | "action", "internal", { event: E }>;
type Registry = { [T in DomainEvent["type"]]: Array<Subscriber<Extract<DomainEvent, { type: T }>>> };

export const subscribers: Registry = {
  kudosGiven: [
    internal.welcome.welcome.welcomeNewMembers,
    internal.progression.progression.recordEffects,
    internal.feedback.homes.refreshHomesOnKudos,
    internal.leaderboard.totals.countKudosGiven,
    internal.analytics.subscribers.recordKudosGiven,
  ],
  attemptFailed: [internal.analytics.subscribers.recordAttemptFailed],
  memberWelcomed: [internal.analytics.subscribers.recordMemberWelcomed],
  levelReached: [internal.feedback.notify.notifyLevelReached, internal.feedback.publicReplies.celebrateLevel],
};

export async function publish(ctx: MutationCtx, event: DomainEvent) {
  for (const subscriber of subscribers[event.type] as Array<Subscriber<DomainEvent>>) {
    await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
