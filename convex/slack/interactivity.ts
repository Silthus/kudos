import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import type { Command } from "../commands/commands";
import { readSignedBody } from "./signature";

type HomeClick = {
  type: "block_actions";
  team: { id: string };
  user: { id: string };
  trigger_id: string;
  view: { type: "home" };
  actions: Array<{ value: string }>;
};

export const slackInteractivity = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const payload = payloadOf(body);
  if (!isHomeClick(payload)) return new Response(null, { status: 200 });
  await ctx.scheduler.runAfter(0, internal.slack.receipts.receiveHomeClick, {
    workspace: payload.team.id,
    eventId: payload.trigger_id,
    user: payload.user.id,
    commands: payload.actions.map((action) => decodeHomeAction(action.value)),
  });
  return new Response(null, { status: 200 });
});

export function encodeHomeAction(command: Command) {
  return JSON.stringify(command);
}

function decodeHomeAction(value: string) {
  return JSON.parse(value) as Command;
}

function payloadOf(body: Uint8Array<ArrayBuffer>): unknown {
  const payload = new URLSearchParams(new TextDecoder().decode(body)).get("payload");
  return payload === null ? null : JSON.parse(payload);
}

function isHomeClick(payload: unknown): payload is HomeClick {
  const click = payload as Partial<HomeClick> | null;
  return click?.type === "block_actions" && click.view?.type === "home";
}
