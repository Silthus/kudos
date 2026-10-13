import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "../_generated/server";
import { awaitedUsers, recheck, type Observation } from "../engine/engine";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import type { DirectoryEntry, DirectoryRecord } from "../workspace/directory";
import { readSlack } from "./webApi";

type SlackUser = { id: string; team_id?: string; deleted?: boolean; is_bot?: boolean; tz?: string; updated?: number };

export type MemberChanged = { type: "team_join" | "user_change"; user: SlackUser; event_ts: string };

const slackbot = "USLACKBOT";

export function isMemberChanged(event: { type: string }): event is MemberChanged {
  return event.type === "team_join" || event.type === "user_change";
}

export function directoryRecordOfEvent(workspace: string, event: MemberChanged): DirectoryRecord {
  return { ...directoryRecordOf(workspace, event.user), asOf: Number(event.event_ts) * 1000 };
}

function directoryRecordOf(workspace: string, user: SlackUser): DirectoryRecord {
  return {
    workspace,
    user: user.id,
    entry: directoryEntryOf(user, workspace),
    ...(user.updated !== undefined && { asOf: user.updated * 1000 }),
  };
}

export async function checkDirectoryLater(ctx: MutationCtx, ref: MessageRef, observation: Observation) {
  if (observation.kind !== "awaiting-directory") return;
  await ctx.scheduler.runAfter(observation.retryInMs, internal.slack.directory.checkDirectory, { ref, attempt: observation.attempt });
}

export const checkDirectory = internalAction({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: async (ctx, { ref, attempt }) => {
    const users = await ctx.runQuery(internal.slack.directory.usersAwaited, { ref, attempt });
    if (users === null) return;
    for (const user of users) await lookUpUser(ctx, ref.workspace, user);
    await ctx.runMutation(internal.slack.directory.recheckMessage, { ref, attempt });
  },
});

export const usersAwaited = internalQuery({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: (ctx, { ref, attempt }) => awaitedUsers(ctx, ref, attempt),
});

export const recheckMessage = internalMutation({
  args: { ref: messageRefValidator, attempt: v.int64() },
  handler: async (ctx, { ref, attempt }) => {
    await checkDirectoryLater(ctx, ref, await recheck(ctx, ref, attempt));
  },
});

export async function lookUpUser(ctx: ActionCtx, workspace: string, user: string) {
  const answer = await usersInfo(user);
  if (!answer?.ok) return;
  await ctx.runMutation(internal.workspace.directory.fillEntry, directoryRecordOf(workspace, answer.user));
}

async function usersInfo(user: string) {
  try {
    return await readSlack<{ user: SlackUser }>("users.info", { user });
  } catch (error) {
    console.warn(`users.info failed for ${user}: ${error}`);
    return null;
  }
}

function directoryEntryOf(user: SlackUser, workspace: string): DirectoryEntry {
  if (user.is_bot || user.id === slackbot) return { kind: "bot" };
  if (user.deleted || user.team_id !== workspace) return { kind: "not-a-member" };
  return { kind: "member", ...(user.tz && { timeZone: user.tz }) };
}
