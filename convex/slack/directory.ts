import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { messageRefValidator } from "../engine/messageEvent";
import type { DirectoryEntry } from "../workspace/directory";
import { readSlack } from "./webApi";

type SlackUser = { id: string; team_id?: string; deleted?: boolean; is_bot?: boolean; tz?: string };

const slackbot = "USLACKBOT";

export const lookUpUsers = internalAction({
  args: { ref: messageRefValidator, users: v.array(v.string()) },
  handler: async (ctx, { ref, users }) => {
    for (const user of users) await lookUpUser(ctx, ref.workspace, user);
    await ctx.runMutation(internal.engine.engine.recheck, ref);
  },
});

export async function lookUpUser(ctx: ActionCtx, workspace: string, user: string) {
  const answer = await readSlack<{ user: SlackUser }>("users.info", { user });
  if (!answer.ok) return;
  await ctx.runMutation(internal.workspace.directory.record, { workspace, user, entry: directoryEntryOf(answer.user, workspace) });
}

function directoryEntryOf(user: SlackUser, workspace: string): DirectoryEntry {
  if (user.is_bot || user.id === slackbot) return { kind: "bot" };
  if (user.deleted || user.team_id !== workspace) return { kind: "not-a-member" };
  return { kind: "member", ...(user.tz && { timeZone: user.tz }) };
}
