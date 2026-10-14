import { internal } from "../_generated/api";
import { observedHttpAction } from "../analytics/boundary";
import { commandOf, type Command } from "../commands/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null; selected_option?: { value: string } | null };

type Selections = Record<string, string>;

type MessageState = { values?: Record<string, Record<string, { selected_option?: { value: string } | null }>> };

type MemberClick = {
  type: "block_actions";
  team: { id: string };
  user: { id: string };
  trigger_id: string;
  container: { type: "view" } | { type: "message"; channel_id: string; message_ts: string };
  view?: { type: string };
  state?: MessageState;
  actions: Action[];
};

export const slackInteractivity = observedHttpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const payload = payloadOf(body);
  if (!isMemberClick(payload)) return new Response(null, { status: 200 });
  const selections = selectionsIn(payload.state);
  const commands = payload.actions.flatMap((action) => commandsOf(action, selections));
  if (commands.length === 0) return new Response(null, { status: 200 });
  await ctx.scheduler.runAfter(0, internal.slack.receipts.receiveHomeClick, {
    workspace: payload.team.id,
    eventId: payload.trigger_id,
    user: payload.user.id,
    commands,
    ...(payload.container.type === "message" && { conversation: payload.container.channel_id, message: payload.container.message_ts }),
  });
  return new Response(null, { status: 200 });
});

export function encodeHomeAction(command: Command) {
  return JSON.stringify(command);
}

function commandsOf(action: Action, selections: Selections): Command[] {
  const command = action.type === "button" ? buttonCommandOf(action, selections) : commandOf(selectCommandOf(action));
  return command === null ? [] : [command];
}

function selectCommandOf(action: Action): unknown {
  if (action.type === "channels_select") return { type: action.action_id, channel: action.selected_channel ?? null };
  if (action.type !== "static_select" || action.selected_option == null) return null;
  const command = parsed(action.action_id);
  return isObject(command) ? { ...command, group: action.selected_option.value } : null;
}

function buttonCommandOf({ value }: Action, selections: Selections): Command | null {
  const command = value === undefined ? null : parsed(value);
  if (!isObject(command)) return null;
  return commandOf({ ...command, ...selections }) ?? commandOf(command);
}

function selectionsIn(state: MessageState | undefined): Selections {
  const inputs = Object.values(state?.values ?? {}).flatMap((block) => Object.entries(block));
  return Object.fromEntries(inputs.flatMap(([field, input]) => (input.selected_option == null ? [] : [[field, input.selected_option.value]])));
}

function parsed(encoded: string): unknown {
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
