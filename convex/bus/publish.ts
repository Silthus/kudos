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
    internal.quests.quests.followKudosGiven,
    internal.achievements.achievements.countKudosGiven,
    internal.leaderboard.totals.countKudosGiven,
    internal.analytics.subscribers.recordKudosGiven,
  ],
  attemptFailed: [internal.analytics.subscribers.recordAttemptFailed],
  memberWelcomed: [internal.analytics.subscribers.recordMemberWelcomed],
  levelReached: [internal.unlocks.unlocks.makeReady, internal.feedback.publicReplies.celebrateLevel, internal.analytics.subscribers.recordLevelReached],
  xpRecorded: [internal.feedback.homes.refreshHomeOnXp],
  unlockReady: [internal.analytics.subscribers.recordUnlockReady],
  unlockOpened: [
    { subscriber: internal.analytics.subscribers.recordUnlockOpened, only: ({ byLaunch }) => byLaunch !== true },
    { subscriber: internal.quests.weekly.drawWeeklyQuests, only: ({ feature, byLaunch }) => byLaunch !== true && feature === "quests" },
    { subscriber: internal.quests.journey.activateJourney, only: ({ feature, byLaunch }) => byLaunch !== true && journeyStepOpenedBy(feature) !== null },
    { subscriber: internal.feedback.tierNotices.tellOpeningSummary, only: ({ feature, byLaunch }) => byLaunch !== true && feature === "book" },
  ],
  unlocksLaunched: [internal.analytics.subscribers.recordUnlocksLaunched],
  questFinished: [
    { subscriber: internal.quests.journey.finishFirstQuest, only: ({ quest }) => quest.kind === "weekly" },
    internal.analytics.subscribers.recordQuestFinished,
  ],
  questOpened: [internal.analytics.subscribers.recordQuestOpened],
  questsDrawn: [internal.analytics.subscribers.recordQuestsDrawn],
  questSwapped: [internal.analytics.subscribers.recordQuestSwapped],
  journeyStepActivated: [internal.analytics.subscribers.recordJourneyStepActivated],
  achievementEarned: [internal.analytics.subscribers.recordAchievementEarned],
  perkBought: [internal.analytics.subscribers.recordPerkBought],
  memberLeft: [internal.quests.journey.recheckSomeoneNew, internal.engine.kudosText.forgetWordsOfLeaver],
  memberRejoined: [internal.quests.journey.recheckRejoined],
};

export async function publish(ctx: MutationCtx, event: DomainEvent) {
  for (const subscription of subscribers[event.type] as Array<Subscription<DomainEvent>>) {
    const { subscriber, only } = "subscriber" in subscription ? subscription : { subscriber: subscription, only: () => true };
    if (only(event)) await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
