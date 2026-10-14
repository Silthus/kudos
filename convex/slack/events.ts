import { internal } from "../_generated/api";
import { observedHttpAction } from "../analytics/boundary";
import { isHomeTabOpened } from "./appHome";
import { directoryRecordOfEvent, isMemberChanged } from "./directory";
import { isMessage, mayGiveKudos, messageEventOf, type EventCallback } from "./normalize";
import { readSignedBody } from "./signature";

type Envelope = { type: "url_verification"; challenge: string } | EventCallback | { type: "app_rate_limited" };

export const slackEvents = observedHttpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const envelope = envelopeOf(body);
  if (envelope.type === "url_verification") return Response.json({ challenge: envelope.challenge });
  if (envelope.type === "event_callback" && isHomeTabOpened(envelope.event)) {
    await ctx.runMutation(internal.slack.receipts.receiveHomeOpened, {
      workspace: envelope.team_id,
      eventId: envelope.event_id,
      user: envelope.event.user,
      at: envelope.event_time * 1000,
    });
  } else if (envelope.type === "event_callback" && isMemberChanged(envelope.event)) {
    const memberChanged = directoryRecordOfEvent(envelope.team_id, envelope.event_id, envelope.event);
    if (memberChanged !== null) await ctx.runMutation(internal.slack.receipts.receiveMemberChanged, memberChanged);
  } else if (envelope.type === "event_callback") {
    const event = messageEventOf(envelope);
    if (isMessage(envelope.event) && !mayGiveKudos(event)) return new Response(null, { status: 200 });
    await ctx.runMutation(internal.slack.receipts.receive, { workspace: envelope.team_id, eventId: envelope.event_id, event });
  }
  return new Response(null, { status: 200 });
});

function envelopeOf(body: Uint8Array): Envelope {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as Envelope;
  } catch {
    throw new SyntaxError("Slack sent a signed body that isn't JSON");
  }
}
