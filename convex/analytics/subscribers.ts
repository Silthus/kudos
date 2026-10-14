import { internalMutation } from "../_generated/server";
import { attemptFailedEventValidator, kudosGivenEventValidator, levelReachedEventValidator, memberWelcomedEventValidator, questFinishedEventValidator } from "../bus/events";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
import { projectAttemptFailed, projectKudosGiven, projectLevelReached, projectMemberWelcomed, projectQuestFinished } from "./projections";

export const recordKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, projectKudosGiven(event)));
  },
});

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

export const recordQuestFinished = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectQuestFinished(event)]));
  },
});

function recordingFailuresLogged(event: string, recording: () => Promise<void>) {
  return failuresLogged("analytics.recording_failed", recording, { event });
}
