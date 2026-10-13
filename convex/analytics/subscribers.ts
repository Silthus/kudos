import { internalMutation } from "../_generated/server";
import { attemptFailedEventValidator, kudosGivenEventValidator, memberWelcomedEventValidator } from "../bus/events";
import { record } from "./outbox";
import { projectAttemptFailed, projectKudosGiven, projectMemberWelcomed } from "./projections";

export const recordKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await record(ctx, event.workspace, projectKudosGiven(event));
  },
});

export const recordAttemptFailed = internalMutation({
  args: { event: attemptFailedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await record(ctx, event.workspace, [projectAttemptFailed(event)]);
  },
});

export const recordMemberWelcomed = internalMutation({
  args: { event: memberWelcomedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await record(ctx, event.workspace, [projectMemberWelcomed(event)]);
  },
});
