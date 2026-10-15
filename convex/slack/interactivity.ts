import { internal } from "../_generated/api";
import { observedHttpAction } from "../analytics/boundary";
import { commandOf, type Command } from "../commands/commands";
import type { ActionCtx } from "../_generated/server";
import { customEmojiOptionOf, customEmojiPickerAction } from "./customEmojiPicker";
import { readSignedBody } from "./signature";

type Action = {
  type: string;
  action_id: string;
  value?: string;
  selected_channel?: string | null;
  selected_option?: { value?: string } | null;
  selected_options?: Array<{ value: string }>;
};

type OptionsRequest = { type: "block_suggestion"; team: { id: string }; user: { id: string }; action_id: string; value: string };

type Selections = Record<string, string>;

type MessageState = { values?: Record<string, Record<string, { selected_option?: { value: string } | null }>> };

type MemberClick = {
  type: "block_actions";
  team: { id: string };
  user: { id: string };
  trigger_id: string;
  container: { type: "view" } | { type: "message"; channel_id: string; message_ts?: string; is_ephemeral?: boolean; thread_ts?: string };
  view?: { type: string };
  state?: MessageState;
  actions: Action[];
};

export const slackInteractivity = observedHttpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const payload = payloadOf(body);
  if (isOptionsRequest(payload)) return Response.json({ options: await customEmojiOptionsFor(ctx, payload) });
  if (!isMemberClick(payload)) return new Response(null, { status: 200 });
  const selections = selectionsIn(payload.state);
  const commands = payload.actions.flatMap((action) => commandsOf(action, selections));
  if (commands.length === 0) return new Response(null, { status: 200 });
  await ctx.scheduler.runAfter(0, internal.slack.receipts.receiveHomeClick, {
    workspace: payload.team.id,
    eventId: payload.trigger_id,
    user: payload.user.id,
    commands,
    ...(payload.container.type === "message" && conversationOf(payload.container)),
  });
  return new Response(null, { status: 200 });
});

function conversationOf({ channel_id, message_ts, is_ephemeral, thread_ts }: Extract<MemberClick["container"], { type: "message" }>) {
  if (is_ephemeral !== true) return { conversation: channel_id, ...(message_ts !== undefined && { message: message_ts }) };
  return { conversation: channel_id, ephemeral: thread_ts === undefined ? {} : { threadRoot: thread_ts } };
}

export function encodeHomeAction(command: Command) {
  return JSON.stringify(command);
}

function commandsOf(action: Action, selections: Selections): Command[] {
  const command = commandOf(selectedCommandOf(action, selections));
  return command === null ? [] : [command];
}

function selectedCommandOf(action: Action, selections: Selections): unknown {
  switch (action.type) {
    case "channels_select":
      return { type: action.action_id, channel: action.selected_channel ?? null };
    case "multi_static_select":
      return { type: action.action_id, mode: "allowlist", allowlist: (action.selected_options ?? []).map(({ value }) => value) };
    case "multi_external_select":
      return { type: action.action_id, emoji: (action.selected_options ?? []).map(({ value }) => value) };
    case "static_select":
      return optionCommandOf(action);
    case "button":
      return buttonCommandOf(action, selections);
    default:
      return null;
  }
}

function optionCommandOf({ action_id, selected_option }: Action): unknown {
  const picked = selected_option?.value;
  if (picked === undefined) return null;
  const encoded = parsed(picked);
  if (isObject(encoded)) return encoded;
  const command = parsed(action_id);
  return isObject(command) ? { ...command, group: picked } : null;
}

function buttonCommandOf({ value }: Action, selections: Selections): unknown {
  const command = value === undefined ? null : parsed(value);
  if (!isObject(command)) return null;
  return commandOf({ ...command, ...selections }) ?? command;
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

async function customEmojiOptionsFor(ctx: ActionCtx, { team, user, action_id, value }: OptionsRequest) {
  if (action_id !== customEmojiPickerAction) return [];
  const names = await ctx.runQuery(internal.store.customKudosEmoji.customKudosEmojiOptions, { workspace: team.id, user: user.id, typed: value });
  return names.map(customEmojiOptionOf);
}

function isOptionsRequest(payload: unknown): payload is OptionsRequest {
  const request = payload as Partial<OptionsRequest> | null;
  return request?.type === "block_suggestion" && typeof request.action_id === "string" && typeof request.value === "string" && typeof request.team?.id === "string" && typeof request.user?.id === "string";
}

function isMemberClick(payload: unknown): payload is MemberClick {
  const click = payload as Partial<MemberClick> | null;
  if (click?.type !== "block_actions") return false;
  return click.view?.type === "home" || click.container?.type === "message";
}
