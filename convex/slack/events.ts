import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { isSignedBySlack } from "./signature";

type Envelope =
  | { type: "url_verification"; challenge: string }
  | { type: "event_callback"; team_id: string; event_id: string };

export const slackEvents = httpAction(async (ctx, request) => {
  const body = await request.text();
  const signed = await isSignedBySlack(
    {
      timestamp: request.headers.get("x-slack-request-timestamp"),
      signature: request.headers.get("x-slack-signature"),
      body,
    },
    signingSecret(),
    Date.now(),
  );
  if (!signed) return new Response(null, { status: 401 });

  const envelope = JSON.parse(body) as Envelope;
  if (envelope.type === "url_verification") return Response.json({ challenge: envelope.challenge });
  await ctx.runMutation(internal.slack.receipts.receive, { workspace: envelope.team_id, eventId: envelope.event_id });
  return new Response(null, { status: 200 });
});

function signingSecret() {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error("SLACK_SIGNING_SECRET is not set");
  return secret;
}
