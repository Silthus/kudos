import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { dispatch, isCommandType, type Intent } from "../bus/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string };
type BlockActions = { type: "block_actions"; team: { id: string }; user: { id: string }; actions: Action[] };

export const slackInteractivity = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const interaction = blockActionsOf(body);
  if (interaction === null) return new Response(null, { status: 200 });
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
  if (action.type !== "button" || action.value === undefined) return [];
  const intent = JSON.parse(action.value) as Intent;
  return isCommandType(intent.type) ? [intent] : [];
}
