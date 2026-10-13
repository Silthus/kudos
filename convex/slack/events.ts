import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { readSignedBody } from "./signature";

type Envelope =
  | { type: "url_verification"; challenge: string }
  | { type: "event_callback"; team_id: string; event_id: string }
  | { type: "app_rate_limited" };

export const slackEvents = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const envelope = JSON.parse(new TextDecoder().decode(body)) as Envelope;
  if (envelope.type === "url_verification") return Response.json({ challenge: envelope.challenge });
  if (envelope.type === "event_callback") {
    await ctx.runMutation(internal.slack.receipts.receive, { workspace: envelope.team_id, eventId: envelope.event_id });
  }
  return new Response(null, { status: 200 });
});
