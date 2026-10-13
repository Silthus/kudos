import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { messageRefValidator } from "../engine/messageEvent";
import type { DirectoryEntry } from "../workspace/directory";
import { callSlack } from "./web";

type SlackUser = { id: string; team_id?: string; deleted?: boolean; is_bot?: boolean; tz?: string };

const slackbot = "USLACKBOT";

export const lookUpUsers = internalAction({
  args: { ref: messageRefValidator, users: v.array(v.string()) },
  handler: async (ctx, { ref, users }) => {
    for (const user of users) {
      const result = await callSlack("users.info", { user });
      if (!result.ok) continue;
      const entry = directoryEntryOf(result.user as SlackUser, ref.workspace);
      await ctx.runMutation(internal.workspace.directory.record, { workspace: ref.workspace, user, entry });
    }
    await ctx.runMutation(internal.engine.engine.recheck, ref);
  },
});

function directoryEntryOf(user: SlackUser, workspace: string): DirectoryEntry {
  if (user.is_bot || user.id === slackbot) return { kind: "bot" };
  if (user.deleted || user.team_id !== workspace) return { kind: "not-a-member" };
  return { kind: "member", ...(user.tz && { timeZone: user.tz }) };
}
