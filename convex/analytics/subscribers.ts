import { internalMutation } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { record } from "./outbox";
import { projectKudosGiven } from "./projections";

export const recordKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await record(ctx, event.workspace, projectKudosGiven(event));
  },
});
