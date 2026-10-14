import { internal } from "../_generated/api";
import { observedHttpAction } from "../analytics/boundary";
import { commandOf, type Command } from "../commands/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null };

type MemberClick = {
  type: "block_actions";
  team: { id: string };
  user: { id: string };
  trigger_id: string;
  container: { type: "view" } | { type: "message"; channel_id: string };
  view?: { type: string };
  actions: Action[];
};

export const slackInteractivity = observedHttpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const payload = payloadOf(body);
  if (!isMemberClick(payload)) return new Response(null, { status: 200 });
  const commands = payload.actions.flatMap(commandsOf);
  if (commands.length === 0) return new Response(null, { status: 200 });
  await ctx.scheduler.runAfter(0, internal.slack.receipts.receiveHomeClick, {
    workspace: payload.team.id,
    eventId: payload.trigger_id,
    user: payload.user.id,
    commands,
    ...(payload.container.type === "message" && { conversation: payload.container.channel_id }),
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

function isMemberClick(payload: unknown): payload is MemberClick {
  const click = payload as Partial<MemberClick> | null;
  if (click?.type !== "block_actions") return false;
  return click.view?.type === "home" || click.container?.type === "message";
}
