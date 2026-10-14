import { internalMutation } from "../_generated/server";
import {
  attemptFailedEventValidator,
  journeyStepActivatedEventValidator,
  kudosGivenEventValidator,
  levelReachedEventValidator,
  memberWelcomedEventValidator,
} from "../bus/events";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
import { projectAttemptFailed, projectJourneyStepActivated, projectKudosGiven, projectLevelReached, projectMemberWelcomed } from "./projections";

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

export const recordJourneyStepActivated = internalMutation({
  args: { event: journeyStepActivatedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await recordingFailuresLogged(event.type, () => record(ctx, event.workspace, [projectJourneyStepActivated(event)]));
  },
});

function recordingFailuresLogged(event: string, recording: () => Promise<void>) {
  return failuresLogged("analytics.recording_failed", recording, { event });
}
