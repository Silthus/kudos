import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { dispatch, isCommandType, type Intent } from "../bus/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null };
type BlockActions = { type: "block_actions"; team: { id: string }; user: { id: string }; trigger_id: string; actions: Action[] };

export const slackInteractivity = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const interaction = blockActionsOf(body);
  if (interaction === null) return new Response(null, { status: 200 });
  const receipt = { workspace: interaction.team.id, eventId: interaction.trigger_id };
  if (!(await ctx.runMutation(internal.slack.receipts.receiveInteraction, receipt))) return new Response(null, { status: 200 });
  const member = await ctx.runQuery(internal.workspace.directory.memberOf, { workspace: interaction.team.id, user: interaction.user.id });
  if (member === null) return new Response(null, { status: 200 });

  for (const intent of interaction.actions.flatMap(intentOf)) await dispatch(ctx, { ...intent, member });
  await ctx.runMutation(internal.feedback.homes.refreshHome, { member });
  return new Response(null, { status: 200 });
});

function blockActionsOf(body: Uint8Array): BlockActions | null {
  const payload = new URLSearchParams(new TextDecoder().decode(body)).get("payload");
  const interaction = payload === null ? null : (JSON.parse(payload) as { type: string });
  return interaction?.type === "block_actions" ? (interaction as BlockActions) : null;
}

function intentOf(action: Action): Intent[] {
  const intent = action.type === "channels_select" ? { type: action.action_id, channel: action.selected_channel ?? null } : parsedValue(action);
  return intent !== null && isCommandType(intent.type) ? [intent as Intent] : [];
}

function parsedValue({ type, value }: Action): { type: string } | null {
  return type === "button" && value !== undefined ? (JSON.parse(value) as { type: string }) : null;
}
