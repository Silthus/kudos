import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { ReportableError } from "../analytics/exceptions";
import type { Line } from "../feedback/segments";
import { failedAttempt, slackTextOf, tryAtMostThreeTimes, type Retry } from "./delivery";
import { lookUpUser, type LookUp } from "./directory";

export type Viewer = { workspace: string; user: string };

export function replyPrivately(lines: Line[]) {
  return Response.json({ response_type: "ephemeral", text: slackTextOf(lines) });
}

export async function answerCommand(responseUrl: string, text: string) {
  const response = await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
  if (!response.ok) throw new ReportableError(`Slack response_url answered HTTP ${response.status}`);
}

export async function onceKnown(ctx: ActionCtx, attempt: number, viewer: Viewer, then: () => Promise<unknown>, tryAgain: (retry: NonNullable<Retry>) => Promise<unknown>) {
  await tryAtMostThreeTimes(
    attempt,
    async (attempt) => {
      const person = await knownOrLookedUp(ctx, viewer);
      if (person.kind === "failed") return failedAttempt(attempt, person.retryAfterMs);
      await then();
      return null;
    },
    tryAgain,
  );
}

export async function knownOrLookedUp(ctx: ActionCtx, { workspace, user }: Viewer): Promise<LookUp> {
  if (await ctx.runQuery(internal.slack.directory.knows, { workspace, user })) return { kind: "found" };
  return lookUpUser(ctx, workspace, user);
}
