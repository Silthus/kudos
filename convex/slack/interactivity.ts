import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { knownIntent, type Intent } from "../bus/commands";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null };
type BlockActions = { type: "block_actions"; team: { id: string }; user: { id: string }; trigger_id: string; actions: Action[] };

export const slackInteractivity = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const interaction = blockActionsOf(body);
  if (interaction !== null) {
    await ctx.runMutation(internal.slack.receipts.receiveInteraction, {
      workspace: interaction.team.id,
      eventId: interaction.trigger_id,
      user: interaction.user.id,
      intents: interaction.actions.flatMap(intentOf),
    });
  }
  return new Response(null, { status: 200 });
});

function blockActionsOf(body: Uint8Array): BlockActions | null {
  const payload = new URLSearchParams(new TextDecoder().decode(body)).get("payload");
  const interaction = payload === null ? null : (JSON.parse(payload) as { type: string });
  return interaction?.type === "block_actions" ? (interaction as BlockActions) : null;
}

function intentOf(action: Action): Intent[] {
  const candidate = action.type === "channels_select" ? { type: action.action_id, channel: action.selected_channel ?? null } : parsedValue(action);
  const intent = candidate === null ? null : knownIntent(candidate);
  return intent === null ? [] : [intent];
}

function parsedValue({ type, value }: Action): { type: string } | null {
  return type === "button" && value !== undefined ? (JSON.parse(value) as { type: string }) : null;
}
