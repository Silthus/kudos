import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { isMessage, mayGiveKudos, messageEventOf, type EventCallback } from "./normalize";
import { isSignedBySlack } from "./signature";

type Envelope = { type: "url_verification"; challenge: string } | EventCallback | { type: "app_rate_limited" };

export const slackEvents = httpAction(async (ctx, request) => {
  const body = new Uint8Array(await request.arrayBuffer());
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

  const envelope = JSON.parse(new TextDecoder().decode(body)) as Envelope;
  if (envelope.type === "url_verification") return Response.json({ challenge: envelope.challenge });
  if (envelope.type === "event_callback") {
    const event = messageEventOf(envelope);
    if (isMessage(envelope.event) && !mayGiveKudos(event)) return new Response(null, { status: 200 });
    await ctx.runMutation(internal.slack.receipts.receive, { workspace: envelope.team_id, eventId: envelope.event_id, event });
  }
  return new Response(null, { status: 200 });
});

function signingSecret() {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error("SLACK_SIGNING_SECRET is not set");
  return secret;
}
