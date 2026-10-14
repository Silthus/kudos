import { internalMutation } from "../_generated/server";
import {
  attemptFailedEventValidator,
  kudosGivenEventValidator,
  levelReachedEventValidator,
  memberWelcomedEventValidator,
  unlockOpenedEventValidator,
  unlockReadyEventValidator,
  unlocksLaunchedEventValidator,
} from "../bus/events";
import { failuresLogged } from "./failures";
import { record } from "./outbox";
import {
  projectAttemptFailed,
  projectKudosGiven,
  projectLevelReached,
  projectMemberWelcomed,
  projectUnlockOpened,
  projectUnlockReady,
  projectUnlocksLaunched,
} from "./projections";

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

function recordingFailuresLogged(event: string, recording: () => Promise<void>) {
  return failuresLogged("analytics.recording_failed", recording, { event });
}
