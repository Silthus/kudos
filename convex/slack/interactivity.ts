import { v } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction, internalAction } from "../_generated/server";
import { dispatch, isCommandType, type Intent } from "../bus/commands";
import { attemptArgs, sendOnce, tryAtMostThreeTimes } from "./delivery";
import { readSignedBody } from "./signature";

type Action = { type: string; action_id: string; value?: string; selected_channel?: string | null };
type BlockActions = { type: "block_actions"; team: { id: string }; user: { id: string }; actions: Action[] };

export const slackInteractivity = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const interaction = blockActionsOf(body);
  if (interaction === null) return new Response(null, { status: 200 });
  const member = await ctx.runQuery(internal.workspace.directory.memberOf, { workspace: interaction.team.id, user: interaction.user.id });
  if (member === null) return new Response(null, { status: 200 });

  for (const intent of interaction.actions.flatMap(intentOf)) {
    const result = await dispatch(ctx, { ...intent, member });
    if (result === "done" && intent.type === "setAnnouncementChannel" && intent.channel !== null) {
      await ctx.scheduler.runAfter(0, internal.slack.interactivity.joinChannel, { workspace: interaction.team.id, channel: intent.channel });
    }
  }
  await ctx.runMutation(internal.feedback.homes.refreshHome, { member });
  return new Response(null, { status: 200 });
});

function blockActionsOf(body: Uint8Array): BlockActions | null {
  const payload = new URLSearchParams(new TextDecoder().decode(body)).get("payload");
  const interaction = payload === null ? null : (JSON.parse(payload) as { type: string });
  return interaction?.type === "block_actions" ? (interaction as BlockActions) : null;
}

export const joinChannel = internalAction({
  args: { workspace: v.string(), channel: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...join }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendOnce(ctx, join.workspace, "conversations.join", { channel: join.channel }, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.interactivity.joinChannel, { ...join, attempt: retry.attempt }),
    );
  },
});

function intentOf(action: Action): Intent[] {
  const intent = action.type === "channels_select" ? { type: action.action_id, channel: action.selected_channel ?? null } : parsedValue(action);
  return intent !== null && isCommandType(intent.type) ? [intent as Intent] : [];
}

function parsedValue({ type, value }: Action): { type: string } | null {
  return type === "button" && value !== undefined ? (JSON.parse(value) as { type: string }) : null;
}
