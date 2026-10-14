import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { journeyStepOpenedBy } from "../quests/step";
import type { DomainEvent } from "./events";

type Subscriber<E extends DomainEvent> = FunctionReference<"mutation" | "action", "internal", { event: E }>;
type Subscription<E extends DomainEvent> = Subscriber<E> | { subscriber: Subscriber<E>; only: (event: E) => boolean };
type Registry = { [T in DomainEvent["type"]]: Array<Subscription<Extract<DomainEvent, { type: T }>>> };

export const subscribers: Registry = {
  kudosGiven: [
    internal.welcome.welcome.welcomeNewMembers,
    internal.progression.progression.recordEffects,
    internal.quests.journey.followJourney,
    internal.quests.weekly.advanceWeeklyQuests,
    internal.leaderboard.totals.countKudosGiven,
    internal.analytics.subscribers.recordKudosGiven,
  ],
  attemptFailed: [internal.analytics.subscribers.recordAttemptFailed],
  memberWelcomed: [internal.analytics.subscribers.recordMemberWelcomed],
  levelReached: [internal.unlocks.unlocks.makeReady, internal.feedback.publicReplies.celebrateLevel],
  xpRecorded: [internal.feedback.homes.refreshHomeOnXp],
  unlockReady: [],
  unlockOpened: [
    { subscriber: internal.quests.weekly.drawWeeklyQuests, only: ({ feature }) => feature === "quests" },
    { subscriber: internal.quests.journey.activateJourney, only: ({ feature, byLaunch }) => byLaunch !== true && journeyStepOpenedBy(feature) !== null },
  ],
  questFinished: [{ subscriber: internal.quests.journey.finishFirstQuest, only: ({ quest }) => quest.kind === "weekly" }],
  questOpened: [],
  memberLeft: [internal.quests.journey.recheckSomeoneNew],
  memberRejoined: [internal.quests.journey.recheckRejoined],
};

export async function publish(ctx: MutationCtx, event: DomainEvent) {
  for (const subscription of subscribers[event.type] as Array<Subscription<DomainEvent>>) {
    const { subscriber, only } = "subscriber" in subscription ? subscription : { subscriber: subscription, only: () => true };
    if (only(event)) await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
