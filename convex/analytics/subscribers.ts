import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
  achievementEarnedEventValidator,
  teamPagesCompletedEventValidator,
  attemptFailedEventValidator,
  hoggieDroppedEventValidator,
  journeyStepActivatedEventValidator,
  kudosGivenEventValidator,
  levelReachedEventValidator,
  memberWelcomedEventValidator,
  perkBoughtEventValidator,
  questFinishedEventValidator,
  questOpenedEventValidator,
  questsDrawnEventValidator,
  groupQuestDrawnEventValidator,
  questSwappedEventValidator,
  hugGivenEventValidator,
  stickersCollectedEventValidator,
  thoughtfulPacksGrantedEventValidator,
  stickerPutInEventValidator,
  itemTurnedEventValidator,
  unlockOpenedEventValidator,
  unlockReadyEventValidator,
  unlocksLaunchedEventValidator,
  type DomainEvent,
  type KudosGivenEvent,
} from "../bus/events";
import { earliestAwardFrom, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { captureSettings } from "./capture";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
import { recordsOnce } from "./recordedFacts";
import {
  projectAchievementEarned,
  projectTeamPagesCompleted,
  projectAttemptFailed,
  projectHoggieDropped,
  projectJourneyStepActivated,
  projectKudosGiven,
  projectLevelReached,
  projectMemberWelcomed,
  projectPerkBought,
  projectQuestFinished,
  projectQuestOpened,
  projectQuestsDrawn,
  projectGroupQuestDrawn,
  projectQuestSwapped,
  projectHugGiven,
  projectPersonCollected,
  projectPacksEarned,
  projectAlbumStickerCollected,
  projectItemTurned,
  projectUnlockOpened,
  projectUnlockReady,
  projectUnlocksLaunched,
  type ProductEvent,
} from "./projections";

export const recordKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, async () => projectKudosGiven(event, { newRecipients: await newRecipientsOf(ctx, event) })),
});

async function newRecipientsOf(ctx: QueryCtx, { giver, awards }: KudosGivenEvent): Promise<number> {
  let newRecipients = 0;
  for (const { award, recipient } of awards) if (await isFirstFrom(ctx, giver, recipient, award)) newRecipients += 1;
  return newRecipients;
}

async function isFirstFrom(ctx: QueryCtx, giver: MemberId, recipient: MemberId, award: AwardId): Promise<boolean> {
  const earliest = await earliestAwardFrom(ctx, giver, recipient);
  return earliest === null || earliest.award === award;
}

export const recordAttemptFailed = internalMutation({
  args: { event: attemptFailedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectAttemptFailed(event)]),
});

export const recordMemberWelcomed = internalMutation({
  args: { event: memberWelcomedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectMemberWelcomed(event)]),
});

export const recordLevelReached = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectLevelReached(event)]),
});

export const recordUnlockReady = internalMutation({
  args: { event: unlockReadyEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectUnlockReady(event)]),
});

export const recordUnlockOpened = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectUnlockOpened(event)]),
});

export const recordUnlocksLaunched = internalMutation({
  args: { event: unlocksLaunchedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => projectUnlocksLaunched(event)),
});

export const recordQuestsDrawn = internalMutation({
  args: { event: questsDrawnEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => projectQuestsDrawn(event)),
});

export const recordGroupQuestDrawn = internalMutation({
  args: { event: groupQuestDrawnEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => projectGroupQuestDrawn(event)),
});

export const recordQuestSwapped = internalMutation({
  args: { event: questSwappedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectQuestSwapped(event)]),
});

export const recordQuestFinished = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectQuestFinished(event)]),
});

export const recordQuestOpened = internalMutation({
  args: { event: questOpenedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectQuestOpened(event)]),
});

export const recordJourneyStepActivated = internalMutation({
  args: { event: journeyStepActivatedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectJourneyStepActivated(event)]),
});

export const recordHoggieDropped = internalMutation({
  args: { event: hoggieDroppedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectHoggieDropped(event)]),
});

export const recordHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectHugGiven(event)]),
});

export const recordTeamPagesCompleted = internalMutation({
  args: { event: teamPagesCompletedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => projectTeamPagesCompleted(event)),
});

export const recordPersonCollected = internalMutation({
  args: { event: stickersCollectedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => projectPersonCollected(event)),
});

export const recordPacksEarned = internalMutation({
  args: { event: thoughtfulPacksGrantedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectPacksEarned(event)]),
});

export const recordAlbumStickerCollected = internalMutation({
  args: { event: stickerPutInEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectAlbumStickerCollected(event)]),
});

export const recordItemTurned = internalMutation({
  args: { event: itemTurnedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectItemTurned(event)]),
});

export const recordPerkBought = internalMutation({
  args: { event: perkBoughtEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectPerkBought(event)]),
});

export const recordAchievementEarned = internalMutation({
  args: { event: achievementEarnedEventValidator },
  handler: (ctx, { event }) => recordOnce(ctx, event, () => [projectAchievementEarned(event)]),
});

function recordOnce(ctx: MutationCtx, event: DomainEvent & { workspace: string }, project: () => ProductEvent[] | Promise<ProductEvent[]>): Promise<void> {
  return failuresLogged(
    "analytics.recording_failed",
    async () => {
      if (captureSettings() !== null && (await recordsOnce(ctx, event.fact))) await record(ctx, event.workspace, await project());
    },
    { event: event.type },
  );
}
