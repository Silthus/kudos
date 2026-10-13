import { internal } from "../_generated/api";
import { observedHttpAction } from "../analytics/boundary";
import { commandOf, type Command } from "../commands/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null };

type HomeClick = {
  type: "block_actions";
  team: { id: string };
  user: { id: string };
  trigger_id: string;
  view: { type: "home" };
  actions: Action[];
};

export const slackInteractivity = observedHttpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const payload = payloadOf(body);
  if (!isHomeClick(payload)) return new Response(null, { status: 200 });
  await ctx.scheduler.runAfter(0, internal.slack.receipts.receiveHomeClick, {
    workspace: payload.team.id,
    eventId: payload.trigger_id,
    user: payload.user.id,
    commands: payload.actions.flatMap(commandsOf),
  });
  return new Response(null, { status: 200 });
});

export function encodeHomeAction(command: Command) {
  return JSON.stringify(command);
}

function commandsOf(action: Action): Command[] {
  const command = commandOf(action.type === "channels_select" ? { type: action.action_id, channel: action.selected_channel ?? null } : buttonCommandOf(action));
  return command === null ? [] : [command];
}

function buttonCommandOf({ type, value }: Action): unknown {
  if (type !== "button" || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function payloadOf(body: Uint8Array<ArrayBuffer>): unknown {
  const payload = new URLSearchParams(new TextDecoder().decode(body)).get("payload");
  return payload === null ? null : JSON.parse(payload);
}

function isHomeClick(payload: unknown): payload is HomeClick {
  const click = payload as Partial<HomeClick> | null;
  return click?.type === "block_actions" && click.view?.type === "home";
}
