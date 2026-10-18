import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { journeyStepOpenedBy } from "../quests/step";
import { earnsPacks } from "../album/packs";
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
    internal.groups.attribution.attributeKudosGiven,
    internal.stickers.stickers.recordStickers,
    { subscriber: internal.album.packs.grantThoughtfulPacks, only: earnsPacks },
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
    { subscriber: internal.feedback.coins.tellCoinsOpened, only: ({ feature, byLaunch }) => byLaunch !== true && feature === "coins" },
  ],
  unlocksLaunched: [internal.analytics.subscribers.recordUnlocksLaunched],
  questFinished: [
    { subscriber: internal.quests.journey.finishFirstQuest, only: ({ quest }) => quest.kind === "weekly" },
    internal.analytics.subscribers.recordQuestFinished,
  ],
  questOpened: [internal.analytics.subscribers.recordQuestOpened],
  questsDrawn: [internal.analytics.subscribers.recordQuestsDrawn],
  groupQuestDrawn: [internal.analytics.subscribers.recordGroupQuestDrawn],
  questSwapped: [internal.analytics.subscribers.recordQuestSwapped],
  journeyStepActivated: [internal.analytics.subscribers.recordJourneyStepActivated],
  achievementEarned: [internal.analytics.subscribers.recordAchievementEarned],
  perkBought: [internal.analytics.subscribers.recordPerkBought],
  itemBought: [],
  memberLeft: [internal.quests.journey.recheckSomeoneNew, internal.engine.kudosText.forgetWordsOfLeaver],
  memberRejoined: [internal.quests.journey.recheckRejoined],
  primaryGroupChanged: [],
  awardsAttributed: [internal.leaderboard.groupTotals.countAwardsAttributed, internal.quests.groupQuest.followAwardsAttributed],
  hoggieDropped: [internal.analytics.subscribers.recordHoggieDropped],
  crateBought: [],
  hugGiven: [internal.hugs.people.payHugPeople, internal.analytics.subscribers.recordHugGiven],
  teamPagesCompleted: [internal.analytics.subscribers.recordTeamPagesCompleted],
  stickersCollected: [internal.analytics.subscribers.recordPersonCollected],
  thoughtfulPacksGranted: [internal.analytics.subscribers.recordPacksEarned],
  companyTeamsReplaced: [internal.album.emojiNames.reserveTeamNamesAfterTheSync],
};

export async function publish(ctx: MutationCtx, event: DomainEvent) {
  for (const subscription of subscribers[event.type] as Array<Subscription<DomainEvent>>) {
    const { subscriber, only } = "subscriber" in subscription ? subscription : { subscriber: subscription, only: () => true };
    if (only(event)) await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
