import { internalMutation, type QueryCtx } from "../_generated/server";
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
  unlockOpenedEventValidator,
  unlockReadyEventValidator,
  unlocksLaunchedEventValidator,
  type KudosGivenEvent,
} from "../bus/events";
import { earliestAwardFrom, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
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
  projectUnlockOpened,
  projectUnlockReady,
  projectUnlocksLaunched,
} from "./projections";

export const recordKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, async () => record(ctx, event.workspace, projectKudosGiven(event, { newRecipients: await newRecipientsOf(ctx, event) })));
  },
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
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectAttemptFailed(event)]));
  },
});

export const recordMemberWelcomed = internalMutation({
  args: { event: memberWelcomedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectMemberWelcomed(event)]));
  },
});

export const recordLevelReached = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectLevelReached(event)]));
  },
});

export const recordUnlockReady = internalMutation({
  args: { event: unlockReadyEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectUnlockReady(event)]));
  },
});

export const recordUnlockOpened = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectUnlockOpened(event)]));
  },
});

export const recordUnlocksLaunched = internalMutation({
  args: { event: unlocksLaunchedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, projectUnlocksLaunched(event)));
  },
});

export const recordQuestsDrawn = internalMutation({
  args: { event: questsDrawnEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, projectQuestsDrawn(event)));
  },
});

export const recordGroupQuestDrawn = internalMutation({
  args: { event: groupQuestDrawnEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, projectGroupQuestDrawn(event)));
  },
});

export const recordQuestSwapped = internalMutation({
  args: { event: questSwappedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectQuestSwapped(event)]));
  },
});

export const recordQuestFinished = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectQuestFinished(event)]));
  },
});

export const recordQuestOpened = internalMutation({
  args: { event: questOpenedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectQuestOpened(event)]));
  },
});

export const recordJourneyStepActivated = internalMutation({
  args: { event: journeyStepActivatedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectJourneyStepActivated(event)]));
  },
});

export const recordHoggieDropped = internalMutation({
  args: { event: hoggieDroppedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectHoggieDropped(event)]));
  },
});

export const recordHugGiven = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectHugGiven(event)]));
  },
});

export const recordTeamPagesCompleted = internalMutation({
  args: { event: teamPagesCompletedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, projectTeamPagesCompleted(event)));
  },
});

export const recordPerkBought = internalMutation({
  args: { event: perkBoughtEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectPerkBought(event)]));
  },
});

export const recordAchievementEarned = internalMutation({
  args: { event: achievementEarnedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectAchievementEarned(event)]));
  },
});

function recordingFailuresLogged(event: string, recording: () => Promise<void>) {
  return failuresLogged("analytics.recording_failed", recording, { event });
}
