import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { isHomeTabOpened } from "./appHome";
import { directoryRecordOfEvent, isMemberChanged } from "./directory";
import { isMessage, mayGiveKudos, messageEventOf, type EventCallback } from "./normalize";
import { readSignedBody } from "./signature";

type Envelope = { type: "url_verification"; challenge: string } | EventCallback | { type: "app_rate_limited" };

export const slackEvents = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const envelope = JSON.parse(new TextDecoder().decode(body)) as Envelope;
  if (envelope.type === "url_verification") return Response.json({ challenge: envelope.challenge });
  if (envelope.type === "event_callback" && isHomeTabOpened(envelope.event)) {
    await ctx.runMutation(internal.slack.receipts.receiveHomeOpened, { workspace: envelope.team_id, eventId: envelope.event_id, user: envelope.event.user });
  } else if (envelope.type === "event_callback" && isMemberChanged(envelope.event)) {
    await ctx.runMutation(internal.slack.receipts.receiveMemberChanged, { eventId: envelope.event_id, ...directoryRecordOfEvent(envelope.team_id, envelope.event) });
  } else if (envelope.type === "event_callback") {
    const event = messageEventOf(envelope);
    if (isMessage(envelope.event) && !mayGiveKudos(event)) return new Response(null, { status: 200 });
    await ctx.runMutation(internal.slack.receipts.receive, { workspace: envelope.team_id, eventId: envelope.event_id, event });
  }
  return new Response(null, { status: 200 });
});
